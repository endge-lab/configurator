import type {
  ComponentSFCPreviewOptions,
  ComponentSFCPreviewProps,
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  ProgramArtifact,
  RuntimeHostInputSource,
} from '@endge/core'

import {
  compileComponentSFC,
  Endge,
  RComponentSFC,
  RComposition,
} from '@endge/core'
import { Raph } from '@endge/raph'
import { computed, reactive, shallowRef } from 'vue'

import {
  configuratorPreviewAppScope,
  configuratorPreviewMeta,
  destroyPreviewRuntime,
  resolvePreviewRuntime,
} from '@/features/endge-ide/model/preview-runtime/preview-runtime'

export interface SFCPreviewLaunchInput {
  id?: string | number | null
  identity?: string | null
  name?: string | null
  displayName?: string | null
  source: string
}

export const sfcPreviewRuntime = shallowRef<ComponentSFCRuntimeHost | null>(null)
export const sfcPreviewInput = shallowRef<RuntimeHostInputSource>({ kind: 'local', props: {} })
export const sfcPreviewError = shallowRef<string | null>(null)
export const sfcPreviewTitle = shallowRef('SFC preview')
export const hasSFCPreviewRuntime = computed(() => Boolean(sfcPreviewRuntime.value))

let runtimeCounter = 0
let previewComposition: PreviewCompositionContext | null = null

interface PreviewCompositionContext {
  host: CompositionRuntimeHost
  dataAliases: Map<string, string>
}

export async function launchSFCPreview(input: SFCPreviewLaunchInput): Promise<void> {
  sfcPreviewError.value = null
  sfcPreviewTitle.value = input.displayName || input.name || input.identity || 'SFC preview'

  const model = RComponentSFC.fromPlain({
    id: input.id ?? `preview-${++runtimeCounter}`,
    identity: input.identity || `sfc-preview-${runtimeCounter}`,
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
  destroySFCPreviewRuntime()
  destroyPreviewRuntime('component-sfc', identity)
  const composition = await applyPreviewOptions(artifact.payload.previewOptions, previewProps, input)
  try {
    const runtimeInput = resolvePreviewInput(previewProps, composition)
    sfcPreviewInput.value = runtimeInput
    const artifactReader = {
      getArtifact: <TPayload>() => artifact as unknown as ProgramArtifact<TPayload>,
    }
    const runtime = configuratorPreviewAppScope.execute(model, {
      parent: composition?.host ?? null,
      artifactReader,
      meta: {
        ...configuratorPreviewMeta(),
        target: 'dom',
        input: runtimeInput,
      },
    }) as ComponentSFCRuntimeHost | null
    if (!runtime || runtime.entityType !== 'component-sfc') {
      throw new Error('Не удалось создать SFC preview runtime.')
    }
    previewComposition = composition
    sfcPreviewRuntime.value = runtime
  }
  catch (error) {
    destroyPreviewComposition(composition)
    throw error
  }
}

export function destroySFCPreviewRuntime(): void {
  const runtimeId = sfcPreviewRuntime.value?.id
  if (previewComposition) {
    destroyPreviewComposition(previewComposition)
  }
  else if (runtimeId) {
    Endge.runtime.destroyRuntimeTree(runtimeId)
  }
  previewComposition = null
  sfcPreviewRuntime.value = null
  sfcPreviewInput.value = { kind: 'local', props: {} }
}

function resolvePreviewIdentity(input: SFCPreviewLaunchInput): string {
  const source = input.identity ?? input.id ?? input.name ?? input.displayName ?? 'draft'
  return String(source).trim() || 'draft'
}

function createPreviewArtifact(model: RComponentSFC): ProgramArtifact<ComponentSFCProgramPayload> {
  const compiled = compileComponentSFC(model.source)
  const { diagnostics, metadata, ...payload } = compiled
  const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error')

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
    capabilities: ['compilable', 'runnable', 'renderable'],
    metadata,
    payload,
  }
}

async function applyPreviewOptions(
  options: ComponentSFCPreviewOptions | null,
  props: ComponentSFCPreviewProps,
  input: SFCPreviewLaunchInput,
): Promise<PreviewCompositionContext | null> {
  for (const [path, value] of Object.entries(options?.seed ?? {})) {
    Raph.set(path, clonePreviewValue(value))
  }

  await ensurePreviewQueryArtifacts(options)

  const storeIdentities = new Set<string>()
  for (const value of Object.values(props)) {
    if (isDataPreviewProp(value)) {
      storeIdentities.add(value.store)
    }
  }
  for (const target of options?.run ?? []) {
    if (target.storeTo) {
      storeIdentities.add(target.storeTo.store)
    }
  }
  const targets = options?.run ?? []
  if (!storeIdentities.size && !targets.length) {
    return null
  }

  const dataAliases = new Map<string, string>()
  Array.from(storeIdentities).forEach((identity, index) => dataAliases.set(identity, `store${index}`))
  const model = createPreviewComposition(input, dataAliases, targets)
  const artifact = Endge.compiler.buildComposition(model)
  if (artifact.status === 'error') {
    const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
      ?? 'Не удалось собрать preview composition.'
    throw new Error(message)
  }

  const host = configuratorPreviewAppScope.execute(model, {
    meta: {
      ...configuratorPreviewMeta(),
      dataRuntimes: resolvePreviewStoreRuntimes(dataAliases),
    },
  }) as CompositionRuntimeHost | null
  if (!host || host.entityType !== 'composition') {
    throw new Error('Не удалось создать preview composition runtime.')
  }
  try {
    await host.mountGraph()
  }
  catch (error) {
    Endge.runtime.destroyRuntimeTree(host.id)
    throw error
  }
  return { host, dataAliases }
}

function resolvePreviewStoreRuntimes(dataAliases: Map<string, string>): Record<string, string> {
  const runtimes: Record<string, string> = {}
  for (const [identity, alias] of dataAliases) {
    const runtime = resolvePreviewRuntime<{ id: string, entityType: string }>('store', identity)
    if (runtime?.entityType === 'store') {
      runtimes[alias] = runtime.id
    }
  }
  return runtimes
}

async function ensurePreviewQueryArtifacts(options: ComponentSFCPreviewOptions | null): Promise<void> {
  const queryTargets = options?.run?.filter(target => target.type === 'query') ?? []
  if (!queryTargets.length) {
    return
  }

  try {
    await Endge.build()
  }
  catch {
    // Preview still tries to compile the requested queries directly below.
  }

  for (const target of queryTargets) {
    const query = Endge.domain.getQuery(target.identity)
    if (!query) {
      throw new Error(`Preview query not found: "${target.identity}".`)
    }

    const idOrIdentity = query.id ?? query.identity
    if (Endge.program.getQueryArtifact(idOrIdentity)) {
      continue
    }

    Endge.compiler.buildQuery(query)
  }
}

function resolvePreviewInput(
  previewProps: ComponentSFCPreviewProps,
  composition: PreviewCompositionContext | null,
): RuntimeHostInputSource {
  const bindings: Record<string, { path: string, wildcardDynamic: true }> = {}
  const localProps: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(previewProps)) {
    if (isStorePreviewProp(value)) {
      bindings[key] = {
        path: value.path,
        wildcardDynamic: true,
      }
      continue
    }
    if (isDataPreviewProp(value)) {
      const alias = composition?.dataAliases.get(value.store)
      if (!alias || !composition) {
        throw new Error(`Preview Store not mounted: "${value.store}".`)
      }
      bindings[key] = {
        path: composition.host.getDataPath(alias, value.path),
        wildcardDynamic: true,
      }
      continue
    }

    localProps[key] = clonePreviewValue(value)
  }

  if (Object.keys(bindings).length === 0) {
    return { kind: 'local', props: localProps }
  }

  for (const [key, value] of Object.entries(localProps)) {
    const path = `preview.sfc.props.${key}`
    Raph.set(path, value)
    bindings[key] = {
      path,
      wildcardDynamic: true,
    }
  }

  return {
    kind: 'raph',
    bindings,
  }
}

function createPreviewComposition(
  input: SFCPreviewLaunchInput,
  dataAliases: Map<string, string>,
  targets: NonNullable<ComponentSFCPreviewOptions['run']>,
): RComposition {
  const data = Array.from(dataAliases.entries())
    .map(([identity, alias]) => `${alias}: store(${JSON.stringify(identity)})`)
    .join(',\n    ')
  const runtimes = targets.map((target, index) => {
    const publication = target.storeTo
      ? `.storeTo(data(${JSON.stringify(dataAliases.get(target.storeTo.store))}), ${serializeStoreMapping(target.storeTo.fields)})`
      : ''
    return `query${index}: query(${JSON.stringify(target.identity)})${publication}`
  }).join(',\n    ')
  const hooks = targets.map((_, index) => `onMount().run('query${index}')`).join(',\n    ')
  const model = new RComposition()
  model.id = `${resolvePreviewIdentity(input)}-sfc-context-model` as any
  model.identity = `${resolvePreviewIdentity(input)}-sfc-context`
  model.name = 'SFC preview composition'
  model.displayName = 'SFC preview composition'
  model.source = `defineComposition({
  data: {
    ${data}
  },
  runtimes: {
    ${runtimes}
  },
  hooks: [
    ${hooks}
  ],
})`
  return model
}

function serializeStoreMapping(fields: Record<string, string>): string {
  return `{ ${Object.entries(fields)
    .map(([target, output]) => `${JSON.stringify(target)}: output(${JSON.stringify(output)})`)
    .join(', ')} }`
}

function destroyPreviewComposition(context: PreviewCompositionContext | null): void {
  if (context && Endge.runtime.getRuntimeById(context.host.id)) {
    Endge.runtime.destroyRuntimeTree(context.host.id)
  }
}

function isStorePreviewProp(value: unknown): value is { type: 'store', path: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'store'
    && typeof (value as { path?: unknown }).path === 'string',
  )
}

function isDataPreviewProp(value: unknown): value is { type: 'data', store: string, path: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'data'
    && typeof (value as { store?: unknown }).store === 'string'
    && typeof (value as { path?: unknown }).path === 'string',
  )
}

function clonePreviewValue(value: unknown): unknown {
  if (value == null) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  }
  catch {
    return value
  }
}

export const sfcPreviewState = reactive({
  runtime: sfcPreviewRuntime,
  input: sfcPreviewInput,
  error: sfcPreviewError,
  title: sfcPreviewTitle,
  hasRuntime: hasSFCPreviewRuntime,
})
