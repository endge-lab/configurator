import type {
  DomainWorkingSetGraph,
  DomainWorkingSetMember,
  DomainWorkingSetRef,
  DomainWorkingSetResult,
} from '@/features/endge-ide/domain/types/domain-working-set.type'

/** Нормализует UI document type к типу сущности compiled dependency graph. */
export function normalizeDomainWorkingSetEntityType(documentType: string): string {
  if (documentType.startsWith('query-')) {
    return 'query'
  }
  if (documentType === 'default-filter') {
    return 'filter'
  }
  if (documentType === 'mock-data') {
    return 'mock'
  }
  return documentType
}

/** Формирует стабильный ключ документа, предпочитая persisted identity. */
export function getDomainWorkingSetRefKey(ref: DomainWorkingSetRef): string {
  const identity = String(ref.identity ?? '').trim()
  const id = String(ref.id ?? '').trim()
  return `${ref.entityType}:${identity || id}`
}

/** Сопоставляет persisted и актуальную ссылки, предпочитая stable identity. */
export function domainWorkingSetRefsMatch(
  left: DomainWorkingSetRef,
  right: DomainWorkingSetRef,
): boolean {
  if (normalizeDomainWorkingSetEntityType(left.entityType) !== normalizeDomainWorkingSetEntityType(right.entityType)) {
    return false
  }

  const leftIdentity = String(left.identity ?? '').trim()
  const rightIdentity = String(right.identity ?? '').trim()
  if (leftIdentity && rightIdentity) {
    return leftIdentity === rightIdentity
  }

  const leftValues = new Set([left.id, left.identity]
    .filter(value => value != null && String(value).trim() !== '')
    .map(String))
  return [right.id, right.identity]
    .filter(value => value != null && String(value).trim() !== '')
    .some(value => leftValues.has(String(value)))
}

/**
 * Строит ограниченный working set: dependencies обходятся только по исходящим
 * связям, а owner chain добавляется как context без обратного раскрытия вниз.
 */
export function resolveDomainWorkingSet(
  roots: readonly DomainWorkingSetRef[],
  graph: DomainWorkingSetGraph,
): DomainWorkingSetResult {
  const members = new Map<string, DomainWorkingSetMember>()
  const dependencyQueue: DomainWorkingSetMember[] = []

  for (const root of roots) {
    const key = getDomainWorkingSetRefKey(root)
    if (members.has(key)) {
      continue
    }

    const member: DomainWorkingSetMember = {
      ref: root,
      role: 'root',
      depth: 0,
      reachedFrom: null,
    }
    members.set(key, member)
    dependencyQueue.push(member)
  }

  for (let index = 0; index < dependencyQueue.length; index++) {
    const current = dependencyQueue[index]
    if (!current) {
      continue
    }

    const currentKey = getDomainWorkingSetRefKey(current.ref)
    for (const dependency of graph.dependenciesOf(current.ref)) {
      const dependencyKey = getDomainWorkingSetRefKey(dependency)
      if (members.has(dependencyKey)) {
        continue
      }

      const member: DomainWorkingSetMember = {
        ref: dependency,
        role: 'dependency',
        depth: current.depth + 1,
        reachedFrom: currentKey,
      }
      members.set(dependencyKey, member)
      dependencyQueue.push(member)
    }
  }

  if (graph.ownerOf) {
    for (const root of roots) {
      const visitedOwners = new Set<string>()
      let child = root
      let owner = graph.ownerOf(child)

      while (owner) {
        const ownerKey = getDomainWorkingSetRefKey(owner)
        if (visitedOwners.has(ownerKey)) {
          break
        }
        visitedOwners.add(ownerKey)

        if (!members.has(ownerKey)) {
          members.set(ownerKey, {
            ref: owner,
            role: 'context',
            depth: -1,
            reachedFrom: getDomainWorkingSetRefKey(child),
          })
        }

        child = owner
        owner = graph.ownerOf(child)
      }
    }
  }

  return { members }
}
