import { ref } from 'vue'

/** Один узел в иерархии (папка или файл) - от корня до перетаскиваемой сущности */
export interface DomainDragHierarchyNode {
  path: string
  depth: number
  type: 'folder' | 'file'
  id: string
  identity?: string
  name: string
  sectionType?: string
  docType?: string
  isRoot?: boolean
  folderId?: string | number
}

/** Дерево одной перетаскиваемой сущности: путь и полная иерархия от корня */
export interface DomainDragTreeItem {
  id: string
  identity?: string
  name: string
  sectionType: string
  docType: string
  rootId: string
  path: string
  pathSegments: string[]
  depth: number
  parentPath: string | null
  /** Иерархия от корневой папки до этой сущности (все узлы по пути) */
  hierarchy: DomainDragHierarchyNode[]
}

/** Состояние перетаскивания сущности из виджета Домен */
export const domainDragState = ref<{
  active: boolean
  sectionTypes: string[]
  tree: DomainDragTreeItem[]
}>({
  active: false,
  sectionTypes: [],
  tree: [],
})

export function setDomainDrag(sectionTypes: string[], tree: DomainDragTreeItem[] = []): void {
  domainDragState.value = {
    active: true,
    sectionTypes: [...new Set(sectionTypes)],
    tree,
  }
}

export function clearDomainDrag(): void {
  domainDragState.value = { active: false, sectionTypes: [], tree: [] }
}
