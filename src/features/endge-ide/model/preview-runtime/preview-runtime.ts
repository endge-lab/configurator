import type { RuntimeEntityType } from '@endge/core'

import { Endge } from '@endge/core'

export const CONFIGURATOR_PREVIEW_SCOPE = 'configurator'

/** Строит стабильный runtime-id preview instance из типа и реального identity. */
export function makePreviewRuntimeId(entityType: RuntimeEntityType, identity: string): string {
  const normalizedIdentity = String(identity ?? '').trim()
  if (!normalizedIdentity) {
    throw new Error('Identity is required for preview runtime.')
  }
  return `${entityType}:${normalizedIdentity}-preview`
}

/** Удаляет предыдущий preview runtime tree перед запуском новой версии draft. */
export function destroyPreviewRuntime(entityType: RuntimeEntityType, identity: string): string {
  const runtimeId = makePreviewRuntimeId(entityType, identity)
  Endge.runtime.destroyRuntimeTree(runtimeId)
  return runtimeId
}

/** Единая metadata всех preview runtimes Configurator. */
export function configuratorPreviewMeta(): Record<string, unknown> {
  return {
    mode: 'preview',
    previewScope: CONFIGURATOR_PREVIEW_SCOPE,
    persistence: 'disabled',
  }
}
