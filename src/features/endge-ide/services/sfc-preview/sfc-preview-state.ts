import type {
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  ComputationProgramPayload,
  EndgeStyleSheetArtifact,
  ProgramArtifact,
  QueryProgramPayload,
  RuntimeHostInputSource,
} from '@endge/core'
import type { ComponentPreviewContext } from '@/features/endge-ide/services/preview-runtime/component-preview-runtime'

import {
  analyzeComponentSFCScript,
  compileComponentSFC,
  Endge,
  parseComponentSFC,
  RAction,
  RComponentSFC,
  RComputation,
  RQuery,
} from '@endge/core'
import { materializeEndgeCSSForDOM } from '@endge/ui-vue'
import { computed, shallowRef } from 'vue'

import {
  destroyComponentPreviewContext,
  prepareComponentPreviewContext,
  resolveComponentPreviewInput,
} from '@/features/endge-ide/services/preview-runtime/component-preview-runtime'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/services/types/type-definition-resolver'

export interface SFCPreviewLaunchInput {
  id?: string | number | null
  identity?: string | null
  tag?: string | null
  name?: string | null
  displayName?: string | null
  source: string
}

/** Owns one standalone SFC preview and all of its disposable resources. */
export class SFCPreviewSession {
  public readonly runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
  public readonly input = shallowRef<RuntimeHostInputSource>({ kind: 'local', props: {} })
  public readonly error = shallowRef<string | null>(null)
  public readonly title = shallowRef('SFC preview')
  public readonly hasRuntime = computed(() => Boolean(this.runtime.value))

  private readonly _scope = Endge.runtime.createAppScope({
    id: 'configurator-sfc-preview',
    rootPath: 'runtime-preview.component-sfc',
    collisionPolicy: 'replace',
    persistence: 'disabled',
  })

  private _composition: ComponentPreviewContext | null = null
  private _styleElement: HTMLStyleElement | null = null
  private _counter = 0
  private _queue: Promise<void> = Promise.resolve()

  public launch(input: SFCPreviewLaunchInput): Promise<void> {
    return this._serialize(async () => {
      this.error.value = null
      this.title.value = input.displayName || input.name || input.identity || 'SFC preview'

      const index = ++this._counter
      const model = RComponentSFC.fromPlain({
        id: input.id ?? `preview-${index}`,
        identity: input.identity || `sfc-preview-${index}`,
        tag: input.tag,
        name: input.name || input.displayName || input.identity || 'SFC preview',
        displayName: input.displayName || input.name || input.identity || 'SFC preview',
        source: input.source,
      })
      const artifact = createPreviewArtifact(model)
      if (artifact.status === 'error') {
        const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
          ?? 'SFC source содержит ошибки.'
        throw new Error(message)
      }
      const previewProps = artifact.payload.previewProps
      if (!previewProps || Object.keys(previewProps).length === 0) {
        throw new Error('Сначала определите превью props')
      }

      const identity = resolvePreviewIdentity(input)
      ensurePreviewPortArtifacts(artifact.payload)
      await this._disposeRuntime()
      this._applyPreviewStyle(artifact.payload.ir?.style ?? null)
      await this._scope.destroyAsync('component-sfc', identity)
      const composition = await prepareComponentPreviewContext(
        artifact.payload.previewOptions,
        previewProps,
        input,
        {
          appScope: this._scope,
          meta: { mode: 'preview' },
          resolveStoreRuntime: identity => this._scope.resolve('store', identity),
          vocabDependencies: artifact.payload.runtimeDependencies?.vocabs ?? [],
        },
      )
      try {
        const runtimeInput = resolveComponentPreviewInput(previewProps, composition)
        this.input.value = runtimeInput
        const artifactReader = {
          getArtifact: <TPayload>() => artifact as unknown as ProgramArtifact<TPayload>,
        }
        const runtime = this._scope.execute(model, {
          parent: composition?.host ?? null,
          artifactReader,
          meta: {
            mode: 'preview',
            target: 'dom',
            input: runtimeInput,
            i18nCatalog: composition?.host.getI18nCatalog() ?? {},
            vocabCatalog: composition?.host.getVocabCatalog() ?? {},
          },
        }) as ComponentSFCRuntimeHost | null
        if (!runtime || runtime.entityType !== 'component-sfc') {
          throw new Error('Не удалось создать SFC preview runtime.')
        }
        this._composition = composition
        this.runtime.value = runtime
      }
      catch (error) {
        await destroyComponentPreviewContext(composition)
        throw error
      }
    })
  }

  public dispose(): Promise<void> {
    return this._serialize(() => this._disposeRuntime())
  }

  private async _disposeRuntime(): Promise<void> {
    const runtimeId = this.runtime.value?.id
    try {
      if (this._composition) {
        await destroyComponentPreviewContext(this._composition)
      }
      else if (runtimeId) {
        await Endge.runtime.destroyRuntimeTreeAsync(runtimeId)
      }
    }
    finally {
      this._composition = null
      this.runtime.value = null
      this.input.value = { kind: 'local', props: {} }
      this._styleElement?.remove()
      this._styleElement = null
    }
  }

  private _applyPreviewStyle(style: EndgeStyleSheetArtifact | null): void {
    if (typeof document === 'undefined') {
      return
    }
    this._styleElement ??= document.createElement('style')
    this._styleElement.dataset.endgePreviewStyles = ''
    if (!this._styleElement.isConnected) {
      document.head.append(this._styleElement)
    }
    this._styleElement.textContent = style ? materializeEndgeCSSForDOM([style]).css : ''
  }

  private _serialize(operation: () => Promise<void>): Promise<void> {
    const result = this._queue.catch(() => undefined).then(operation)
    this._queue = result.catch(() => undefined)
    return result
  }
}

function resolvePreviewIdentity(input: SFCPreviewLaunchInput): string {
  const source = input.identity ?? input.id ?? input.name ?? input.displayName ?? 'draft'
  return String(source).trim() || 'draft'
}

export function createPreviewArtifact(model: RComponentSFC): ProgramArtifact<ComponentSFCProgramPayload> {
  const compiled = compileComponentSFC(model.source, {
    identity: model.identity,
    resolveComponentTag: tag => Endge.program.resolveComponentTag(tag),
    hasComponentIdentity: identity => Endge.domain.getComponentSFC(identity) != null || identity === model.identity,
    resolvePortProvider: (identity, expectedKind) => resolvePreviewPortProvider(identity, expectedKind),
    resolveComponentPortManifest: identity => Endge.program
      .getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
      ?.payload
      .ir
      ?.script
      .ports ?? null,
    resolveTypeDefinition: resolveEndgeTypeDefinition,
  })
  const { diagnostics, metadata, ...payload } = compiled
  const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error' && diagnostic.sourcePath !== 'style')

  return {
    ref: {
      entityType: 'component-sfc',
      id: model.id,
      identity: model.identity,
    },
    sourceHash: `preview:${Date.now()}`,
    compilerVersion: 'preview',
    status: hasErrors ? 'error' : diagnostics.length ? 'warning' : 'valid',
    diagnostics,
    dependencies: [],
    capabilities: compiled.ir ? ['compilable', 'runnable', 'renderable'] : ['compilable'],
    metadata,
    payload,
  }
}

function resolvePreviewPortProvider(identity: string, expectedKind: 'computation' | 'component' | 'action' | 'query') {
  const computation = Endge.domain.getComputation(identity)
  const component = Endge.domain.getComponentSFC(identity)
  const action = Endge.domain.getAction(identity)
  const query = Endge.domain.getQuery(identity)
  const target = expectedKind === 'computation'
    ? computation ?? component ?? action ?? query
    : expectedKind === 'component'
      ? component ?? computation ?? action ?? query
      : expectedKind === 'action'
        ? action ?? computation ?? component ?? query
        : query ?? action ?? computation ?? component
  if (target instanceof RComputation) {
    const payload = Endge.source.compile('computation', target.source).artifact as ComputationProgramPayload | undefined
    return {
      kind: 'computation' as const,
      identity: target.identity,
      active: target.active !== false && !target.deletedAt,
      input: previewFieldContract(payload?.input),
      output: previewFieldContract(payload?.output),
    }
  }
  if (target instanceof RComponentSFC) {
    const parsed = parseComponentSFC(target.source)
    return {
      kind: 'component' as const,
      identity: target.identity,
      active: target.active !== false && !target.deletedAt,
      inputs: analyzeComponentSFCScript(parsed.ast?.script ?? null).contract.inputs,
    }
  }
  if (target instanceof RAction) {
    return {
      kind: 'action' as const,
      identity: target.identity,
      active: target.active !== false && !target.deletedAt,
      input: previewFieldContract(target.contract.input),
      output: previewFieldContract(target.contract.output),
    }
  }
  if (target instanceof RQuery) {
    const payload = Endge.source.compile('query', target.source).artifact as QueryProgramPayload | undefined
    return {
      kind: 'query' as const,
      identity: target.identity,
      active: target.active !== false && !target.deletedAt,
      inputs: payload?.props.map(field => previewQueryFieldContract(field)) ?? [],
      outputs: payload?.outputs.map(output => previewQueryFieldContract(output.contract, output.key)) ?? [],
    }
  }
  return null
}

function previewFieldContract(field: unknown) {
  if (!field || typeof field !== 'object' || !('type' in field) || typeof field.type !== 'string') {
    return null
  }
  const contract = field as { type: string, isArray?: boolean, optional?: boolean }
  return {
    type: contract.type,
    isArray: contract.isArray === true,
    optional: contract.optional === true,
  }
}

function previewQueryFieldContract(
  field: { key?: string, type: string, array?: boolean, optional?: boolean } | null | undefined,
  fallbackName?: string,
) {
  return {
    name: String(field?.key ?? fallbackName ?? '').trim(),
    type: field?.type ?? 'Any',
    isArray: field?.array === true,
    optional: field?.optional === true,
  }
}

export function ensurePreviewPortArtifacts(
  payload: ComponentSFCProgramPayload,
  visited = new Set<string>(),
): void {
  for (const dependency of payload.dependencies.computations) {
    if (Endge.program.getComputationArtifact(dependency.id)) {
      continue
    }
    const model = Endge.domain.getComputation(dependency.id)
    if (model) {
      Endge.compiler.buildComputation(model)
    }
  }

  for (const dependency of payload.dependencies.components) {
    const identity = String(dependency.id)
    if (visited.has(identity)) {
      continue
    }
    visited.add(identity)
    let artifact = Endge.program.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
    if (!artifact) {
      const model = Endge.domain.getComponentSFC(identity)
      if (model) {
        artifact = Endge.compiler.buildComponentSFC(model)
      }
    }
    if (artifact && artifact.status !== 'error') {
      ensurePreviewPortArtifacts(artifact.payload, visited)
    }
  }
}
