import type {
  UIEditorLibraryGroup,
  UIEditorLibraryItem,
} from '@/features/endge-admin-ui-editor/types'

import { UI_EDITOR_SFC_DEFINITION_CONTRACTS } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

function createLibraryItem(
  contract: typeof UI_EDITOR_SFC_DEFINITION_CONTRACTS[number],
): UIEditorLibraryItem {
  return {
    id: contract.definitionRef,
    source: 'definition',
    section: 'definitions',
    folder: contract.groupId,
    definitionRef: contract.definitionRef,
    label: contract.label,
    description: contract.description,
    kind: contract.kind,
    accentClass: contract.accentClass,
    configKind: null,
    keywords: contract.keywords,
    layoutPatch: { ...contract.defaultLayout },
    propsPatch: { ...contract.defaultProps },
    sourceLabel: contract.label,
  }
}

export function getUIEditorBaseLibraryGroups(): UIEditorLibraryGroup[] {
  const groups = new Map<string, UIEditorLibraryGroup>()

  for (const contract of UI_EDITOR_SFC_DEFINITION_CONTRACTS) {
    const group = groups.get(contract.groupId) ?? {
      id: contract.groupId,
      title: contract.groupTitle,
      description: contract.groupDescription,
      items: [],
    }
    group.items.push(createLibraryItem(contract))
    groups.set(contract.groupId, group)
  }

  return [...groups.values()]
}
