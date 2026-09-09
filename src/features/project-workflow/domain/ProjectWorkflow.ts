import type { DomainDocumentType } from '@endge/core'

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
  children: WorkflowDependency[]
}

export interface WorkflowPoint { x: number, y: number }
export interface WorkflowLayout {
  schemaVersion: 1
  positions: Record<string, WorkflowPoint>
}
export interface WorkflowViewport extends WorkflowPoint { zoom: number }
export type WorkflowNodeData = Omit<WorkflowDependency, 'children'>
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
  route: { kind: 'resource', x: number, exitY: number, entryY: number }
    | { kind: 'branch', exitX: number, entryX: number, y: number }
}

const NODE_WIDTH = 248
const NODE_HEIGHT = 176
const ROW_GAP = 32
const COLUMN_GAP = 112
const RESOURCE_COLUMNS = 4
const BRANCH_ROWS = 2
const BRANCH_ROUTE_GAP = 64

/** Черновик раскладки и временное полотно editor-сессии; transport принадлежит IDE. */
export class ProjectWorkflow {
  private _roots: WorkflowDependency[] | null = null
  private readonly _layout: WorkflowLayout | null
  private _nodeIds = new Set<string>()
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
    const ids = new Set<string>()
    const visit = (node: WorkflowDependency): void => {
      ids.add(node.id)
      node.children.forEach(visit)
    }
    roots.forEach(visit)
    this._nodeIds = ids
  }

  /** Перенос меняет только визуальные координаты, а не scope или зависимости. */
  public moveNodes(nodes: { id: string, position: WorkflowPoint }[]): void {
    if (!this._layout) {
      return
    }
    for (const node of nodes) {
      if (this._nodeIds.has(node.id) && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
        this._layout.positions[node.id] = { ...node.position }
      }
    }
  }

  public setViewport(viewport: WorkflowViewport): void {
    this._viewport = { ...viewport }
  }

  public resetLayout(): void {
    if (this._layout) {
      this._layout.positions = {}
    }
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  private _isResource(node: WorkflowDependency): boolean {
    return node.kind === 'data' || node.kind === 'resource'
  }

  /** Горизонтальные группы ветвей; data и ресурсы занимают место над владельцем. */
  private _buildScene(): { nodes: WorkflowNode[], edges: WorkflowEdge[] } {
    const nodes: WorkflowNode[] = []
    const edges: WorkflowEdge[] = []
    const blocks = new Map<string, {
      width: number
      height: number
      ownerWidth: number
      ownerHeight: number
      columns: { children: WorkflowDependency[], width: number, height: number }[]
    }>()
    const measure = (node: WorkflowDependency): void => {
      const resources = node.children.filter(child => this._isResource(child))
      const branches = node.children.filter(child => !this._isResource(child))
      branches.forEach(measure)
      const ownerWidth = Math.max(NODE_WIDTH, Math.min(resources.length, RESOURCE_COLUMNS) * (NODE_WIDTH + ROW_GAP) - ROW_GAP)
      const ownerHeight = NODE_HEIGHT + Math.ceil(resources.length / RESOURCE_COLUMNS) * (NODE_HEIGHT + ROW_GAP)
      const columns = []
      for (let index = 0; index < branches.length; index += BRANCH_ROWS) {
        const children = branches.slice(index, index + BRANCH_ROWS)
        columns.push({
          children,
          width: Math.max(...children.map(child => blocks.get(child.id)!.width)),
          height: children.reduce((sum, child) => sum + blocks.get(child.id)!.height + ROW_GAP, -ROW_GAP),
        })
      }
      blocks.set(node.id, {
        ownerWidth,
        ownerHeight,
        columns,
        width: ownerWidth + columns.reduce((sum, column) => sum + COLUMN_GAP + column.width, 0),
        height: Math.max(ownerHeight, ...columns.map(column => column.height + BRANCH_ROUTE_GAP)),
      })
    }
    this._roots?.forEach(measure)
    const addNode = (node: WorkflowDependency, x: number, y: number): WorkflowPoint => {
      const { children, ...data } = node
      const position = { ...(this._layout?.positions[node.id] ?? { x, y }) }
      nodes.push({ id: node.id, position, data })
      return position
    }
    const place = (node: WorkflowDependency, left: number, top: number): WorkflowPoint => {
      const resources = node.children.filter(child => this._isResource(child))
      const block = blocks.get(node.id)!
      const ownerTop = top + (block.height - block.ownerHeight) / 2
      const ownX = left + (block.ownerWidth - NODE_WIDTH) / 2
      const ownY = ownerTop + block.ownerHeight - NODE_HEIGHT
      const ownPosition = addNode(node, ownX, ownY)
      resources.forEach((resource, index) => {
        const columnCount = Math.min(RESOURCE_COLUMNS, resources.length - Math.floor(index / RESOURCE_COLUMNS) * RESOURCE_COLUMNS)
        const rowWidth = columnCount * (NODE_WIDTH + ROW_GAP) - ROW_GAP
        const resourcePosition = addNode(resource, left + (block.ownerWidth - rowWidth) / 2 + (index % RESOURCE_COLUMNS) * (NODE_WIDTH + ROW_GAP), ownerTop + Math.floor(index / RESOURCE_COLUMNS) * (NODE_HEIGHT + ROW_GAP))
        edges.push({
          id: `${resource.id}->${node.id}`,
          source: resource.id,
          target: node.id,
          resource: true,
          route: {
            kind: 'resource',
            x: resourcePosition.x + NODE_WIDTH + ROW_GAP / 2,
            exitY: resourcePosition.y + NODE_HEIGHT + ROW_GAP / 2,
            entryY: ownPosition.y - ROW_GAP / 2,
          },
        })
      })
      let childLeft = left + block.ownerWidth + COLUMN_GAP
      for (const column of block.columns) {
        let childTop = top + BRANCH_ROUTE_GAP + (block.height - BRANCH_ROUTE_GAP - column.height) / 2
        for (const child of column.children) {
          const childPosition = place(child, childLeft, childTop)
          edges.push({
            id: `${node.id}->${child.id}`,
            source: node.id,
            target: child.id,
            resource: false,
            route: {
              kind: 'branch',
              exitX: Math.max(left + block.ownerWidth, ownPosition.x + NODE_WIDTH) + ROW_GAP,
              entryX: Math.min(childLeft, childPosition.x) - ROW_GAP,
              y: Math.min(top + ROW_GAP / 2, ownPosition.y - ROW_GAP, childPosition.y - ROW_GAP),
            },
          })
          childTop += blocks.get(child.id)!.height + ROW_GAP
        }
        childLeft += column.width + COLUMN_GAP
      }
      return ownPosition
    }
    let left = 0
    for (const root of this._roots ?? []) {
      place(root, left, 0)
      left += blocks.get(root.id)!.width + COLUMN_GAP
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
