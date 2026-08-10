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
  hierarchy: DomainDragHierarchyNode[]
}

export interface DomainDragState {
  active: boolean
  sectionTypes: string[]
  tree: DomainDragTreeItem[]
}

export interface FolderRestoreState {
  parent: string | number | null
}

export interface FolderRestoreStateOwner {
  rememberFolderRestore: (folderId: string, state: FolderRestoreState) => void
  getFolderRestore: (folderId: string) => FolderRestoreState | null
  forgetFolderRestore: (folderId: string) => void
}
