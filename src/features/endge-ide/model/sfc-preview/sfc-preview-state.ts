import type {
  ComponentSFCPreviewOptions,
  ComponentSFCPreviewProps,
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  ProgramArtifact,
  RuntimeHostInputSource,
} from '@endge/core'

import { Raph } from '@endge/raph'
import {
  ComponentSFCRuntimeHost as EndgeComponentSFCRuntimeHost,
  Endge,
  RComponentSFC,
  compileComponentSFC,
} from '@endge/core'
import { computed, reactive, shallowRef } from 'vue'

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

export async function launchSFCPreview(input: SFCPreviewLaunchInput): Promise<void> {
  destroySFCPreviewRuntime()
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

  await applyPreviewOptions(artifact.payload.previewOptions)

  const runtimeInput = resolvePreviewInput(previewProps)
  sfcPreviewInput.value = runtimeInput
  sfcPreviewRuntime.value = EndgeComponentSFCRuntimeHost.createRuntime({
    id: `sfc-preview-${++runtimeCounter}`,
    model,
    meta: {
      target: 'dom',
      input: runtimeInput,
    },
    artifactReader: {
      getArtifact: () => artifact,
    },
  })
}

export function destroySFCPreviewRuntime(): void {
  sfcPreviewRuntime.value?.destroy()
  sfcPreviewRuntime.value = null
  sfcPreviewInput.value = { kind: 'local', props: {} }
}

function createPreviewArtifact(model: RComponentSFC): ProgramArtifact<ComponentSFCProgramPayload> {
  const payload = compileComponentSFC(model.source)
  const hasErrors = payload.diagnostics.some(diagnostic => diagnostic.severity === 'error')

  return {
    ref: {
      entityType: 'component-sfc',
      id: model.id,
      identity: model.identity,
    },
    sourceHash: `preview:${Date.now()}`,
    compilerVersion: 'preview',
    status: hasErrors ? 'error' : payload.diagnostics.length ? 'warning' : 'valid',
    diagnostics: payload.diagnostics,
    dependencies: [],
    capabilities: ['compilable', 'runnable', 'renderable'],
    payload,
  }
}

async function applyPreviewOptions(options: ComponentSFCPreviewOptions | null): Promise<void> {
  for (const [path, value] of Object.entries(options?.seed ?? {}))
    Raph.set(path, clonePreviewValue(value))

  await ensurePreviewQueryArtifacts(options)

  for (const target of options?.run ?? []) {
    if (target.type === 'query') {
      const query = Endge.domain.getQuery(target.identity)
      if (!query)
        throw new Error(`Preview query not found: "${target.identity}".`)

      await Endge.query.run(query, {})
    }
  }
}

async function ensurePreviewQueryArtifacts(options: ComponentSFCPreviewOptions | null): Promise<void> {
  const queryTargets = options?.run?.filter(target => target.type === 'query') ?? []
  if (!queryTargets.length)
    return

  try {
    await Endge.build()
  }
  catch {
    // Preview still tries to compile the requested queries directly below.
  }

  for (const target of queryTargets) {
    const query = Endge.domain.getQuery(target.identity)
    if (!query)
      throw new Error(`Preview query not found: "${target.identity}".`)

    const idOrIdentity = query.id ?? query.identity
    if (Endge.program.getQueryArtifact(idOrIdentity))
      continue

    Endge.compiler.buildQuery(query)
  }
}

function resolvePreviewInput(previewProps: ComponentSFCPreviewProps): RuntimeHostInputSource {
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

    localProps[key] = clonePreviewValue(value)
  }

  if (Object.keys(bindings).length === 0)
    return { kind: 'local', props: localProps }

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

function isStorePreviewProp(value: unknown): value is { type: 'store', path: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'store'
    && typeof (value as { path?: unknown }).path === 'string',
  )
}

function clonePreviewValue(value: unknown): unknown {
  if (value == null)
    return value

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
