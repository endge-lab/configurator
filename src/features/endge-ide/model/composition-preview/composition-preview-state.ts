import type {
  ComponentSFCRuntimeHost,
  CompositionPreviewLiteral,
  CompositionPreviewPropValue,
  CompositionProgramPayload,
  CompositionRuntimeHost,
  FilterViewRuntimeHost,
  RuntimeHostInputSource,
  StoreRuntimeHost,
} from '@endge/core'

import { Endge, materializeCompositionPreviewProps, RComposition } from '@endge/core'
import { computed, shallowRef } from 'vue'

import {
  generateCompositionRuntimePreviewSource,
} from '@/features/endge-ide/model/composition-runtime-props/composition-runtime-props'

export interface CompositionPreviewLaunchInput {
  id?: string | number | null
  identity?: string | null
  name?: string | null
  displayName?: string | null
  source: string
  sourceVersion?: number | null
}

export type CompositionPreviewRenderable
  = | {
    kind: 'filter-view'
    key: string
    title: string
    runtime: FilterViewRuntimeHost
  }
  | {
    kind: 'component-sfc'
    key: string
    title: string
    runtime: ComponentSFCRuntimeHost
    input: RuntimeHostInputSource
  }

/** Owns one legacy standalone Composition preview and its runtime resources. */
export class CompositionPreviewSession {
  public readonly runtime = shallowRef<CompositionRuntimeHost | null>(null)
  public readonly error = shallowRef<string | null>(null)
  public readonly title = shallowRef('Composition preview')
  public readonly hasRuntime = computed(() => Boolean(this.runtime.value))
  public readonly renderables = computed<CompositionPreviewRenderable[]>(() => {
    const host = this.runtime.value
    if (!host) {
      return []
    }

    const renderables: CompositionPreviewRenderable[] = []
    for (const child of host.getChildren()) {
      if (!child.runtime.hasCapability('renderable')) {
        continue
      }

      if (child.runtime.runtimeType === 'filter-view-runtime-host') {
        const runtime = child.runtime as unknown as FilterViewRuntimeHost
        renderables.push({
          kind: 'filter-view',
          key: child.name,
          title: child.name,
          runtime,
        })
        continue
      }

      if (child.runtime.entityType !== 'component-sfc') {
        continue
      }
      const runtime = child.runtime as unknown as ComponentSFCRuntimeHost
      renderables.push({
        kind: 'component-sfc',
        key: child.name,
        title: runtime.title,
        runtime,
        input: runtime.getInputSource() ?? { kind: 'local', props: {} },
      })
    }
    return renderables
  })

  private readonly _scope = Endge.runtime.createAppScope({
    id: 'configurator-composition-preview',
    rootPath: 'runtime-preview.composition',
    collisionPolicy: 'replace',
    persistence: 'disabled',
  })

  private _queue: Promise<void> = Promise.resolve()

  public launch(input: CompositionPreviewLaunchInput): Promise<void> {
    return this._serialize(async () => {
      this.error.value = null
      this.title.value = input.displayName || input.name || input.identity || 'Composition preview'

      await Endge.build()
      ensureCompositionRuntimeArtifacts(
        input.source,
        new Set(input.identity ? [input.identity] : []),
      )

      const model = createPreviewComposition({
        ...input,
        source: materializeCompositionRuntimePreviewSource(input.source),
      })
      const artifact = Endge.compiler.buildComposition(model)
      if (artifact.status === 'error') {
        const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
          ?? 'Composition source содержит ошибки.'
        throw new Error(message)
      }

      await this._disposeRuntime()
      await this._scope.destroyAsync('composition', model.identity)
      const dataRuntimes = resolvePreviewStoreRuntimes(
        artifact.payload.data,
        identity => this._scope.resolve<StoreRuntimeHost>('store', identity),
      )
      const props = materializeCompositionPreviewProps(
        artifact.payload.previewProps,
        artifact.payload.dataMode ?? Endge.context.dataMode,
      )
      const runtime = this._scope.execute(model, {
        meta: {
          mode: 'preview',
          dataRuntimes,
          input: { kind: 'local', props },
        },
      }) as CompositionRuntimeHost | null
      if (!runtime || runtime.entityType !== 'composition') {
        throw new Error('Не удалось создать runtime композиции.')
      }

      try {
        await runtime.mountGraph()
      }
      catch (error) {
        await Endge.runtime.destroyRuntimeTreeAsync(runtime.id)
        throw error
      }
      this.runtime.value = runtime
    })
  }

  public dispose(): Promise<void> {
    return this._serialize(() => this._disposeRuntime())
  }

  private async _disposeRuntime(): Promise<void> {
    const runtimeId = this.runtime.value?.id
    try {
      if (runtimeId) {
        await Endge.runtime.destroyRuntimeTreeAsync(runtimeId)
      }
    }
    finally {
      this.runtime.value = null
    }
  }

  private _serialize(operation: () => Promise<void>): Promise<void> {
    const result = this._queue.catch(() => undefined).then(operation)
    this._queue = result.catch(() => undefined)
    return result
  }
}

export function createPreviewComposition(input: CompositionPreviewLaunchInput): RComposition {
  const identity = input.identity || 'composition-preview'
  const model = new RComposition()
  model.id = (input.id ?? `${identity}-model`) as any
  model.identity = identity
  model.name = input.name || input.displayName || input.identity || 'Composition preview'
  model.displayName = input.displayName || input.name || input.identity || 'Composition preview'
  model.source = input.source
  model.sourceVersion = Number(input.sourceVersion ?? 1) || 1
  return model
}

/** Достраивает runtime dependencies Composition в dependency-first порядке для preview. */
export function ensureCompositionRuntimeArtifacts(source: string, visiting = new Set<string>()): void {
  const result = Endge.source.compile('composition', source)
  const payload = result.artifact
  if (!payload) {
    return
  }

  for (const data of payload.data) {
    if (data.kind !== 'store') {
      continue
    }
    const model = Endge.domain.getStore(data.identity)
    if (model && !Endge.program.getStoreArtifact(data.identity)) {
      Endge.compiler.buildStore(model)
    }
  }

  for (const runtime of payload.runtimes) {
    if (runtime.kind === 'filter') {
      const model = Endge.domain.getFilter(runtime.identity)
      if (model && !Endge.program.getFilterArtifact(runtime.identity)) {
        Endge.compiler.buildFilter(model)
      }
      continue
    }

    if (runtime.kind === 'query') {
      const model = Endge.domain.getQuery(runtime.identity)
      if (model && !Endge.program.getQueryArtifact(runtime.identity)) {
        Endge.compiler.buildQuery(model)
      }
      continue
    }

    if (runtime.kind === 'composition') {
      if (visiting.has(runtime.identity)) {
        continue
      }
      const model = Endge.domain.getComposition(runtime.identity)
      if (!model) {
        continue
      }

      visiting.add(runtime.identity)
      ensureCompositionRuntimeArtifacts(model.source, visiting)
      visiting.delete(runtime.identity)

      const artifact = Endge.program.getCompositionArtifact(runtime.identity)
      if (!artifact || artifact.status === 'error') {
        const previewSource = materializeCompositionRuntimePreviewSource(model.source)
        Endge.compiler.buildComposition(previewSource === model.source
          ? model
          : createPreviewComposition({
              id: model.id,
              identity: model.identity,
              name: model.name,
              displayName: model.displayName,
              source: previewSource,
              sourceVersion: model.sourceVersion,
            }))
      }
    }
  }
}

/** Подставляет child definePreviewProps только в transient source, используемый preview runtime. */
export function materializeCompositionRuntimePreviewSource(source: string): string {
  return generateCompositionRuntimePreviewSource(
    source,
    compileCompositionSource,
    resolveCompositionContract,
    materializePreviewValue,
  )
}

function compileCompositionSource(source: string): CompositionProgramPayload | null {
  return (Endge.source.compile('composition', source).artifact as CompositionProgramPayload | undefined) ?? null
}

function resolveCompositionContract(identity: string): CompositionProgramPayload | null {
  const compiled = Endge.program.getCompositionArtifact(identity)?.payload
  if (compiled) {
    return compiled
  }

  const model = Endge.domain.getComposition(identity)
  return model ? compileCompositionSource(model.source) : null
}

function materializePreviewValue(value: CompositionPreviewPropValue): CompositionPreviewLiteral | undefined {
  if (value.kind === 'literal') {
    return value.value
  }
  if (!Endge.context.isMockEnabled) {
    return undefined
  }
  if (!Endge.mock.has(value.identity)) {
    return undefined
  }

  try {
    return Endge.mock.get<CompositionPreviewLiteral>(value.identity)
  }
  catch {
    return undefined
  }
}

export function resolvePreviewStoreRuntimes(
  data: Array<{ name: string, kind: 'store' | 'vocab', identity: string }>,
  resolveStoreRuntime: (identity: string) => { id: string, entityType: string } | null = (identity) => {
    const hosts = Endge.runtime.getRuntimeHostsByEntity('store', identity)
    return hosts.find(host => host.meta.scopeRoot === true) ?? hosts[0] ?? null
  },
): Record<string, string> {
  const runtimes: Record<string, string> = {}
  for (const descriptor of data) {
    if (descriptor.kind !== 'store') {
      continue
    }
    const runtime = resolveStoreRuntime(descriptor.identity)
    if (runtime?.entityType === 'store') {
      runtimes[descriptor.name] = runtime.id
    }
  }
  return runtimes
}
