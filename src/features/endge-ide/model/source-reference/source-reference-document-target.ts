import type { DomainDocumentType, SourceDocumentReference } from '@endge/core'

import { Endge } from '@endge/core'

import { resolveComponentDocument } from '@/features/endge-ide/tools/resolve-component-document'

export interface SourceReferenceDocumentTarget {
  documentId: string
  documentType: DomainDocumentType
}

/** Resolves a semantic source reference to a stable authoring-document target. */
export function resolveSourceReferenceDocumentTarget(
  reference: SourceDocumentReference,
): SourceReferenceDocumentTarget | null {
  if (reference.target === 'query') {
    const entity = Endge.domain.getQuery(reference.identity)
    return entity ? { documentId: entity.identity, documentType: entity.type } : null
  }
  if (reference.target === 'component') {
    return resolveComponentDocument(reference.identity)
  }
  if (reference.target === 'filter') {
    const entity = Endge.domain.getFilter(reference.identity)
    return entity ? { documentId: entity.identity, documentType: entity.type } : null
  }
  if (reference.target === 'type') {
    const entity = Endge.domain.getType(reference.identity)
    return entity && !entity.isPrimitive
      ? { documentId: entity.identity, documentType: 'type' }
      : null
  }

  const fixedTargets = {
    'auth-profile': { documentType: 'auth-profile', resolve: () => Endge.domain.getAuthProfile(reference.identity) },
    'composition': { documentType: 'composition', resolve: () => Endge.domain.getComposition(reference.identity) },
    'computation': { documentType: 'computation', resolve: () => Endge.domain.getComputation(reference.identity) },
    'converter': { documentType: 'converter', resolve: () => Endge.domain.getConverter(reference.identity) },
    'data-view': { documentType: 'data-view', resolve: () => Endge.domain.getDataView(reference.identity) },
    'mock': { documentType: 'mock', resolve: () => Endge.domain.getMock(reference.identity) },
    'store': { documentType: 'store', resolve: () => Endge.domain.getStore(reference.identity) },
    'style': { documentType: 'style', resolve: () => Endge.domain.getStyle(reference.identity) },
    'vocabs': { documentType: 'vocabs', resolve: () => Endge.domain.getVocab(reference.identity) },
  } satisfies Record<
    Exclude<SourceDocumentReference['target'], 'query' | 'component' | 'filter' | 'type'>,
    { documentType: DomainDocumentType, resolve: () => { identity?: unknown } | null }
  >
  const target = fixedTargets[reference.target]
  const entity = target.resolve()
  if (!entity) {
    return null
  }
  return {
    documentId: String(entity.identity ?? reference.identity),
    documentType: target.documentType,
  }
}
