import type { UIAstNodeBase, UIAstNodeLayout, UIPrimitiveKind } from '@/features/endge-ide/domain/ui/ast/UIAstNode'
import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

import {
  UI_COMPONENT_HOST_DEFINITION_ID,
  uiBoxDefinition,
  uiButtonDefinition,
  uiComponentHostDefinition,
  uiFieldDefinition,
  uiFormDefinition,
  uiGridDefinition,
  uiInlineDefinition,
  uiNavPanelDefinition,
  uiPageDefinition,
  uiStackDefinition,
  uiTableDefinition,
  uiTextDefinition,
} from '@/features/endge-ide/domain/ui/definitions/builtin'

const BUILTIN_DEFINITIONS = [
  uiPageDefinition,
  uiTextDefinition,
  uiButtonDefinition,
  uiBoxDefinition,
  uiStackDefinition,
  uiInlineDefinition,
  uiGridDefinition,
  uiFormDefinition,
  uiFieldDefinition,
  uiTableDefinition,
  uiNavPanelDefinition,
  uiComponentHostDefinition,
] satisfies UIComponentDefinition[]

const DEFINITION_BY_ID = new Map(BUILTIN_DEFINITIONS.map(definition => [definition.id, definition]))

export interface UIComponentDefinitionGroup {
  id: string
  title: string
  description: string
}

function clonePlainValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function listUIComponentDefinitions(input?: {
  includeSystem?: boolean
  paletteOnly?: boolean
}): UIComponentDefinition[] {
  return BUILTIN_DEFINITIONS.filter((definition) => {
    if (input?.paletteOnly && !definition.paletteVisible) {
      return false
    }
    if (!input?.includeSystem && definition.groupId === 'system') {
      return false
    }
    return true
  })
}

export function listUIComponentDefinitionGroups(): UIComponentDefinitionGroup[] {
  const groups = new Map<string, UIComponentDefinitionGroup>()

  for (const definition of listUIComponentDefinitions({ paletteOnly: true })) {
    if (!groups.has(definition.groupId)) {
      groups.set(definition.groupId, {
        id: definition.groupId,
        title: definition.groupTitle,
        description: definition.groupDescription,
      })
    }
  }

  return Array.from(groups.values())
}

export function getUIComponentDefinition(definitionRef: string | null | undefined): UIComponentDefinition | null {
  if (!definitionRef) {
    return null
  }
  return DEFINITION_BY_ID.get(definitionRef) ?? null
}

export function getUIComponentDefinitionOrThrow(definitionRef: string): UIComponentDefinition {
  const definition = getUIComponentDefinition(definitionRef)
  if (!definition) {
    throw new Error(`[UIComponentRegistry] unknown definition: ${definitionRef}`)
  }
  return definition
}

export function getUIDefinitionDefaultLayout(definitionRef: string): UIAstNodeLayout | undefined {
  const definition = getUIComponentDefinitionOrThrow(definitionRef)
  return definition.defaultLayout ? clonePlainValue(definition.defaultLayout) : undefined
}

export function getUIDefinitionDefaultProps(definitionRef: string): Record<string, unknown> {
  const definition = getUIComponentDefinitionOrThrow(definitionRef)
  return clonePlainValue(definition.defaultProps)
}

export function resolveLegacyUIDefinitionRef(
  kind: UIPrimitiveKind,
  props?: Record<string, unknown> | null,
): string {
  if (kind === 'page') {
    return uiPageDefinition.id
  }
  if (kind === 'text') {
    return uiTextDefinition.id
  }
  if (kind === 'button') {
    return uiButtonDefinition.id
  }
  if (kind === 'box') {
    return uiBoxDefinition.id
  }
  if (kind === 'grid') {
    return uiGridDefinition.id
  }
  if (kind === 'flex') {
    return props?.direction === 'row'
      ? uiInlineDefinition.id
      : uiStackDefinition.id
  }
  return UI_COMPONENT_HOST_DEFINITION_ID
}

export function createUIAstNodeFromDefinition(input: {
  id: string
  definitionRef: string
  name?: string
  propsPatch?: Record<string, unknown>
  layoutPatch?: Partial<UIAstNodeLayout>
  configRef?: string | null
  assetRef?: string | null
  meta?: Record<string, unknown>
}): UIAstNodeBase {
  const definition = getUIComponentDefinitionOrThrow(input.definitionRef)
  const nextLayout = definition.defaultLayout
    ? {
        ...clonePlainValue(definition.defaultLayout),
        ...(input.layoutPatch ?? {}),
      }
    : undefined

  const nextProps = {
    ...getUIDefinitionDefaultProps(definition.id),
    ...(input.propsPatch ?? {}),
  }

  if ('rendererRef' in nextProps && !String(nextProps.rendererRef ?? '').trim() && definition.defaultRendererRef) {
    nextProps.rendererRef = definition.defaultRendererRef
  }

  return {
    id: input.id,
    kind: definition.primitiveKind,
    definitionRef: definition.id,
    configRef: input.configRef ?? null,
    assetRef: input.assetRef ?? null,
    name: input.name?.trim() || definition.defaultNodeName,
    children: [],
    props: nextProps,
    layout: nextLayout,
    meta: input.meta ? { ...input.meta } : undefined,
  }
}

export function normalizeUIAstNodeDefinition<TNode extends UIAstNodeBase>(
  node: TNode,
): TNode {
  const definitionRef = node.definitionRef || resolveLegacyUIDefinitionRef(node.kind, node.props)
  const definition = getUIComponentDefinition(definitionRef)
  if (!definition) {
    return {
      ...node,
      definitionRef,
    }
  }

  return {
    ...node,
    kind: definition.primitiveKind,
    definitionRef,
    props: {
      ...getUIDefinitionDefaultProps(definition.id),
      ...clonePlainValue(node.props),
    },
  }
}

export { BUILTIN_DEFINITIONS, UI_COMPONENT_HOST_DEFINITION_ID }
