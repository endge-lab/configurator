import type { ExtractTypeFolderOption } from './extract-type.types'

interface TypeFolderLike {
  id?: string | number
  identity?: string
  name?: string
  displayName?: string
  entityType?: string | null
  parent?: string | number | null
  parentId?: string | number | null
  deletedAt?: string | null
}

const TYPES_ROOT_IDENTITY = 'root-types'
const SOFT_DELETED_IDENTITY = 'soft-deleted'

export function buildExtractTypeFolderOptions(folders: readonly TypeFolderLike[]): ExtractTypeFolderOption[] {
  const typeFolders = folders.filter(folder => folder.entityType === 'types' && !folder.deletedAt)
  const root = typeFolders.find(folder => folder.identity === TYPES_ROOT_IDENTITY)
  const rootId = root ? readFolderId(root) : null
  if (!rootId) {
    return []
  }

  const result: ExtractTypeFolderOption[] = []
  collectChildren(typeFolders, rootId, [], new Set([rootId]), result)
  return result
}

function collectChildren(
  folders: readonly TypeFolderLike[],
  parentId: string,
  parentPath: string[],
  visited: Set<string>,
  result: ExtractTypeFolderOption[],
): void {
  const children = folders
    .filter(folder => readParentId(folder) === parentId && folder.identity !== SOFT_DELETED_IDENTITY)
    .sort((left, right) => readFolderName(left).localeCompare(readFolderName(right), 'ru'))

  for (const folder of children) {
    const id = readFolderId(folder)
    if (!id || visited.has(id)) {
      continue
    }
    const name = readFolderName(folder)
    const path = [...parentPath, name]
    result.push({ id, name, path: path.join(' / ') })
    collectChildren(folders, id, path, new Set([...visited, id]), result)
  }
}

function readFolderId(folder: TypeFolderLike): string {
  return String(folder.id ?? folder.identity ?? '')
}

function readParentId(folder: TypeFolderLike): string | null {
  const parent = folder.parent ?? folder.parentId ?? null
  return parent == null || parent === '' ? null : String(parent)
}

function readFolderName(folder: TypeFolderLike): string {
  return String(folder.displayName ?? folder.name ?? folder.identity ?? folder.id ?? '')
}
