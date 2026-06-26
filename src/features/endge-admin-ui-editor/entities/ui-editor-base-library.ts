import type {
  UIEditorLibraryGroup,
  UIEditorLibraryItem,
} from '@/features/endge-admin-ui-editor/types'

import {
  Endge,
} from '@endge/core'

function createLibraryItem(definitionRef: string): UIEditorLibraryItem {
  const definition = Endge.uiRegistry.listDefinitions({ includeSystem: true })
    .find(item => item.id === definitionRef)

  if (!definition || definition.primitiveKind === 'page') {
    throw new Error(`[UIEditorBaseLibrary] unknown palette definition: ${definitionRef}`)
  }

  return {
    id: definition.id,
    source: 'definition',
    section: 'definitions',
    folder: definition.groupId,
    definitionRef: definition.id,
    label: definition.title,
    description: definition.description,
    kind: definition.primitiveKind,
    accentClass: definition.canvasAccentClass,
    configKind: definition.configKind ?? null,
    keywords: definition.keywords,
    layoutPatch: Endge.uiRegistry.getDefinitionDefaultLayout(definition.id),
    propsPatch: Endge.uiRegistry.getDefinitionDefaultProps(definition.id),
    sourceLabel: definition.title,
  }
}

export function getUIEditorBaseLibraryGroups(): UIEditorLibraryGroup[] {
  const definitions = Endge.uiRegistry.listDefinitions({ paletteOnly: true })

  return Endge.uiRegistry.listDefinitionGroups().map((group): UIEditorLibraryGroup => ({
    id: group.id,
    title: group.title,
    description: group.description,
    items: definitions
      .filter(definition => definition.groupId === group.id && definition.primitiveKind !== 'page')
      .map(definition => createLibraryItem(definition.id)),
  }))
}
