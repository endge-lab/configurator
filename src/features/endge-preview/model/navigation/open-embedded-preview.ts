import type { EndgePreviewEntityType, EndgePreviewTarget } from '@/features/endge-preview/domain/types/preview.types'

import { shallowRef } from 'vue'

import { showWidget } from '@/components/layouts/grid'
import { ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-preview/config/constants'

export const embeddedEndgePreviewTarget = shallowRef<EndgePreviewTarget | null>(null)

/** Selects a persisted entity and opens Runtime Tree inside the current Configurator workspace. */
export function openEndgeEmbeddedPreview(
  entityType: EndgePreviewEntityType,
  identity: string | null | undefined,
): boolean {
  const normalizedIdentity = String(identity ?? '').trim()
  if (!normalizedIdentity) {
    return false
  }

  embeddedEndgePreviewTarget.value = { entityType, identity: normalizedIdentity }
  showWidget(ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID)
  return true
}
