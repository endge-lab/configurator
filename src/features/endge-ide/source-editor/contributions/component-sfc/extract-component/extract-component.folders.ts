import type { ExtractComponentFolderOption } from './extract-component.types'

interface ComponentFolderLike {
  id?: string | number
  identity?: string
  name?: string
  displayName?: string
  entityType?: string | null
  parent?: string | number | null
  parentId?: string | number | null
  deletedAt?: string | null
}

const COMPONENTS_ROOT_IDENTITY = 'root-components'
const SOFT_DELETED_IDENTITY = 'soft-deleted'

export function buildExtractComponentFolderOptions(
  folders: readonly ComponentFolderLike[],
): ExtractComponentFolderOption[] {
  const componentFolders = folders.filter(folder => folder.entityType === 'components' && !folder.deletedAt)
  const root = componentFolders.find(folder => folder.identity === COMPONENTS_ROOT_IDENTITY)
  if (!root) {
    return []
  }

  const rootId = readFolderId(root)
  if (!rootId) {
    return []
  }

  const result: ExtractComponentFolderOption[] = []
  collectChildren(componentFolders, rootId, [], 1, new Set([rootId]), result)
  return result
}

function collectChildren(
  folders: readonly ComponentFolderLike[],
  parentId: string,
  parentPath: string[],
  depth: number,
  visited: Set<string>,
  result: ExtractComponentFolderOption[],
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
    result.push({ id, name, path: path.join(' / '), depth })
    collectChildren(folders, id, path, depth + 1, new Set([...visited, id]), result)
  }
}

function readFolderId(folder: ComponentFolderLike): string {
  return String(folder.id ?? folder.identity ?? '')
}

function readParentId(folder: ComponentFolderLike): string | null {
  const parent = folder.parent ?? folder.parentId ?? null
  return parent == null || parent === '' ? null : String(parent)
}

function readFolderName(folder: ComponentFolderLike): string {
  return String(folder.displayName ?? folder.name ?? folder.identity ?? folder.id ?? '')
}
