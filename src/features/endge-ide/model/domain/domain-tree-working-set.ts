import type {
  DomainWorkingSetMember,
  DomainWorkingSetRef,
  DomainWorkingSetResult,
} from '@/features/endge-ide/domain/types/domain-working-set.type'
import type {
  DomainTreeRootBlock,
  FlatFsItem,
  FsFileNode,
  FsNode,
} from '@/features/endge-ide/model/domain/domain-tree'

import {
  domainWorkingSetRefsMatch,
  getDomainWorkingSetRefKey,
  normalizeDomainWorkingSetEntityType,
} from '@/features/endge-ide/tools/resolve-domain-working-set'

const ROLE_ORDER: Record<DomainWorkingSetMember['role'], number> = {
  root: 0,
  dependency: 1,
  context: 2,
}

export type DomainWorkingSetFolderMode = 'flat' | 'root-folders'

export interface DomainWorkingSetProjectionOptions {
  folderMode: DomainWorkingSetFolderMode
  preserveGroups: boolean
}

export interface DomainWorkingSetProjectedRoot {
  rootId: string
  items: FlatFsItem[]
}

export interface DomainWorkingSetProjectedBlock extends DomainTreeRootBlock {
  roots: DomainWorkingSetProjectedRoot[]
}

/** Преобразует file node дерева в ссылку working-set graph. */
export function domainFileNodeToWorkingSetRef(node: FsFileNode): DomainWorkingSetRef {
  return {
    entityType: normalizeDomainWorkingSetEntityType(node.docType),
    id: node.id,
    identity: node.identity,
  }
}

function collectFileItems(
  nodes: readonly FsNode[],
  parentPath = '',
  depth = 0,
  rootId = '',
): FlatFsItem[] {
  const items: FlatFsItem[] = []

  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name
    const currentRootId = depth === 0 && node.type === 'folder' ? node.id : rootId

    if (node.type === 'file') {
      items.push({ node, path, depth, rootId: currentRootId })
    }

    if (node.children?.length) {
      items.push(...collectFileItems(node.children, path, depth + 1, currentRootId))
    }
  }

  return items
}

/** Проецирует найденные working-set документы в плоский список или под исходные корневые папки. */
export function projectDomainWorkingSetItems(
  tree: readonly FsNode[],
  result: DomainWorkingSetResult,
  expandedPaths: ReadonlySet<string>,
  options: DomainWorkingSetProjectionOptions,
): FlatFsItem[] {
  const members = [...result.members.values()]
  const projected: Array<{ item: FlatFsItem, member: DomainWorkingSetMember }> = []
  const emitted = new Set<string>()

  for (const item of collectFileItems(tree)) {
    const node = item.node as FsFileNode
    if (node.isTableColumn) {
      continue
    }

    const ref = domainFileNodeToWorkingSetRef(node)
    const member = members.find(candidate => domainWorkingSetRefsMatch(candidate.ref, ref))
    if (!member) {
      continue
    }

    const key = getDomainWorkingSetRefKey(member.ref)
    if (emitted.has(key)) {
      continue
    }
    emitted.add(key)

    projected.push({
      member,
      item: {
        node: { ...node, children: undefined },
        path: item.path,
        depth: 1,
        rootId: item.rootId,
      },
    })
  }

  const sortedProjected = projected.sort((left, right) => {
    const role = ROLE_ORDER[left.member.role] - ROLE_ORDER[right.member.role]
    if (role !== 0) {
      return role
    }
    const depth = left.member.depth - right.member.depth
    if (depth !== 0) {
      return depth
    }
    const type = left.member.ref.entityType.localeCompare(right.member.ref.entityType)
    if (type !== 0) {
      return type
    }
    return left.item.node.name.localeCompare(right.item.node.name)
  })

  if (options.folderMode === 'flat') {
    return sortedProjected.map(entry => ({ ...entry.item, depth: 0 }))
  }

  const projectedByRoot = new Map<string, Array<{ item: FlatFsItem, member: DomainWorkingSetMember }>>()
  for (const entry of sortedProjected) {
    const rootFiles = projectedByRoot.get(entry.item.rootId) ?? []
    rootFiles.push(entry)
    projectedByRoot.set(entry.item.rootId, rootFiles)
  }

  const items: FlatFsItem[] = []
  for (const node of tree) {
    if (node.type !== 'folder') {
      continue
    }

    const rootFiles = projectedByRoot.get(node.id)
    if (!rootFiles?.length) {
      continue
    }

    const path = node.name
    items.push({ node, path, depth: 0, rootId: node.id })
    if (expandedPaths.has(path)) {
      items.push(...rootFiles.map(entry => entry.item))
    }
  }

  return items
}

/** Группирует projection независимо от режима сохранения папок. */
export function groupDomainWorkingSetItems(
  items: readonly FlatFsItem[],
  rootBlocks: readonly DomainTreeRootBlock[],
  rootOrder: readonly string[],
  options: DomainWorkingSetProjectionOptions,
): DomainWorkingSetProjectedBlock[] {
  const itemsByRoot = new Map<string, FlatFsItem[]>()
  for (const item of items) {
    const rootItems = itemsByRoot.get(item.rootId) ?? []
    rootItems.push(item)
    itemsByRoot.set(item.rootId, rootItems)
  }

  if (options.preserveGroups) {
    return rootBlocks
      .map(block => ({
        ...block,
        roots: block.rootIds
          .map(rootId => ({ rootId, items: itemsByRoot.get(rootId) ?? [] }))
          .filter(root => root.items.length > 0),
      }))
      .filter(block => block.roots.length > 0)
  }

  if (options.folderMode === 'flat') {
    return [{
      id: 'working-set',
      title: '',
      rootIds: ['working-set'],
      showTitle: false,
      roots: [{ rootId: 'working-set', items: [...items] }],
    }]
  }

  const rootIds = rootOrder.filter(rootId => itemsByRoot.has(rootId))
  return [{
    id: 'working-set',
    title: '',
    rootIds,
    showTitle: false,
    roots: rootIds.map(rootId => ({
      rootId,
      items: itemsByRoot.get(rootId) ?? [],
    })),
  }]
}
