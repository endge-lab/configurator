import type {
  UIEditorLibraryGroup,
  UIEditorLibraryItem,
  UIEditorNodeKind,
} from '@/features/endge-admin-ui-editor/types'

import { Endge } from '@endge/core'

function resolveKind(definitionRef: string): Exclude<UIEditorNodeKind, 'page'> | null {
  const definition = Endge.uiRegistry.getDefinition(definitionRef)
  if (!definition || definition.primitiveKind === 'page') {
    return null
  }
  return definition.primitiveKind
}

function createPresetItem(componentId: string): UIEditorLibraryItem | null {
  const preset = Endge.uiRegistry.getPresetComponent(componentId)
  const definition = preset ? Endge.uiRegistry.getDefinition(preset.definitionRef) : null
  const kind = definition ? resolveKind(definition.id) : null
  if (!preset || !definition || !kind) {
    return null
  }

  return {
    id: preset.id,
    source: 'preset',
    section: 'components',
    folder: definition.groupId,
    definitionRef: definition.id,
    label: preset.title,
    description: preset.description,
    kind,
    accentClass: definition.canvasAccentClass,
    configKind: definition.configKind ?? null,
    keywords: preset.keywords ?? definition.keywords,
    layoutPatch: preset.layoutPatch ?? Endge.uiRegistry.getDefinitionDefaultLayout(definition.id),
    propsPatch: {
      ...Endge.uiRegistry.getDefinitionDefaultProps(definition.id),
      ...(preset.propsPatch ?? {}),
    },
    configRef: preset.configRef ?? null,
    assetRef: preset.assetRef ?? null,
    sourceLabel: preset.title,
  }
}

function createJsxItem(componentId: string): UIEditorLibraryItem | null {
  const jsxComponent = Endge.uiRegistry.getJsxComponent(componentId)
  const definition = jsxComponent ? Endge.uiRegistry.getDefinition(jsxComponent.definitionRef) : null
  const kind = definition ? resolveKind(definition.id) : null
  const rootNode = jsxComponent ? jsxComponent.ast.nodes[jsxComponent.ast.rootId] : null
  if (!jsxComponent || !definition || !kind || !rootNode) {
    return null
  }

  return {
    id: jsxComponent.id,
    source: 'jsx',
    section: 'components',
    folder: definition.groupId,
    definitionRef: definition.id,
    label: jsxComponent.title,
    description: jsxComponent.description,
    kind,
    accentClass: definition.canvasAccentClass,
    configKind: definition.configKind ?? null,
    keywords: jsxComponent.keywords ?? definition.keywords,
    layoutPatch: rootNode.layout ?? Endge.uiRegistry.getDefinitionDefaultLayout(definition.id),
    propsPatch: rootNode.props,
    sourceLabel: jsxComponent.title,
  }
}

export function getUIEditorComponentLibraryGroups(): UIEditorLibraryGroup[] {
  const presetItems = Endge.uiRegistry.listPresetComponents()
    .map(component => createPresetItem(component.id))
    .filter((item): item is UIEditorLibraryItem => item != null)

  const jsxItems = Endge.uiRegistry.listJsxComponents()
    .map(component => createJsxItem(component.id))
    .filter((item): item is UIEditorLibraryItem => item != null)

  return [
    {
      id: 'preset-components',
      title: 'Preset Components',
      description: 'Готовые компоненты с внутренними конфигурационными данными.',
      items: presetItems,
    },
    {
      id: 'jsx-components',
      title: 'JSX Components',
      description: 'Сохранённые JSX-блоки, которые разворачиваются в AST-поддеревья.',
      items: jsxItems,
    },
  ].filter(group => group.items.length > 0)
}
