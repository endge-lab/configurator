import type {
  ComponentSFCProgramPayload,
  ComponentSFCRenderPort,
  ComputationResource,
  I18nRuntimeCatalog,
  ProgramArtifact,
  RuntimeArtifactReader,
  RuntimeHostSnapshot,
  RuntimeInspectionSnapshot,
  RuntimeRenderableInspection,
  VocabRuntimeCatalog,
} from '@endge/core'
import { Endge, resolveRuntimeTranslation, resolveRuntimeVocabOptions, runtimeInspectionMetaKey } from '@endge/core'
import { readRuntimeInspectionData } from '@/features/endge-ide/tools/read-runtime-inspection-data'

export type RuntimeInspectionRenderable
  = { kind: 'component-sfc', key: string, title: string, runtime: ComponentSFCRenderPort, input: { kind: 'local', props: Record<string, unknown> } }
    | { kind: 'filter-view', key: string, title: string, model: Extract<RuntimeRenderableInspection, { kind: 'filter-view' }>['model'] }
    | { kind: 'store-snapshot', key: string, title: string, fields: { key: string, value: unknown, kind: string }[] }
    | { kind: 'unavailable', key: string, title: string, message: string }

/** Только проекция UI: исходное состояние читается у Core Runtime, compilation не публикуется в Program. */
export class RuntimeInspectionRenderer {
  private readonly _artifacts = new Map<string, { source: string, artifact: ProgramArtifact<ComponentSFCProgramPayload> }>()
  private readonly _ports = new Map<string, { createdAt: number, port: ComponentSFCRenderPort }>()
  private readonly _reader: RuntimeArtifactReader = {
    getArtifact: <T>(type: Parameters<RuntimeArtifactReader['getArtifact']>[0], identity: string | number): ProgramArtifact<T> | null => {
      if (type !== 'component-sfc') {
        return null
      }
      const component = Endge.domain.getComponentSFC(String(identity))
      if (!component) {
        return null
      }
      const cached = this._artifacts.get(component.identity)
      if (cached?.source === component.source) {
        return cached.artifact as ProgramArtifact<T>
      }
      const artifact = Endge.compiler.compileComponentSFCArtifact(component)
      this._artifacts.set(component.identity, { source: component.source, artifact })
      return artifact as ProgramArtifact<T>
    },
  }

  public constructor(private readonly _snapshot: () => RuntimeInspectionSnapshot) {}

  public reset(): void {
    this._artifacts.clear()
    this._ports.clear()
  }

  public retainHosts(hosts: readonly RuntimeHostSnapshot[]): void {
    const generations = new Map(hosts.map(host => [host.id, host.createdAt]))
    for (const [id, entry] of this._ports) {
      if (generations.get(id) !== entry.createdAt) {
        this._ports.delete(id)
      }
    }
  }

  public render(host: RuntimeHostSnapshot): RuntimeInspectionRenderable | null {
    const key = `${host.id}:${host.createdAt}`
    const title = host.title
    const snapshot = this._snapshot()
    if (host.entityType === 'store') {
      const data = readRuntimeInspectionData(snapshot.data, host.basePath)
      const derived = new Set(Array.isArray(host.context.derivedFields) ? host.context.derivedFields : [])
      return { kind: 'store-snapshot', key, title, fields: data && typeof data === 'object' ? Object.entries(data).map(([key, value]) => ({ key, value, kind: derived.has(key) ? 'derived' : 'value' })) : [] }
    }
    if (!host.capabilities.includes('renderable')) {
      return null
    }
    const render = snapshot.render?.hosts[host.id]
    if (!render) {
      return { kind: 'unavailable', key, title, message: 'Клиент не передал входы для визуального превью. Обновите снимок.' }
    }
    if (render.kind === 'filter-view') {
      return { kind: 'filter-view', key, title, model: render.model }
    }
    try {
      const artifact = this._reader.getArtifact<ComponentSFCProgramPayload>('component-sfc', host.entityIdentity)
      if (!artifact?.payload.ir) {
        return { kind: 'unavailable', key, title, message: artifact?.diagnostics.map(item => item.message).join('\n') || 'Не удалось скомпилировать Component SFC из Domain клиента.' }
      }
      const input = render.input
      const props = input?.kind === 'local' ? { ...input.props } : { ...(input?.props ?? {}) }
      if (input?.kind === 'raph') {
        for (const [name, binding] of Object.entries(input.bindings)) {
          props[name] = readRuntimeInspectionData(snapshot.data, binding.path)
        }
      }
      return { kind: 'component-sfc', key, title, runtime: this._port(host), input: { kind: 'local', props } }
    }
    catch (error) {
      return { kind: 'unavailable', key, title, message: error instanceof Error ? error.message : String(error) }
    }
  }

  private _port(initial: RuntimeHostSnapshot): ComponentSFCRenderPort {
    const cached = this._ports.get(initial.id)
    if (cached?.createdAt === initial.createdAt) {
      return cached.port
    }
    const snapshot = this._snapshot
    const host = () => snapshot().runtime.hosts.find(item => item.id === initial.id && item.createdAt === initial.createdAt) ?? initial
    const render = () => {
      const value = snapshot().render?.hosts[initial.id]
      return value?.kind === 'component-sfc' ? value : null
    }
    const artifact = () => this._reader.getArtifact<ComponentSFCProgramPayload>('component-sfc', initial.entityIdentity)
    const deny = (): never => {
      throw new Error('Превью клиента доступно только для чтения')
    }
    const port: ComponentSFCRenderPort = {
      id: initial.id,
      entityIdentity: initial.entityIdentity,
      readonly: true,
      runtimeState: null,
      get styleArtifacts() { return snapshot().render?.styles ?? [] },
      get runtimeScopeIds() {
        const scopes = snapshot().runtime.scopes
        let current = scopes.find(scope => scope.memberRuntimeIds.includes(initial.id))
        const ids: string[] = []
        while (current && !ids.includes(current.id)) {
          ids.unshift(current.id)
          current = scopes.find(scope => scope.id === current?.parentScopeId)
        }
        return ids
      },
      getArtifact: artifact,
      getArtifactReader: () => this._reader,
      getIr: () => artifact()?.payload.ir ?? null,
      getComputationResource: (identity, input): ComputationResource => {
        const signature = inputSignature(input)
        const captured = render()?.computations.find(item => item.identity === identity && inputSignature(item.input) === signature)
        return {
          status: captured?.status ?? 'idle',
          loading: captured?.loading ?? false,
          value: captured?.value,
          error: captured?.error ?? null,
          refresh: async () => deny(),
          subscribe: () => () => {},
          dispose: () => {},
        }
      },
      releaseComputationResources: () => {},
      readDataMeta: (reference, namespace) => render()?.dataMeta[runtimeInspectionMetaKey(reference, namespace)],
      translate: (key, fallback) => resolveRuntimeTranslation((host().meta.i18nCatalog ?? {}) as I18nRuntimeCatalog, key, Endge.context.currentLocale, Endge.configuration.current.fallbackLocale, fallback),
      resolveVocabOptions: (alias, mapping) => {
        const catalog = (host().meta.vocabCatalog ?? {}) as VocabRuntimeCatalog
        const entry = catalog[String(alias).trim()]
        return entry ? resolveRuntimeVocabOptions(readRuntimeInspectionData(snapshot().data, entry.path), mapping) : []
      },
      getEditSession: () => null,
      beginEditSession: deny,
      updateEditDraft: deny,
      commitEditSession: deny,
      cancelEditSession: deny,
      executeEventPortAction: async () => false,
      publishEventPort: deny,
      setInputSource: () => {},
      on: () => {},
      off: () => {},
      emit: () => {},
    }
    this._ports.set(initial.id, { createdAt: initial.createdAt, port })
    return port
  }
}

/** Порядок ключей wire JSON не меняет соответствие входа фактически вычисленному ресурсу. */
function inputSignature(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item) ?? 'undefined'
}
