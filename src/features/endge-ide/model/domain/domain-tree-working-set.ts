import type {
  DomainWorkingSetMember,
  DomainWorkingSetRef,
  DomainWorkingSetResult,
} from '@/features/endge-ide/domain/types/domain-working-set.type'
import type { FlatFsItem, FsFileNode, FsNode } from '@/features/endge-ide/model/domain/domain-tree'

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

/** Показывает найденные working-set документы одним плоским списком без папок. */
export function projectDomainWorkingSetFiles(
  tree: readonly FsNode[],
  result: DomainWorkingSetResult,
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
        depth: 0,
        rootId: 'working-set',
      },
    })
  }

  return projected
    .sort((left, right) => {
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
    .map(entry => entry.item)
}
