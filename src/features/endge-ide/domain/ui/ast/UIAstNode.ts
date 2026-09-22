export type UIPrimitiveKind
  = | 'page'
    | 'flex'
    | 'grid'
    | 'box'
    | 'custom-component'
    | 'text'
    | 'button'

export interface UIAstNodeLayout {
  colStart: number
  rowStart: number
  span: number
  rowSpan: number
}

export interface UIAstNodeReference {
  definitionRef: string
  configRef?: string | null
  assetRef?: string | null
}

export interface UIAstNodeBase<
  TKind extends UIPrimitiveKind = UIPrimitiveKind,
  TProps extends Record<string, unknown> = Record<string, unknown>,
> extends UIAstNodeReference {
  id: string
  kind: TKind
  name: string
  children: string[]
  props: TProps
  layout?: UIAstNodeLayout
  meta?: Record<string, unknown>
}

export interface UIAstDocument<TNode extends UIAstNodeBase = UIAstNodeBase> {
  id: string
  version: number
  rootId: string
  nodes: Record<string, TNode>
}
