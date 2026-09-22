import type {
  DomainWorkingSetFilterState,
  DomainWorkingSetRef,
} from '@/features/endge-ide/domain/types/domain-working-set.type'

import { domainWorkingSetRefsMatch } from '@/features/endge-ide/tools/resolve-domain-working-set'

function isWorkingSetRef(value: unknown): value is DomainWorkingSetRef {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DomainWorkingSetRef>
  return typeof candidate.entityType === 'string'
    && candidate.entityType.trim() !== ''
    && (typeof candidate.id === 'string' || typeof candidate.id === 'number')
}

/** Возвращает сохранённый фильтр только если все его roots существуют в домене. */
export function restoreDomainWorkingSetFilter(
  persisted: unknown,
  available: readonly DomainWorkingSetRef[],
): DomainWorkingSetFilterState | null {
  if (!persisted || typeof persisted !== 'object') {
    return null
  }

  const candidate = persisted as Partial<DomainWorkingSetFilterState>
  if (candidate.enabled !== true || !Array.isArray(candidate.roots)) {
    return null
  }

  const roots = candidate.roots.filter(isWorkingSetRef)
  if (roots.length === 0 || roots.length !== candidate.roots.length) {
    return null
  }

  const resolvedRoots: DomainWorkingSetRef[] = []
  for (const root of roots) {
    const currentDocument = available.find(document => domainWorkingSetRefsMatch(root, document))
    if (!currentDocument) {
      return null
    }
    resolvedRoots.push(currentDocument)
  }

  return {
    enabled: true,
    roots: resolvedRoots.map(root => ({ ...root })),
  }
}
