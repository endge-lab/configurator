interface DocumentImportFolderLike {
  id?: string | number
  identity?: string
  name?: string
  displayName?: string
  entityType?: string | null
  parent?: string | number | null
  deletedAt?: string | null
}

export interface DocumentImportFolderOption {
  id: string
  path: string
}

const TYPES_ROOT_IDENTITY = 'root-types'

/** Строит плоские пути доступных Type folders для select без UI-зависимостей. */
export function buildDocumentImportFolderOptions(
  folders: readonly DocumentImportFolderLike[],
): DocumentImportFolderOption[] {
  const typeFolders = folders.filter(folder => folder.entityType === 'types' && !folder.deletedAt)
  const root = typeFolders.find(folder => folder.identity === TYPES_ROOT_IDENTITY)
  const rootId = root ? readFolderId(root) : null
  if (!rootId) {
    return []
  }

  const result: DocumentImportFolderOption[] = []
  collectChildren(typeFolders, rootId, [], new Set([rootId]), result)
  return result
}

function collectChildren(
  folders: readonly DocumentImportFolderLike[],
  parentId: string,
  parentPath: readonly string[],
  visited: ReadonlySet<string>,
  result: DocumentImportFolderOption[],
): void {
  const children = folders
    .filter(folder => readParentId(folder) === parentId)
    .sort((left, right) => readFolderName(left).localeCompare(readFolderName(right), 'ru'))

  for (const folder of children) {
    const id = readFolderId(folder)
    if (!id || visited.has(id)) {
      continue
    }
    const path = [...parentPath, readFolderName(folder)]
    result.push({ id, path: path.join(' / ') })
    collectChildren(folders, id, path, new Set([...visited, id]), result)
  }
}

function readFolderId(folder: DocumentImportFolderLike): string {
  return String(folder.id ?? folder.identity ?? '')
}

function readParentId(folder: DocumentImportFolderLike): string | null {
  return folder.parent == null || folder.parent === '' ? null : String(folder.parent)
}

function readFolderName(folder: DocumentImportFolderLike): string {
  return String(folder.displayName ?? folder.name ?? folder.identity ?? folder.id ?? '')
}
