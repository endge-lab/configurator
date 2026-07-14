import type { ProgramArtifact, ProgramDependency, ProgramDiagnostic, StoreRuntimeHost, StoreSourceArtifact } from '@endge/core'

import { createEmptyProgramMetadata, Endge, RStore } from '@endge/core'
import { computed, reactive, shallowRef } from 'vue'

import {
  configuratorPreviewAppScope,
  configuratorPreviewMeta,
  destroyPreviewRuntime,
} from '@/features/endge-ide/model/preview-runtime/preview-runtime'

export interface StorePreviewLaunchInput {
  id?: string | number | null
  identity?: string | null
  name?: string | null
  displayName?: string | null
  source: string
  sourceVersion?: number | null
}

export const storePreviewRuntime = shallowRef<StoreRuntimeHost | null>(null)
export const storePreviewError = shallowRef<string | null>(null)
export const hasStorePreviewRuntime = computed(() => Boolean(storePreviewRuntime.value))

/** Компилирует текущий Store draft и заменяет preview instance с тем же стабильным id. */
export async function launchStorePreview(input: StorePreviewLaunchInput): Promise<StoreRuntimeHost> {
  const identity = String(input.identity ?? '').trim()
  if (!identity) {
    throw new Error('Identity хранилища обязателен для запуска preview.')
  }

  storePreviewError.value = null
  const model = createPreviewStore(input, identity)
  const artifact = createPreviewStoreArtifact(model)
  if (artifact.status === 'error') {
    const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
      ?? 'Store source содержит ошибки.'
    throw new Error(message)
  }

  destroyPreviewRuntime('store', identity)
  const artifactReader = {
    getArtifact: <TPayload>() => artifact as unknown as ProgramArtifact<TPayload>,
  }
  const runtime = configuratorPreviewAppScope.execute(model, {
    artifactReader,
    meta: configuratorPreviewMeta(),
  }) as StoreRuntimeHost | null
  if (!runtime || runtime.entityType !== 'store') {
    throw new Error('Не удалось создать Store preview runtime.')
  }

  storePreviewRuntime.value = runtime
  return runtime
}

/** Останавливает активный Store preview, если он ещё зарегистрирован. */
export function destroyStorePreviewRuntime(): void {
  const runtimeId = storePreviewRuntime.value?.id
  if (runtimeId) {
    Endge.runtime.destroyRuntimeTree(runtimeId)
  }
  storePreviewRuntime.value = null
}

function createPreviewStore(input: StorePreviewLaunchInput, identity: string): RStore {
  const model = new RStore()
  model.id = (input.id ?? `${identity}-preview-model`) as any
  model.identity = identity
  model.name = input.name || input.displayName || identity
  model.displayName = input.displayName || input.name || identity
  model.source = input.source
  model.sourceVersion = Number(input.sourceVersion ?? 1) || 1
  return model
}

function createPreviewStoreArtifact(model: RStore): ProgramArtifact<StoreSourceArtifact> {
  const result = Endge.source.compile('store', model.source)
  const payload = result.artifact as StoreSourceArtifact | undefined
  const ref = { entityType: 'store' as const, id: model.id, identity: model.identity }
  const diagnostics = ((result.diagnostics ?? []) as Omit<ProgramDiagnostic, 'entityRef'>[])
    .map(item => ({ ...item, entityRef: ref }))
  const dependencies: ProgramDependency[] = []

  for (const field of payload?.data ?? []) {
    if (field.kind !== 'derived') {
      continue
    }
    for (const dataView of field.dataViews) {
      if (dataView.kind !== 'external') {
        continue
      }
      dependencies.push({
        entityType: 'data-view',
        id: dataView.identity,
        identity: dataView.identity,
        role: `store-derived:${field.key}`,
      })
      const dataViewModel = Endge.domain.getDataView(dataView.identity)
      const dataViewArtifact = Endge.program.getDataViewArtifact(dataView.identity)
        ?? (dataViewModel ? Endge.compiler.buildDataView(dataViewModel) : null)
      if (!dataViewArtifact || dataViewArtifact.status === 'error') {
        diagnostics.push({
          severity: 'error',
          code: 'store-data-view-invalid',
          message: `DataView "${dataView.identity}" отсутствует или содержит compile errors.`,
          sourcePath: `data.${field.key}`,
          entityRef: ref,
        })
      }
    }
  }

  const status = diagnostics.some(item => item.severity === 'error')
    ? 'error'
    : diagnostics.length ? 'warning' : 'valid'
  return {
    ref,
    sourceHash: `preview:${Date.now()}`,
    compilerVersion: 'configurator-preview',
    status,
    diagnostics,
    dependencies,
    capabilities: ['compilable', 'executable', 'data-provider'],
    metadata: createEmptyProgramMetadata(),
    payload: payload ?? { type: 'store', sourceVersion: model.sourceVersion, data: [] },
  }
}

export const storePreviewState = reactive({
  runtime: storePreviewRuntime,
  error: storePreviewError,
  hasRuntime: hasStorePreviewRuntime,
})
