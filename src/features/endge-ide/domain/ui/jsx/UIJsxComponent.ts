import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export type UIJsxAttributeValue = string | number | boolean | null

export interface UIJsxElementNode {
  type: 'element'
  tag: string
  attributes: Record<string, UIJsxAttributeValue>
  children: UIJsxNode[]
}

export interface UIJsxTextNode {
  type: 'text'
  value: string
}

export type UIJsxNode = UIJsxElementNode | UIJsxTextNode

export function getUIJsxTagName(definition: Pick<UIComponentDefinition, 'jsxTag'>): string {
  return definition.jsxTag
}
