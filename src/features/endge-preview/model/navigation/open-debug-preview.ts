import type { EndgePreviewEntityType } from '@/features/endge-preview/domain/types/preview.types'
import type { Router } from 'vue-router'

/** Opens a persisted domain entity in the standalone Debug Preview surface. */
export function openEndgeDebugPreview(
  router: Router,
  entityType: EndgePreviewEntityType,
  identity: string | null | undefined,
): Window | null {
  const normalizedIdentity = String(identity ?? '').trim()
  if (!normalizedIdentity) {
    return null
  }

  const href = router.resolve({
    name: 'endge-preview',
    params: { entityType, identity: normalizedIdentity },
  }).href

  return window.open(href, '_blank', 'noopener,noreferrer')
}
