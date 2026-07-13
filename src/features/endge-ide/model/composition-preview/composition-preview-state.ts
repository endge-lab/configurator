import type {
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  FilterViewRuntimeHost,
  RuntimeHostInputSource,
} from '@endge/core'

import { Endge, RComposition } from '@endge/core'
import { computed, reactive, shallowRef } from 'vue'

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

export const compositionPreviewRuntime = shallowRef<CompositionRuntimeHost | null>(null)
export const compositionPreviewError = shallowRef<string | null>(null)
export const compositionPreviewTitle = shallowRef('Composition preview')
export const hasCompositionPreviewRuntime = computed(() => Boolean(compositionPreviewRuntime.value))
export const compositionPreviewRenderables = computed<CompositionPreviewRenderable[]>(() => {
  const host = compositionPreviewRuntime.value
  if (!host)
    return []

  const renderables: CompositionPreviewRenderable[] = []
  for (const child of host.getChildren()) {
    if (!child.runtime.hasCapability('renderable'))
      continue

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

    if (child.runtime.entityType !== 'component-sfc')
      continue
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

let runtimeCounter = 0

export async function launchCompositionPreview(input: CompositionPreviewLaunchInput): Promise<void> {
  destroyCompositionPreviewRuntime()
  compositionPreviewError.value = null
  compositionPreviewTitle.value = input.displayName || input.name || input.identity || 'Composition preview'

  await Endge.build()
  ensureCompositionRuntimeArtifacts(input.source)

  const model = createPreviewComposition(input)
  const artifact = Endge.compiler.buildComposition(model)
  if (artifact.status === 'error') {
    const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
      ?? 'Composition source содержит ошибки.'
    throw new Error(message)
  }

  const runtime = Endge.runtime.execute(model, {
    id: resolvePreviewRuntimeId(input),
    persistence: 'disabled',
  }) as CompositionRuntimeHost | null
  if (!runtime || runtime.entityType !== 'composition')
    throw new Error('Не удалось создать runtime композиции.')

  try {
    await runtime.mountGraph()
  }
  catch (error) {
    Endge.runtime.destroyRuntimeTree(runtime.id)
    throw error
  }
  compositionPreviewRuntime.value = runtime
  logCompositionPreviewOutputs(runtime)
}

export function destroyCompositionPreviewRuntime(): void {
  const runtimeId = compositionPreviewRuntime.value?.id
  if (runtimeId)
    Endge.runtime.destroyRuntimeTree(runtimeId)
  compositionPreviewRuntime.value = null
}

function createPreviewComposition(input: CompositionPreviewLaunchInput): RComposition {
  const model = new RComposition()
  model.id = (input.id ?? `composition-preview-${++runtimeCounter}`) as any
  model.identity = input.identity || `composition-preview-${runtimeCounter}`
  model.name = input.name || input.displayName || input.identity || 'Composition preview'
  model.displayName = input.displayName || input.name || input.identity || 'Composition preview'
  model.source = input.source
  model.sourceVersion = Number(input.sourceVersion ?? 1) || 1
  return model
}

function resolvePreviewRuntimeId(input: CompositionPreviewLaunchInput): string {
  const source = input.identity ?? input.id ?? input.name ?? input.displayName ?? 'draft'
  const normalized = String(source).trim() || 'draft'
  return `composition-preview:${normalized}`
}

function ensureCompositionRuntimeArtifacts(source: string): void {
  const result = Endge.source.compile('composition', source)
  const payload = result.artifact
  if (!payload)
    return

  for (const runtime of payload.runtimes) {
    if (runtime.kind === 'filter') {
      const model = Endge.domain.getFilter(runtime.identity)
      if (model && !Endge.program.getFilterArtifact(runtime.identity))
        Endge.compiler.buildFilter(model)
      continue
    }

    if (runtime.kind === 'query') {
      const model = Endge.domain.getQuery(runtime.identity)
      if (model && !Endge.program.getQueryArtifact(runtime.identity))
        Endge.compiler.buildQuery(model)
    }
  }
}

function logCompositionPreviewOutputs(runtime: CompositionRuntimeHost): void {
  const outputs = Object.fromEntries(
    Object.entries(runtime.getOutputs()).map(([key, handle]) => [
      key,
      readCompositionPreviewOutput(handle),
    ]),
  )

  // eslint-disable-next-line no-console
  console.groupCollapsed(`[Composition_Editor] Outputs: ${runtime.entityIdentity}`)
  for (const [key, value] of Object.entries(outputs)) {
    // eslint-disable-next-line no-console
    console.log(key, value)
  }
  // eslint-disable-next-line no-console
  console.log('all', outputs)
  // eslint-disable-next-line no-console
  console.groupEnd()
}

function readCompositionPreviewOutput(
  handle: ReturnType<CompositionRuntimeHost['getOutputs']>[string],
): unknown {
  const runtime = handle.runtime as typeof handle.runtime & {
    getOutput?: (name: string) => unknown
    getOutputs?: () => Readonly<Record<string, unknown>>
  }

  if (handle.output) {
    return runtime.getOutput?.(handle.output)
  }
  if (typeof runtime.getOutputs === 'function') {
    return runtime.getOutputs()
  }
  return runtime
}

export const compositionPreviewState = reactive({
  runtime: compositionPreviewRuntime,
  error: compositionPreviewError,
  title: compositionPreviewTitle,
  hasRuntime: hasCompositionPreviewRuntime,
  renderables: compositionPreviewRenderables,
})
