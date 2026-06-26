import type { UIEditorLibraryGroup } from '@/features/endge-admin-ui-editor/types'

import { getUIEditorBaseLibraryGroups } from '@/features/endge-admin-ui-editor/entities/ui-editor-base-library'
import { getUIEditorComponentLibraryGroups } from '@/features/endge-admin-ui-editor/entities/ui-editor-components-library'

export function buildUIEditorLibraryGroups(): UIEditorLibraryGroup[] {
  return getUIEditorBaseLibraryGroups()
    .filter(group => group.items.length > 0)
}

export function buildUIEditorComponentLibraryGroups(): UIEditorLibraryGroup[] {
  return getUIEditorComponentLibraryGroups()
    .filter(group => group.items.length > 0)
}
