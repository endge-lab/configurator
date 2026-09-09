import type { CompositionProgramPayload, DomainDocumentType } from '@endge/core'
import type { WorkflowGraph, WorkflowSelection } from '../tools/workflow-graph'

import { buildWorkflowGraph, getWorkflowFocus, getWorkflowSelection } from '../tools/workflow-graph'

/** Независимая от IDE проекция документа и конкретного места его использования. */
export interface WorkflowDependency {
  id: string
  kind: string
  identity: string
  alias: string | null
  title: string
  icon: string
  colorClass: string
  badgeIcon?: string | null
  documentType: DomainDocumentType | null
  activationMode: 'startup' | 'manual' | null
  status: 'valid' | 'missing' | 'compile-error' | 'cycle'
  diagnosticCount: number
  inactive?: boolean
  dataSource?: CompositionProgramPayload['data'][number]
  resourceSource?: CompositionProgramPayload['resources'][number]
  dataBindings?: Record<string, string>
  dataDependencies?: string[]
  vocabReferences?: { alias?: string, identity?: string }[]
  bindingIssue?: 'explicit-provider' | 'ambiguous-provider' | 'missing-provider'
  children: WorkflowDependency[]
}

export interface WorkflowPoint { x: number, y: number }
export interface WorkflowLayout {
  schemaVersion: 1
  positions: Record<string, WorkflowPoint>
}
export interface WorkflowViewport extends WorkflowPoint { zoom: number }
export interface WorkflowViewState {
  version: 1
  expandedResourceIds: string[]
  viewport?: WorkflowViewport
  layoutShift?: WorkflowPoint
}
export interface WorkflowResourceRow { type: string, items: WorkflowNodeData[] }
export type WorkflowNodeData = Omit<WorkflowDependency, 'children'> & {
  resourceRows?: WorkflowResourceRow[]
  resourcesExpanded?: boolean
  resourceColumns?: number
  width?: number
}
export interface WorkflowNode {
  id: string
  position: WorkflowPoint
  data: WorkflowNodeData
}
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  resource: boolean
  logicalSource: string
  logicalTarget: string
  sourceHandle: string
}

const NODE_WIDTH = 248
const NODE_HEIGHT = 176
const ROW_GAP = 32
const COLUMN_GAP = 112
const STORE_COLUMNS = 4
const RESOURCE_COLUMNS = 6
const RESOURCE_ROW_HEIGHT = 64
const CONTENT_ROWS = 2
const BRANCH_GAP = 80

/** Черновик раскладки и временное полотно editor-сессии; transport принадлежит IDE. */
export class ProjectWorkflow {
  private _roots: WorkflowDependency[] | null = null
  private readonly _layout: WorkflowLayout | null
  private _graph: WorkflowGraph = buildWorkflowGraph([])
  private _selectedIds = new Set<string>()
  private _expandedResources = new Set<string>()
  private _layoutShift: WorkflowPoint = { x: 0, y: 0 }
  private _viewport: WorkflowViewport | null = null

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  public constructor(layout: WorkflowLayout | null = { schemaVersion: 1, positions: {} }) {
    this._layout = layout
  }

  /** Обновляет структуру, сохраняя раскладку существующих мест использования. */
  public replaceRoots(roots: WorkflowDependency[]): void {
    this._roots = roots
    this._graph = buildWorkflowGraph(roots)
    this.setSelection(this._selectedIds)
    this._expandedResources = new Set([...this._expandedResources].filter(id => this._graph.resources.has(id)))
  }

  /** Перенос меняет только визуальные координаты, а не scope или зависимости. */
  public moveNodes(nodes: { id: string, position: WorkflowPoint }[]): void {
    if (!this._layout) {
      return
    }
    for (const node of nodes) {
      if (this._graph.nodes.has(node.id) && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
        this._layout.positions[node.id] = { ...node.position }
      }
    }
  }

  public setViewport(viewport: WorkflowViewport): void {
    if (Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom) && viewport.zoom > 0) {
      this._viewport = { ...viewport }
    }
  }

  public resetLayout(): void {
    if (this._layout) {
      this._layout.positions = {}
      this._layoutShift = { x: 0, y: 0 }
    }
  }

  /** Восстанавливает только поддержанный UI snapshot; документы и координаты не меняются. */
  public restoreViewState(value: unknown): void {
    this._viewport = null
    this._layoutShift = { x: 0, y: 0 }
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
      || !('expandedResourceIds' in value) || !Array.isArray(value.expandedResourceIds)) {
      this._expandedResources = new Set()
      return
    }
    this._expandedResources = new Set(value.expandedResourceIds.filter((id): id is string =>
      typeof id === 'string' && this._graph.resources.has(id)))
    if ('viewport' in value && value.viewport && typeof value.viewport === 'object') {
      const viewport = value.viewport
      if ('x' in viewport && typeof viewport.x === 'number'
        && 'y' in viewport && typeof viewport.y === 'number'
        && 'zoom' in viewport && typeof viewport.zoom === 'number') {
        this.setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom })
      }
    }
    if ('layoutShift' in value && value.layoutShift && typeof value.layoutShift === 'object') {
      const shift = value.layoutShift
      if ('x' in shift && typeof shift.x === 'number' && Number.isFinite(shift.x)
        && 'y' in shift && typeof shift.y === 'number' && Number.isFinite(shift.y)) {
        this._layoutShift = { x: shift.x, y: shift.y }
      }
    }
  }

  /** Раскрывает панель, удерживая владельца на месте и не меняя сохранённую раскладку. */
  public toggleResources(id: string): void {
    if (!this._graph.resources.has(id)) {
      return
    }
    const before = this.scene.nodes.find(node => node.id === id)?.position
    const expanded = new Set(this._expandedResources)
    if (expanded.has(id)) {
      expanded.delete(id)
    }
    else {
      expanded.add(id)
    }
    this._expandedResources = expanded
    const after = this.scene.nodes.find(node => node.id === id)?.position
    if (before && after) {
      this._layoutShift = {
        x: this._layoutShift.x + before.x - after.x,
        y: this._layoutShift.y + before.y - after.y,
      }
    }
  }

  /** Transient selection принадлежит проекции и не входит в persisted layout/view state. */
  public setSelection(ids: ReadonlySet<string>): void {
    this._selectedIds = new Set([...ids].filter(id => this._graph.nodes.has(id)))
  }

  public get selection(): WorkflowSelection[] {
    return getWorkflowSelection(this._graph, this._selectedIds)
  }

  public get focus(): Map<string, number> {
    return getWorkflowFocus(this._graph, this._selectedIds)
  }

  /** Возвращает выразительность логических узлов независимо от раскрытия панелей. */
  public getFocus(selected: ReadonlySet<string>): Map<string, number> {
    return getWorkflowFocus(this._graph, selected)
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  private _resourceRows(id: string): WorkflowResourceRow[] {
    const rows = new Map<string, WorkflowNodeData[]>()
    for (const resourceId of this._graph.resources.get(id) ?? []) {
      const resource = this._graph.nodes.get(resourceId)!
      const type = resource.documentType ?? resource.kind
      const items = rows.get(type) ?? []
      items.push(resource)
      rows.set(type, items)
    }
    const order = ['style', 'i18n-bundles', 'vocabs', 'stream']
    return [...rows].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([type, items]) => ({ type, items }))
  }

  private _resourceColumns(id: string): number {
    return Math.min(RESOURCE_COLUMNS, Math.max(3, ...this._resourceRows(id).map(row => row.items.length)))
  }

  private _nodeWidth(id: string): number {
    return this._expandedResources.has(id) ? Math.max(NODE_WIDTH, 48 + this._resourceColumns(id) * 68) : NODE_WIDTH
  }

  private _nodeHeight(id: string): number {
    if (!this._expandedResources.has(id)) {
      return NODE_HEIGHT
    }
    return NODE_HEIGHT + 16 + this._resourceRows(id).reduce((height, row) =>
      height + Math.ceil(row.items.length / this._resourceColumns(id)) * RESOURCE_ROW_HEIGHT + 8, 0)
  }

  /** Композиции одного уровня стоят в общей колонке; их содержимое образует компактные группы. */
  private _buildScene(): { nodes: WorkflowNode[], edges: WorkflowEdge[] } {
    const nodes: WorkflowNode[] = []
    const edges: WorkflowEdge[] = []
    const graph = this._graph
    const levels: { left: number, right: number, x: number }[] = []
    const blocks = new Map<string, {
      depth: number
      height: number
      ownerHeight: number
      childrenHeight: number
      branches: string[]
      stores: string[]
      columns: { children: string[], height: number }[]
    }>()
    const measure = (id: string, depth: number): void => {
      const children = graph.children.get(id) ?? []
      const stores = children.filter(child => graph.nodes.get(child)?.documentType === 'store')
      const branches = children.filter(child => !stores.includes(child)
        && (graph.nodes.get(child)?.kind === 'composition' || graph.nodes.get(child)?.kind === 'scope' || graph.children.get(child)?.length))
      const contents = children.filter(child => !stores.includes(child) && !branches.includes(child))
      branches.forEach(child => measure(child, depth + 1))
      const columns = []
      for (let index = 0; index < contents.length; index += CONTENT_ROWS) {
        const children = contents.slice(index, index + CONTENT_ROWS)
        children.forEach(child => measure(child, depth + 1 + index / CONTENT_ROWS))
        columns.push({
          children,
          height: children.reduce((sum, child) => sum + blocks.get(child)!.height + ROW_GAP, -ROW_GAP),
        })
      }
      const width = this._nodeWidth(id)
      const storeWidth = Math.min(stores.length, STORE_COLUMNS) * (NODE_WIDTH + ROW_GAP) - ROW_GAP
      const left = Math.max(0, (storeWidth - width) / 2)
      const level = levels[depth] ?? { left: 0, right: 0, x: 0 }
      levels[depth] = { ...level, left: Math.max(level.left, left), right: Math.max(level.right, width + left) }
      const ownerHeight = this._nodeHeight(id) + Math.ceil(stores.length / STORE_COLUMNS) * (NODE_HEIGHT + ROW_GAP)
      const groupHeights = branches.map(child => blocks.get(child)!.height)
      if (columns.length) {
        groupHeights.push(Math.max(...columns.map(column => column.height)))
      }
      const childrenHeight = groupHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, groupHeights.length - 1) * BRANCH_GAP
      blocks.set(id, { depth, stores, branches, columns, ownerHeight, childrenHeight, height: Math.max(ownerHeight, childrenHeight) })
    }
    graph.roots.forEach(root => measure(root, 0))
    levels.forEach((level, depth) => {
      const previous = levels[depth - 1]
      level.x = previous ? previous.x + previous.right + COLUMN_GAP + level.left : level.left
    })
    const addNode = (id: string, x: number, y: number): void => {
      const data = graph.nodes.get(id)!
      const position = { ...(this._layout?.positions[id] ?? { x: x + this._layoutShift.x, y: y + this._layoutShift.y }) }
      nodes.push({ id, position, data: { ...data, resourceRows: this._resourceRows(id), resourcesExpanded: this._expandedResources.has(id), resourceColumns: this._resourceColumns(id), width: this._nodeWidth(id) } })
    }
    const place = (id: string, top: number): void => {
      const block = blocks.get(id)!
      const ownX = levels[block.depth]!.x
      const ownerTop = top + (block.height - block.ownerHeight) / 2
      addNode(id, ownX, ownerTop + block.ownerHeight - this._nodeHeight(id))
      block.stores.forEach((store, index) => {
        const columnCount = Math.min(STORE_COLUMNS, block.stores.length - Math.floor(index / STORE_COLUMNS) * STORE_COLUMNS)
        const rowWidth = columnCount * (NODE_WIDTH + ROW_GAP) - ROW_GAP
        addNode(store, ownX + (this._nodeWidth(id) - rowWidth) / 2 + (index % STORE_COLUMNS) * (NODE_WIDTH + ROW_GAP), ownerTop + Math.floor(index / STORE_COLUMNS) * (NODE_HEIGHT + ROW_GAP))
        edges.push({ id: `${store}->${id}`, source: store, target: id, resource: true, logicalSource: id, logicalTarget: store, sourceHandle: 'bottom' })
      })
      const connect = (child: string): void => {
        edges.push({ id: `${id}->${child}`, source: id, target: child, resource: false, logicalSource: id, logicalTarget: child, sourceHandle: 'right' })
      }
      let childTop = top + (block.height - block.childrenHeight) / 2
      for (const child of block.branches) {
        place(child, childTop)
        connect(child)
        childTop += blocks.get(child)!.height + BRANCH_GAP
      }
      const contentsHeight = Math.max(0, ...block.columns.map(column => column.height))
      for (const column of block.columns) {
        let rowTop = childTop + (contentsHeight - column.height) / 2
        for (const child of column.children) {
          place(child, rowTop)
          connect(child)
          rowTop += blocks.get(child)!.height + ROW_GAP
        }
      }
    }
    let top = 0
    for (const root of graph.roots) {
      place(root, top)
      top += blocks.get(root)!.height + BRANCH_GAP
    }
    return { nodes, edges }
  }

  /**
   * ----------------------------------------
   * ACCESS
   * ----------------------------------------
   */

  public get scene(): { nodes: WorkflowNode[], edges: WorkflowEdge[] } {
    return this._buildScene()
  }

  /** Личный UI snapshot не входит в metadata и dirty-state проекта. */
  public get viewState(): WorkflowViewState {
    return {
      version: 1,
      expandedResourceIds: [...this._expandedResources],
      ...(this._viewport ? { viewport: { ...this._viewport } } : {}),
      layoutShift: { ...this._layoutShift },
    }
  }

  public get viewport(): Readonly<WorkflowViewport> | null {
    return this._viewport
  }

  public get compositionCount(): number {
    return this._roots?.length ?? 0
  }

  public get initialized(): boolean {
    return this._roots !== null
  }

  public get layoutEditable(): boolean {
    return this._layout !== null
  }

  /** Только сохраняемые данные; камера, выделение и дерево не входят в snapshot. */
  public get layout(): WorkflowLayout | null {
    return this._layout && {
      schemaVersion: 1,
      positions: Object.fromEntries(Object.entries(this._layout.positions).map(([id, point]) => [id, { ...point }])),
    }
  }
}
