import type { RNavigation } from '@endge/core'
import type { NavigationTreeNodeDoc } from '@endge/core'

export type NavigationTreeNodeType = 'section' | 'group' | 'link'

export interface NavigationTreeNodeEditor {
  id: string
  type: NavigationTreeNodeType
  title: string
  icon?: string
  hidden?: boolean
  disabled?: boolean
  collapsedTitle?: string
  path?: string
  routeName?: string
  external?: boolean
  children?: NavigationTreeNodeEditor[]
}

function makeNodeId(): string {
  return `nav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneNode(node: NavigationTreeNodeEditor | NavigationTreeNodeDoc): NavigationTreeNodeEditor {
  return {
    id: node.id || makeNodeId(),
    type: node.type,
    title: String(node.title ?? ''),
    icon: node.icon ?? undefined,
    hidden: node.hidden ?? false,
    disabled: node.disabled ?? false,
    collapsedTitle: node.collapsedTitle ?? undefined,
    path: node.path ?? undefined,
    routeName: node.routeName ?? undefined,
    external: node.external ?? false,
    children: node.type !== 'link'
      ? (Array.isArray(node.children) ? node.children.map(cloneNode) : [])
      : [],
  }
}

function treeFromUnknown(raw: unknown): NavigationTreeNodeEditor[] | null {
  if (!Array.isArray(raw))
    return null

  const readNode = (value: unknown): NavigationTreeNodeEditor | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null
    const source = value as Record<string, unknown>
    const type = source.type === 'section' || source.type === 'group' || source.type === 'link'
      ? source.type
      : null
    if (!type)
      return null

    return cloneNode({
      id: typeof source.id === 'string' ? source.id : makeNodeId(),
      type,
      title: String(source.title ?? ''),
      icon: typeof source.icon === 'string' ? source.icon : undefined,
      hidden: source.hidden === true,
      disabled: source.disabled === true,
      collapsedTitle: typeof source.collapsedTitle === 'string' ? source.collapsedTitle : undefined,
      path: typeof source.path === 'string' ? source.path : undefined,
      routeName: typeof source.routeName === 'string' ? source.routeName : undefined,
      external: source.external === true,
      children: Array.isArray(source.children) ? source.children.map(readNode).filter(Boolean) as NavigationTreeNodeEditor[] : [],
    })
  }

  return raw.map(readNode).filter(Boolean) as NavigationTreeNodeEditor[]
}

/** Модель редактора для RNavigation (коллекция navigations). */
export class RNavigationEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  meta: Record<string, unknown> = {}
  tree: NavigationTreeNodeEditor[] = []

  migrateTreeFromMeta(): boolean {
    const rawMetaTree = this.meta?.endgeAdminNavigationTree
    const migrated = treeFromUnknown(rawMetaTree)
    if (!migrated?.length)
      return false
    this.tree = migrated
    return true
  }

  fillFromSource(source: RNavigation): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
    this.meta = source.meta && typeof source.meta === 'object' ? { ...source.meta } : {}
    const sourceTree = Array.isArray((source as { tree?: unknown[] }).tree) ? (source as { tree?: unknown[] }).tree : null
    const explicitTree = treeFromUnknown(sourceTree)
    this.tree = explicitTree ?? []
  }

  updateSource(source: RNavigation): void {
    source.id = this.id as number
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
    source.tree = this.tree.map(cloneNode) as unknown as RNavigation['tree']
    source.meta = this.meta && typeof this.meta === 'object' ? { ...this.meta } : {}
    delete (source.meta as Record<string, unknown>).endgeAdminNavigationTree
  }
}
