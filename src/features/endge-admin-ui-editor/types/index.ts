import type {
  RComponentSFC_SourceRange,
  UIAstDocument,
  UIAstNodeBase,
  UIAstNodeLayout,
  UIPrimitiveKind,
} from '@endge/core'

export type UIEditorBreakpoint = 'desktop' | 'tablet' | 'mobile'
export type UIEditorPanel = 'visual' | 'source' | 'preview'
export type UIEditorPanelLayoutKey
  = | 'visual'
    | 'source'
    | 'preview'
    | 'visual-source'
    | 'visual-preview'
    | 'source-preview'
    | 'visual-source-preview'

export type UIEditorPanelVisibility = Record<UIEditorPanel, boolean>
export type UIEditorPanelLayouts = Record<UIEditorPanelLayoutKey, number[]>

export type UIEditorNodeKind = UIPrimitiveKind

export interface UIEditorPageProps extends Record<string, unknown> {
  title: string
  layoutMode: 'flex' | 'grid'
  direction: 'row' | 'column'
  align: string | null
  justify: string | null
  wrap: boolean
  columns: number
  gap: number
  padding: number
  rowHeight: number
}

export interface UIEditorFlexProps extends Record<string, unknown> {
  direction: 'row' | 'column'
  align: string | null
  justify: string | null
  wrap: boolean
  gap: number
  padding: number
}

export interface UIEditorGridProps extends Record<string, unknown> {
  columns: number
  gap: number
  padding: number
  minHeight: number
  rowHeight: number
}

export interface UIEditorBoxProps extends Record<string, unknown> {
  title: string
  padding: number
}

export interface UIEditorCustomComponentProps extends Record<string, unknown> {
  title: string
  rendererRef: string
}

export interface UIEditorTextProps extends Record<string, unknown> {
  text: string
}

export interface UIEditorButtonProps extends Record<string, unknown> {
  label: string
}

export type UIEditorSFCTextSegment
  = | { kind: 'text', value: string }
    | { kind: 'expression', expression: string }

export interface UIEditorSFCAttributeBinding {
  name: string
  expression: string
  resolved: boolean
  previewValue?: unknown
}

export interface UIEditorNodePropsMap {
  'page': UIEditorPageProps
  'flex': UIEditorFlexProps
  'grid': UIEditorGridProps
  'box': UIEditorBoxProps
  'custom-component': UIEditorCustomComponentProps
  'text': UIEditorTextProps
  'button': UIEditorButtonProps
}

export type UIEditorNodeLayout = UIAstNodeLayout

export interface UIEditorNodeBase<TKind extends UIEditorNodeKind> extends UIAstNodeBase<TKind, UIEditorNodePropsMap[TKind]> {}

export type UIEditorNode<TKind extends UIEditorNodeKind = UIEditorNodeKind> = {
  [K in UIEditorNodeKind]: UIEditorNodeBase<K>
}[TKind]

export interface UIEditorTreeNode {
  id: string
  kind: UIEditorNodeKind
  definitionRef: string
  configRef?: string | null
  assetRef?: string | null
  name: string
  props: UIEditorNodePropsMap[UIEditorNodeKind]
  layout?: UIEditorNodeLayout
  children: UIEditorTreeNode[]
}

export type UIEditorDocument = UIAstDocument<UIEditorNode>

export interface UIEditorBreakpointConfig {
  id: UIEditorBreakpoint
  label: string
  width: number
  description: string
}

export interface UIEditorPaletteItem {
  definitionRef: string
  kind: Exclude<UIEditorNodeKind, 'page'>
  label: string
  description: string
  accentClass: string
  configKind?: string | null
}

export interface UIEditorDragPayload {
  source: 'palette' | 'node'
  paletteSource?: 'definition' | 'preset' | 'jsx'
  definitionRef?: string
  kind?: Exclude<UIEditorNodeKind, 'page'>
  nodeId?: string
  label?: string
  itemId?: string
  sourceLabel?: string
  configRef?: string
  assetRef?: string
  layoutPatch?: Partial<UIEditorNodeLayout>
  propsPatch?: Record<string, unknown>
}

export interface UIEditorNodeDragSession {
  nodeId: string
  originParentId: string
  originIndex: number
  targetParentId: string
  targetIndex: number
}

export type UIEditorSelectionOrigin = 'visual' | 'source'

export interface UIEditorSourceNodeLocation {
  range: RComponentSFC_SourceRange
  openingTagRange: RComponentSFC_SourceRange
}

export type UIEditorSourceNodeLocations = Record<string, UIEditorSourceNodeLocation>

export interface UIEditorLibraryItem extends UIEditorPaletteItem {
  id: string
  source: 'definition' | 'preset' | 'jsx'
  folder: string
  section: 'definitions' | 'components'
  keywords?: string[]
  configRef?: string | null
  assetRef?: string | null
  layoutPatch?: Partial<UIEditorNodeLayout>
  propsPatch?: Record<string, unknown>
  sourceLabel?: string
}

export interface UIEditorLibraryGroup {
  id: string
  title: string
  description: string
  items: UIEditorLibraryItem[]
}

export interface UIEditorLibraryTreeItem {
  id: string
  name: string
  path: string
  depth: number
  type: 'folder' | 'file'
  docType?: string
  fileId?: string
  itemKind?: Exclude<UIEditorNodeKind, 'page'>
  isRoot?: boolean
  managedBy?: import('@endge/core').ManagedBy
  managedById?: string | null
}
