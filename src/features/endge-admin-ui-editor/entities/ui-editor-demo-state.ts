import type {
  UIEditorBreakpoint,
  UIEditorBreakpointConfig,
  UIEditorCanvasMode,
  UIEditorDocument,
  UIEditorDragPayload,
  UIEditorNode,
  UIEditorNodeKind,
  UIEditorNodeLayout,
  UIEditorTreeNode,
  UIEditorWorkspaceMode,
} from '@/features/endge-admin-ui-editor/types'
import type { UIPrimitiveKind } from '@endge/core'

import {
  Endge,
} from '@endge/core'
import { reactive } from 'vue'

import { printUIEditorDocumentSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-jsx'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import { patchUIEditorSFCTemplate, projectUIEditorDocumentFromSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-source'

export const UI_EDITOR_DND_MIME = 'application/x-endge-ui-editor'
const UI_EDITOR_DEMO_STORAGE_KEY = 'endge-admin-ui-editor-demo-state:v8'
const UI_EDITOR_DEMO_STORAGE_KEYS = [
  UI_EDITOR_DEMO_STORAGE_KEY,
  'endge-admin-ui-editor-demo-state:v7',
  'endge-admin-ui-editor-demo-state:v6',
  'endge-admin-ui-editor-demo-state:v5',
  'endge-admin-ui-editor-demo-state:v4',
  'endge-admin-ui-editor-demo-state:v3',
  'endge-admin-ui-editor-demo-state:v2',
]
const DEFAULT_PAGE_GAP = 10
const DEFAULT_PAGE_PADDING = 10
const DEFAULT_PAGE_ROW_HEIGHT = 28

export const UI_EDITOR_BREAKPOINTS: UIEditorBreakpointConfig[] = [
  {
    id: 'desktop',
    label: 'Desktop',
    width: 1120,
    description: 'Широкий холст для основного layout и сложных композиций.',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    width: 820,
    description: 'Промежуточный режим для плотных панелей и адаптивных перестроений.',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    width: 430,
    description: 'Компактный режим с приоритетом вертикальной композиции.',
  },
]

function createNodeId(): string {
  return `ui-node-${Math.random().toString(36).slice(2, 10)}`
}

function resolveNodeDefinitionRef(input: string): string {
  return input.includes('.')
    ? input
    : Endge.uiRegistry.resolveLegacyDefinitionRef(input as UIPrimitiveKind)
}

function createDefaultLayout(input: string): UIEditorNodeLayout {
  const definitionRef = resolveNodeDefinitionRef(input)
  const contract = getUIEditorSFCDefinitionContract(definitionRef)
  const layout = contract?.defaultLayout ?? Endge.uiRegistry.getDefinitionDefaultLayout(definitionRef)
  return {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 4,
    ...(layout ?? {}),
  }
}

export function getUIEditorDefaultLayout(input: string): UIEditorNodeLayout {
  return {
    ...createDefaultLayout(input),
  }
}

function createNode(definitionRef: string): UIEditorNode {
  const resolvedDefinitionRef = resolveNodeDefinitionRef(definitionRef)
  const contract = getUIEditorSFCDefinitionContract(resolvedDefinitionRef)
  if (contract) {
    return {
      id: createNodeId(),
      kind: contract.kind,
      definitionRef: contract.definitionRef,
      configRef: null,
      assetRef: null,
      name: contract.label,
      children: [],
      props: { ...contract.defaultProps } as UIEditorNode['props'],
      layout: { ...contract.defaultLayout },
    } as UIEditorNode
  }

  return Endge.uiRegistry.createNodeFromDefinition({
    id: definitionRef === 'ui.page' ? 'ui-page-root' : createNodeId(),
    definitionRef: resolvedDefinitionRef,
  }) as UIEditorNode
}

function applyNodeSourceMeta(
  node: UIEditorNode,
  input?: {
    sourceType?: 'definition' | 'preset' | 'jsx'
    label?: string
    itemId?: string
    sourceLabel?: string
    configRef?: string
    assetRef?: string
    propsPatch?: Record<string, unknown>
    layoutPatch?: Partial<UIEditorNodeLayout>
  },
): UIEditorNode {
  if (!input) {
    return node
  }

  const sourceType = String(input.sourceType ?? '').trim()
  const label = String(input.label ?? '').trim()
  const itemId = String(input.itemId ?? '').trim()
  const sourceLabel = String(input.sourceLabel ?? label ?? '').trim()
  const propsPatch = input.propsPatch && typeof input.propsPatch === 'object'
    ? input.propsPatch
    : null
  const layoutPatch = input.layoutPatch && typeof input.layoutPatch === 'object'
    ? input.layoutPatch
    : null
  if (label) {
    node.name = label
    if (node.kind === 'text') {
      node.props.text = label
    }
    if (node.kind === 'button') {
      node.props.label = label
    }
    if (node.kind === 'box') {
      node.props.title = label
    }
    if (node.kind === 'custom-component') {
      node.props.title = label
    }
  }

  if (propsPatch) {
    ;(node as UIEditorNode).props = {
      ...node.props,
      ...propsPatch,
    } as UIEditorNode['props']
    ;(node as UIEditorNode).props = normalizeNodeProps(node)
  }

  if (layoutPatch && node.kind !== 'page') {
    node.layout = normalizeNodeLayout(node.kind, {
      ...(node.layout ?? {}),
      ...layoutPatch,
    })
  }

  if (input.configRef !== undefined) {
    node.configRef = String(input.configRef ?? '').trim() || null
  }

  if (input.assetRef !== undefined) {
    node.assetRef = String(input.assetRef ?? '').trim() || null
  }

  if (itemId) {
    node.meta = {
      ...(node.meta ?? {}),
      sourceItemId: itemId || undefined,
      sourceType: sourceType || undefined,
      sourceLabel: sourceLabel || undefined,
    }
  }
  else if (sourceType || sourceLabel) {
    node.meta = {
      ...(node.meta ?? {}),
      sourceType: sourceType || undefined,
      sourceLabel: sourceLabel || undefined,
    }
  }

  return node
}

function createDefaultDocument(): UIEditorDocument {
  const root = Endge.uiRegistry.createRootNode({
    id: 'ui-page-root',
    propsPatch: {
      title: 'Demo UI Page',
      gap: DEFAULT_PAGE_GAP,
      padding: DEFAULT_PAGE_PADDING,
      rowHeight: DEFAULT_PAGE_ROW_HEIGHT,
    },
  }) as UIEditorNode
  return {
    id: 'ui-editor-demo-document',
    version: 6,
    rootId: root.id,
    nodes: {
      [root.id]: root,
    },
  }
}

export function isUIEditorContainer(kind: UIEditorNodeKind): boolean {
  return kind === 'page' || kind === 'flex' || kind === 'grid' || kind === 'box'
}

function clampSpan(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 12
  }
  return Math.max(1, Math.min(12, Math.round(numeric)))
}

function clampColStart(value: unknown, span = 12): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 1
  }
  const maxStart = Math.max(1, 13 - Math.max(1, Math.min(12, span)))
  return Math.max(1, Math.min(maxStart, Math.round(numeric)))
}

function clampRowStart(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 1
  }
  return Math.max(1, Math.min(500, Math.round(numeric)))
}

function clampRowSpan(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 4
  }
  return Math.max(1, Math.min(40, Math.round(numeric)))
}

function clampRowHeight(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PAGE_ROW_HEIGHT
  }
  return Math.max(20, Math.min(120, Math.round(numeric)))
}

function clampSpacing(value: unknown, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(0, Math.min(64, Math.round(numeric)))
}

function clampGridMinHeight(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 160
  }
  return Math.max(48, Math.round(numeric))
}

function toLegacyRowSpan(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 4
  }

  return clampRowSpan(Math.max(1, Math.round(numeric / DEFAULT_PAGE_ROW_HEIGHT)))
}

function isBreakpoint(value: unknown): value is UIEditorBreakpoint {
  return value === 'desktop' || value === 'tablet' || value === 'mobile'
}

function isCanvasMode(value: unknown): value is UIEditorCanvasMode {
  return value === 'editor' || value === 'preview'
}

function isWorkspaceMode(value: unknown): value is UIEditorWorkspaceMode {
  return value === 'visual' || value === 'split' || value === 'source'
}

function hasBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isUIEditorDocument(value: unknown): value is UIEditorDocument {
  if (!value || typeof value !== 'object') {
    return false
  }

  const document = value as UIEditorDocument
  if (!document.rootId || typeof document.rootId !== 'string') {
    return false
  }
  if (!document.nodes || typeof document.nodes !== 'object') {
    return false
  }

  const rootNode = document.nodes[document.rootId]
  return Boolean(rootNode && rootNode.kind === 'page' && Array.isArray(rootNode.children))
}

function normalizeNodeLayout(
  kind: UIEditorNodeKind,
  layout: unknown,
): UIEditorNodeLayout | undefined {
  if (kind === 'page') {
    return undefined
  }

  const nextLayout = layout && typeof layout === 'object'
    ? layout as Record<string, unknown>
    : {}

  const span = clampSpan(nextLayout.span)

  return {
    colStart: clampColStart(nextLayout.colStart, span),
    rowStart: clampRowStart(nextLayout.rowStart),
    span,
    rowSpan: nextLayout.rowSpan != null
      ? clampRowSpan(nextLayout.rowSpan)
      : toLegacyRowSpan(nextLayout.minHeight),
  }
}

function normalizeNodeProps(node: UIEditorNode): UIEditorNode['props'] {
  switch (node.kind) {
    case 'page':
      return {
        title: String(node.props.title ?? 'Demo UI Page'),
        gap: clampSpacing(node.props.gap, DEFAULT_PAGE_GAP),
        padding: clampSpacing(node.props.padding, DEFAULT_PAGE_PADDING),
        rowHeight: clampRowHeight((node.props as Partial<typeof node.props>).rowHeight),
      }
    case 'flex':
      return {
        direction: node.props.direction === 'row' ? 'row' : 'column',
        gap: clampSpacing(node.props.gap, 8),
        padding: clampSpacing(node.props.padding, 8),
      }
    case 'grid':
      return {
        columns: Math.max(1, Math.min(6, Math.round(Number(node.props.columns ?? 2)) || 2)),
        gap: clampSpacing(node.props.gap, 8),
        padding: clampSpacing(node.props.padding, 8),
        minHeight: clampGridMinHeight(node.props.minHeight),
      }
    case 'box':
      return {
        title: String(node.props.title ?? 'Панель'),
        padding: clampSpacing(node.props.padding, 8),
      }
    case 'custom-component':
      return {
        title: String(node.props.title ?? 'Custom Component'),
        rendererRef: String(node.props.rendererRef ?? '').trim(),
      }
    case 'button':
      return {
        label: String(node.props.label ?? 'Кнопка'),
      }
    case 'text':
      return {
        text: String(node.props.text ?? 'Новый текст'),
      }
    default:
      return node.props
  }
}

function normalizeDocument(document: UIEditorDocument): UIEditorDocument {
  const nodes = Object.fromEntries(
    Object.entries(document.nodes).map(([nodeId, rawNode]) => {
      const normalizedRawNode = Endge.uiRegistry.normalizeNodeDefinition({
        ...rawNode,
        children: Array.isArray(rawNode.children) ? [...rawNode.children] : [],
        meta: rawNode.meta ? { ...rawNode.meta } : undefined,
      } as UIEditorNode) as UIEditorNode

      const normalizedNode = {
        ...normalizedRawNode,
        props: normalizeNodeProps(normalizedRawNode),
        layout: normalizeNodeLayout(normalizedRawNode.kind, normalizedRawNode.layout),
      } satisfies UIEditorNode

      return [nodeId, normalizedNode]
    }),
  ) as Record<string, UIEditorNode>

  return {
    id: document.id ?? 'ui-editor-demo-document',
    version: Math.max(5, Number(document.version) || 5),
    rootId: document.rootId,
    nodes: normalizePageChildrenPositions(nodes, document.nodes),
  }
}

function normalizePageChildrenPositions(
  nodes: Record<string, UIEditorNode>,
  sourceNodes: Record<string, UIEditorNode>,
): Record<string, UIEditorNode> {
  for (const node of Object.values(nodes)) {
    if (node.kind !== 'page') {
      continue
    }

    let cursorRow = 1
    for (const childId of node.children) {
      const childNode = nodes[childId]
      if (!childNode || !childNode.layout) {
        continue
      }

      const sourceLayout = sourceNodes[childId]?.layout as Partial<UIEditorNodeLayout> | undefined
      const hasExplicitPosition = sourceLayout?.colStart != null && sourceLayout?.rowStart != null

      if (!hasExplicitPosition) {
        childNode.layout = {
          ...childNode.layout,
          colStart: 1,
          rowStart: cursorRow,
        }
      }

      cursorRow = Math.max(
        cursorRow,
        Number(childNode.layout.rowStart ?? 1) + Math.max(1, Number(childNode.layout.rowSpan ?? 1)),
      )
    }
  }

  return nodes
}

function readPersistedState(): {
  document: UIEditorDocument
  activeBreakpoint: UIEditorBreakpoint
  canvasMode: UIEditorCanvasMode
  workspaceMode: UIEditorWorkspaceMode
  selectedNodeId: string | null
  showGridOverlay: boolean
  source: string
} | null {
  if (!hasBrowserStorage()) {
    return null
  }

  try {
    const raw = UI_EDITOR_DEMO_STORAGE_KEYS
      .map(key => window.localStorage.getItem(key))
      .find(Boolean)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      document?: UIEditorDocument
      activeBreakpoint?: UIEditorBreakpoint
      canvasMode?: UIEditorCanvasMode
      workspaceMode?: UIEditorWorkspaceMode
      selectedNodeId?: string | null
      showGridOverlay?: boolean
      source?: string
      // Kept only to migrate the previous two-pane preference.
      showGeneratedCode?: boolean
    }

    if (!isUIEditorDocument(parsed.document)) {
      return null
    }

    const normalizedDocument = normalizeDocument(parsed.document)

    const selectedNodeId = parsed.selectedNodeId === null
      ? null
      : parsed.selectedNodeId && normalizedDocument.nodes[parsed.selectedNodeId]
        ? parsed.selectedNodeId
        : normalizedDocument.rootId

    return {
      document: normalizedDocument,
      activeBreakpoint: isBreakpoint(parsed.activeBreakpoint) ? parsed.activeBreakpoint : 'desktop',
      canvasMode: isCanvasMode(parsed.canvasMode) ? parsed.canvasMode : 'editor',
      workspaceMode: isWorkspaceMode(parsed.workspaceMode)
        ? parsed.workspaceMode
        : parsed.showGeneratedCode === true ? 'split' : 'visual',
      selectedNodeId,
      showGridOverlay: parsed.showGridOverlay === true,
      source: typeof parsed.source === 'string'
        ? parsed.source
        : printUIEditorDocumentSFC(normalizedDocument),
    }
  }
  catch (error) {
    console.warn('[UIEditorDemoState] failed to read persisted state', error)
    return null
  }
}

export class UIEditorDemoState {
  public document: UIEditorDocument = createDefaultDocument()
  public activeBreakpoint: UIEditorBreakpoint = 'desktop'
  public canvasMode: UIEditorCanvasMode = 'editor'
  public workspaceMode: UIEditorWorkspaceMode = 'visual'
  public selectedNodeId: string | null = this.document.rootId
  public source = printUIEditorDocumentSFC(this.document)
  public sourceDiagnostics: string[] = []
  public isGridInteractionActive = false
  public gridInteractionMode: 'idle' | 'drag' | 'resize' = 'idle'
  public interactionNodeId: string | null = null
  public dragPayload: UIEditorDragPayload | null = null
  public showGridOverlay = false

  public constructor() {
    this.restorePersistedState()
  }

  public reset(): void {
    this.document = createDefaultDocument()
    this.activeBreakpoint = 'desktop'
    this.canvasMode = 'editor'
    this.workspaceMode = 'visual'
    this.selectedNodeId = this.document.rootId
    this.source = printUIEditorDocumentSFC(this.document)
    this.sourceDiagnostics = []
    this.isGridInteractionActive = false
    this.gridInteractionMode = 'idle'
    this.interactionNodeId = null
    this.dragPayload = null
    this.showGridOverlay = false
    this.persistState()
  }

  public setBreakpoint(breakpoint: UIEditorBreakpoint): void {
    this.activeBreakpoint = breakpoint
    this.persistState()
  }

  public setCanvasMode(mode: UIEditorCanvasMode): void {
    this.canvasMode = mode
    this.persistState()
  }

  public setWorkspaceMode(mode: UIEditorWorkspaceMode): void {
    this.workspaceMode = mode
    this.persistState()
  }

  public toggleGridOverlay(): void {
    this.showGridOverlay = !this.showGridOverlay
    this.persistState()
  }

  public beginGridDrag(payload: UIEditorDragPayload, nodeId?: string | null): void {
    this.isGridInteractionActive = true
    this.gridInteractionMode = 'drag'
    this.dragPayload = payload
    this.interactionNodeId = nodeId ?? payload.nodeId ?? null
  }

  public beginGridResize(nodeId?: string | null): void {
    this.isGridInteractionActive = true
    this.gridInteractionMode = 'resize'
    this.interactionNodeId = nodeId ?? null
  }

  public endGridInteraction(): void {
    this.isGridInteractionActive = false
    this.gridInteractionMode = 'idle'
    this.interactionNodeId = null
    this.dragPayload = null
  }

  public getNode(nodeId: string | null | undefined): UIEditorNode | null {
    if (!nodeId) {
      return null
    }
    return this.document.nodes[nodeId] ?? null
  }

  public getSelectedNode(): UIEditorNode | null {
    return this.getNode(this.selectedNodeId)
  }

  public getChildren(nodeId: string): UIEditorNode[] {
    const node = this.getNode(nodeId)
    if (!node) {
      return []
    }
    return node.children
      .map(childId => this.getNode(childId))
      .filter((child): child is UIEditorNode => child != null)
  }

  public selectNode(nodeId: string): void {
    if (this.document.nodes[nodeId]) {
      this.selectedNodeId = nodeId
      this.persistState()
    }
  }

  public clearSelection(): void {
    if (this.selectedNodeId === null) {
      return
    }
    this.selectedNodeId = null
    this.persistState()
  }

  public addNode(
    definitionRef: string,
    parentId?: string,
    source?: {
      sourceType?: 'definition' | 'preset' | 'jsx'
      label?: string
      itemId?: string
      sourceLabel?: string
      configRef?: string
      assetRef?: string
      propsPatch?: Record<string, unknown>
      layoutPatch?: Partial<UIEditorNodeLayout>
    },
    index?: number,
  ): UIEditorNode | null {
    if (this.sourceDiagnostics.length > 0) {
      return null
    }
    const targetParentId = parentId ?? this.document.rootId
    const parent = this.getNode(targetParentId)
    if (!parent || !isUIEditorContainer(parent.kind)) {
      return null
    }

    const node = applyNodeSourceMeta(createNode(definitionRef), source)
    if (parent.kind === 'page' && node.layout) {
      node.layout = {
        ...node.layout,
        colStart: 1,
        rowStart: this.getNextPageRowStart(parent.id),
      }
    }
    this.document.nodes[node.id] = node
    const targetIndex = Number.isInteger(index) ? Math.max(0, Math.min(Number(index), parent.children.length)) : parent.children.length
    parent.children.splice(targetIndex, 0, node.id)
    this.selectedNodeId = node.id
    this.persistDocumentState()
    return node
  }

  public addPaletteItem(
    payload: UIEditorDragPayload,
    parentId?: string,
    index?: number,
  ): UIEditorNode | null {
    if (payload.source !== 'palette') {
      return null
    }

    if (payload.paletteSource === 'jsx' && payload.itemId) {
      return this.addJsxComponent(payload.itemId, parentId, index)
    }

    const definitionRef = payload.definitionRef ?? payload.kind
    if (!definitionRef) {
      return null
    }

    if (payload.paletteSource === 'preset' && payload.itemId) {
      const preset = Endge.uiRegistry.getPresetComponent(payload.itemId)
      if (!preset) {
        return null
      }

      return this.addNode(definitionRef, parentId, {
        sourceType: 'preset',
        label: preset.title,
        itemId: preset.id,
        sourceLabel: preset.title,
        configRef: preset.configRef ?? undefined,
        assetRef: preset.assetRef ?? undefined,
        propsPatch: preset.propsPatch,
        layoutPatch: preset.layoutPatch,
      }, index)
    }

    return this.addNode(definitionRef, parentId, {
      sourceType: payload.paletteSource ?? 'definition',
      label: payload.label,
      itemId: payload.itemId,
      sourceLabel: payload.sourceLabel,
      configRef: payload.configRef,
      assetRef: payload.assetRef,
      propsPatch: payload.propsPatch,
      layoutPatch: payload.layoutPatch,
    }, index)
  }

  public moveNode(nodeId: string, targetParentId: string, targetIndex?: number): boolean {
    if (this.sourceDiagnostics.length > 0) {
      return false
    }
    if (!nodeId || !targetParentId || nodeId === this.document.rootId) {
      return false
    }

    const node = this.getNode(nodeId)
    const targetParent = this.getNode(targetParentId)
    if (!node || !targetParent || !isUIEditorContainer(targetParent.kind)) {
      return false
    }
    if (nodeId === targetParentId || this.isDescendant(nodeId, targetParentId)) {
      return false
    }

    const currentParentId = this.findParentId(nodeId)
    if (!currentParentId) {
      return false
    }

    const currentParent = this.getNode(currentParentId)
    if (!currentParent) {
      return false
    }

    const nextIndex = Number.isInteger(targetIndex)
      ? Math.max(0, Math.min(Number(targetIndex), targetParent.children.length))
      : targetParent.children.length

    let effectiveTargetIndex = nextIndex
    if (currentParentId === targetParentId) {
      const currentIndex = currentParent.children.indexOf(nodeId)
      if (currentIndex !== -1 && currentIndex < nextIndex) {
        effectiveTargetIndex -= 1
      }
    }

    currentParent.children = currentParent.children.filter(childId => childId !== nodeId)
    targetParent.children.splice(effectiveTargetIndex, 0, nodeId)
    this.selectedNodeId = nodeId
    this.persistDocumentState()
    return true
  }

  public removeNode(nodeId: string): void {
    if (this.sourceDiagnostics.length > 0) {
      return
    }
    if (!nodeId || nodeId === this.document.rootId) {
      return
    }

    const parentId = this.findParentId(nodeId)
    if (parentId) {
      const parent = this.getNode(parentId)
      if (parent) {
        parent.children = parent.children.filter(childId => childId !== nodeId)
      }
    }

    this.removeNodeRecursive(nodeId)
    this.selectedNodeId = parentId ?? this.document.rootId
    this.persistDocumentState()
  }

  public patchNodeProps(
    nodeId: string,
    patch: Record<string, unknown>,
  ): void {
    if (this.sourceDiagnostics.length > 0) {
      return
    }
    const node = this.getNode(nodeId)
    if (!node) {
      return
    }

    ;(node as UIEditorNode).props = {
      ...node.props,
      ...patch,
    } as UIEditorNode['props']
    ;(node as UIEditorNode).props = normalizeNodeProps(node)
    this.persistDocumentState()
  }

  public patchNodeLayout(nodeId: string, patch: Partial<UIEditorNodeLayout>): void {
    if (this.sourceDiagnostics.length > 0) {
      return
    }
    const node = this.getNode(nodeId)
    if (!node || node.kind === 'page') {
      return
    }

    const span = clampSpan(patch.span ?? node.layout?.span ?? 12)
    node.layout = {
      colStart: clampColStart(patch.colStart ?? node.layout?.colStart ?? 1, span),
      rowStart: clampRowStart(patch.rowStart ?? node.layout?.rowStart ?? 1),
      span,
      rowSpan: clampRowSpan(patch.rowSpan ?? node.layout?.rowSpan ?? 4),
    }
    this.persistDocumentState()
  }

  public patchNodeReferences(
    nodeId: string,
    patch: {
      configRef?: string | null
      assetRef?: string | null
    },
  ): void {
    if (this.sourceDiagnostics.length > 0) {
      return
    }
    const node = this.getNode(nodeId)
    if (!node) {
      return
    }

    if (patch.configRef !== undefined) {
      node.configRef = String(patch.configRef ?? '').trim() || null
    }
    if (patch.assetRef !== undefined) {
      node.assetRef = String(patch.assetRef ?? '').trim() || null
    }
    this.persistDocumentState()
  }

  public toTree(): UIEditorTreeNode {
    return this.toTreeNode(this.document.rootId)!
  }

  public toJsx(): string {
    return this.toSFCSource()
  }

  public toSFCSource(): string {
    return this.source
  }

  public applySFCSource(source: string): boolean {
    this.source = source
    const projection = projectUIEditorDocumentFromSFC(source, this.document)
    this.sourceDiagnostics = projection.diagnostics

    if (projection.document) {
      this.document = projection.document
      if (this.selectedNodeId && !this.document.nodes[this.selectedNodeId]) {
        this.selectedNodeId = null
      }
    }

    this.persistState()
    return projection.document != null
  }

  public logTree(): void {
    console.groupCollapsed('[UIEditorDemo] AST tree')
    console.log(this.toTree())
    console.groupEnd()
  }

  private findParentId(nodeId: string): string | null {
    for (const node of Object.values(this.document.nodes)) {
      if (node.children.includes(nodeId)) {
        return node.id
      }
    }
    return null
  }

  private isDescendant(nodeId: string, possibleChildId: string): boolean {
    const node = this.getNode(nodeId)
    if (!node) {
      return false
    }
    if (node.children.includes(possibleChildId)) {
      return true
    }
    return node.children.some(childId => this.isDescendant(childId, possibleChildId))
  }

  private removeNodeRecursive(nodeId: string): void {
    const node = this.getNode(nodeId)
    if (!node) {
      return
    }

    for (const childId of [...node.children]) {
      this.removeNodeRecursive(childId)
    }
    delete this.document.nodes[nodeId]
  }

  private toTreeNode(nodeId: string): UIEditorTreeNode | null {
    const node = this.getNode(nodeId)
    if (!node) {
      return null
    }

    return {
      id: node.id,
      kind: node.kind,
      definitionRef: node.definitionRef,
      configRef: node.configRef ?? null,
      assetRef: node.assetRef ?? null,
      name: node.name,
      props: node.props,
      layout: node.layout,
      children: node.children
        .map(childId => this.toTreeNode(childId))
        .filter((child): child is UIEditorTreeNode => child != null),
    }
  }

  private getNextPageRowStart(pageNodeId: string): number {
    const pageNode = this.getNode(pageNodeId)
    if (!pageNode || pageNode.kind !== 'page') {
      return 1
    }

    return pageNode.children.reduce((maxRow, childId) => {
      const childNode = this.getNode(childId)
      if (!childNode || !childNode.layout) {
        return maxRow
      }

      return Math.max(maxRow, childNode.layout.rowStart + childNode.layout.rowSpan)
    }, 1)
  }

  private restorePersistedState(): void {
    const persistedState = readPersistedState()
    if (!persistedState) {
      return
    }

    this.document = normalizeDocument(persistedState.document)
    this.activeBreakpoint = persistedState.activeBreakpoint
    this.canvasMode = persistedState.canvasMode
    this.workspaceMode = persistedState.workspaceMode
    this.selectedNodeId = persistedState.selectedNodeId
    this.showGridOverlay = persistedState.showGridOverlay
    this.source = persistedState.source
    const projection = projectUIEditorDocumentFromSFC(this.source, this.document)
    this.sourceDiagnostics = projection.diagnostics
    if (projection.document) {
      this.document = projection.document
      if (this.selectedNodeId && !this.document.nodes[this.selectedNodeId]) {
        this.selectedNodeId = null
      }
    }
  }

  private persistDocumentState(): void {
    this.source = patchUIEditorSFCTemplate(this.source, this.document)
    this.sourceDiagnostics = []
    this.persistState()
  }

  private persistState(): void {
    if (!hasBrowserStorage()) {
      return
    }

    try {
      window.localStorage.setItem(UI_EDITOR_DEMO_STORAGE_KEY, JSON.stringify({
        document: this.document,
        activeBreakpoint: this.activeBreakpoint,
        canvasMode: this.canvasMode,
        workspaceMode: this.workspaceMode,
        selectedNodeId: this.selectedNodeId,
        showGridOverlay: this.showGridOverlay,
        source: this.source,
      }))
    }
    catch (error) {
      console.warn('[UIEditorDemoState] failed to persist state', error)
    }
  }

  private addJsxComponent(
    componentId: string,
    parentId?: string,
    index?: number,
  ): UIEditorNode | null {
    if (this.sourceDiagnostics.length > 0) {
      return null
    }
    const component = Endge.uiRegistry.getJsxComponent(componentId)
    if (!component) {
      return null
    }

    const targetParentId = parentId ?? this.document.rootId
    const parent = this.getNode(targetParentId)
    if (!parent || !isUIEditorContainer(parent.kind)) {
      return null
    }

    const rootNode = this.cloneJsxSubtree(component.ast.rootId, component.ast.nodes, {
      sourceType: 'jsx',
      sourceLabel: component.title,
      itemId: component.id,
      isRoot: true,
    })
    if (!rootNode) {
      return null
    }

    if (parent.kind === 'page' && rootNode.layout) {
      rootNode.layout = {
        ...rootNode.layout,
        colStart: 1,
        rowStart: this.getNextPageRowStart(parent.id),
      }
    }

    const targetIndex = Number.isInteger(index) ? Math.max(0, Math.min(Number(index), parent.children.length)) : parent.children.length
    parent.children.splice(targetIndex, 0, rootNode.id)
    this.selectedNodeId = rootNode.id
    this.persistDocumentState()
    return rootNode
  }

  private cloneJsxSubtree(
    nodeId: string,
    nodes: Record<string, UIEditorNode>,
    input: {
      sourceType: 'jsx'
      sourceLabel: string
      itemId: string
      isRoot?: boolean
    },
  ): UIEditorNode | null {
    const sourceNode = nodes[nodeId]
    if (!sourceNode) {
      return null
    }

    const clonedNodeId = createNodeId()
    const clonedChildren = sourceNode.children
      .map(childId => this.cloneJsxSubtree(childId, nodes, input))
      .filter((child): child is UIEditorNode => child != null)

    const clonedNode = Endge.uiRegistry.normalizeNodeDefinition({
      ...sourceNode,
      id: clonedNodeId,
      children: clonedChildren.map(child => child.id),
      props: { ...sourceNode.props },
      layout: sourceNode.layout ? { ...sourceNode.layout } : undefined,
      meta: {
        ...(sourceNode.meta ?? {}),
      },
    } as UIEditorNode)

    if (input.isRoot) {
      clonedNode.meta = {
        ...(clonedNode.meta ?? {}),
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel,
        sourceItemId: input.itemId,
      }
    }

    this.document.nodes[clonedNode.id] = clonedNode as UIEditorNode

    return clonedNode as UIEditorNode
  }
}

export const uiEditorDemoState = reactive(new UIEditorDemoState()) as UIEditorDemoState
