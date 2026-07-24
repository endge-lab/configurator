import type { ComponentPreviewContext } from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import type {
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  EndgeStyleSheetArtifact,
  ProgramArtifact,
  RuntimeHostInputSource,
} from '@endge/core'

import {
  analyzeComponentSFCScript,
  compileComponentSFC,
  Endge,
  parseComponentSFC,
  RComponentSFC,
  RComputation,
} from '@endge/core'
import { materializeEndgeCSSForDOM } from '@endge/ui-vue'
import { computed, reactive, shallowRef } from 'vue'

import {
  destroyComponentPreviewContext,
  prepareComponentPreviewContext,
  resolveComponentPreviewInput,
} from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import {
  configuratorPreviewAppScope,
  configuratorPreviewMeta,
  destroyPreviewRuntime,
  resolvePreviewRuntime,
  serializePreviewLifecycle,
} from '@/features/endge-ide/model/preview-runtime/preview-runtime'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/model/types/type-definition-resolver'

export interface SFCPreviewLaunchInput {
  id?: string | number | null
  identity?: string | null
  tag?: string | null
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
let previewComposition: ComponentPreviewContext | null = null
let previewStyleElement: HTMLStyleElement | null = null

export async function launchSFCPreview(input: SFCPreviewLaunchInput): Promise<void> {
  await serializePreviewLifecycle('component-sfc', async () => {
    sfcPreviewError.value = null
    sfcPreviewTitle.value = input.displayName || input.name || input.identity || 'SFC preview'

    const model = RComponentSFC.fromPlain({
      id: input.id ?? `preview-${++runtimeCounter}`,
      identity: input.identity || `sfc-preview-${runtimeCounter}`,
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
    await disposeSFCPreviewRuntime()
    applyPreviewStyle(artifact.payload.ir?.style ?? null)
    await destroyPreviewRuntime('component-sfc', identity)
    const composition = await prepareComponentPreviewContext(
      artifact.payload.previewOptions,
      previewProps,
      input,
      {
        appScope: configuratorPreviewAppScope,
        meta: configuratorPreviewMeta(),
        resolveStoreRuntime: identity => resolvePreviewRuntime<{ id: string, entityType: string }>('store', identity),
        vocabDependencies: artifact.payload.runtimeDependencies?.vocabs ?? [],
      },
    )
    try {
      const runtimeInput = resolveComponentPreviewInput(previewProps, composition)
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
          i18nCatalog: composition?.host.getI18nCatalog() ?? {},
          vocabCatalog: composition?.host.getVocabCatalog() ?? {},
        },
      }) as ComponentSFCRuntimeHost | null
      if (!runtime || runtime.entityType !== 'component-sfc') {
        throw new Error('Не удалось создать SFC preview runtime.')
      }
      previewComposition = composition
      sfcPreviewRuntime.value = runtime
    }
    catch (error) {
      await destroyComponentPreviewContext(composition)
      throw error
    }
  })
}

export function destroySFCPreviewRuntime(): Promise<void> {
  return serializePreviewLifecycle('component-sfc', disposeSFCPreviewRuntime)
}

async function disposeSFCPreviewRuntime(): Promise<void> {
  const runtimeId = sfcPreviewRuntime.value?.id
  try {
    if (previewComposition) {
      await destroyComponentPreviewContext(previewComposition)
    }
    else if (runtimeId) {
      await Endge.runtime.destroyRuntimeTreeAsync(runtimeId)
    }
  }
  finally {
    previewComposition = null
    sfcPreviewRuntime.value = null
    sfcPreviewInput.value = { kind: 'local', props: {} }
    previewStyleElement?.remove()
    previewStyleElement = null
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
      ?.payload.ir?.script.ports ?? null,
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

function applyPreviewStyle(style: EndgeStyleSheetArtifact | null): void {
  if (typeof document === 'undefined') {
    return
  }
  previewStyleElement ??= document.createElement('style')
  previewStyleElement.dataset.endgePreviewStyles = ''
  if (!previewStyleElement.isConnected) {
    document.head.append(previewStyleElement)
  }
  previewStyleElement.textContent = style ? materializeEndgeCSSForDOM([style]).css : ''
}

function resolvePreviewPortProvider(identity: string, expectedKind: 'computation' | 'component') {
  const computation = Endge.domain.getComputation(identity)
  const component = Endge.domain.getComponentSFC(identity)
  const target = expectedKind === 'computation'
    ? computation ?? component
    : component ?? computation
  if (target instanceof RComputation) {
    return {
      kind: 'computation' as const,
      identity: target.identity,
      active: target.active !== false && !target.deletedAt,
      input: target.input ? { type: target.input.type, isArray: target.input.isArray, optional: target.input.optional } : null,
      output: target.output ? { type: target.output.type, isArray: target.output.isArray, optional: target.output.optional } : null,
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
  return null
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

export const sfcPreviewState = reactive({
  runtime: sfcPreviewRuntime,
  input: sfcPreviewInput,
  error: sfcPreviewError,
  title: sfcPreviewTitle,
  hasRuntime: hasSFCPreviewRuntime,
})
