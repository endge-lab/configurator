import type { DiagnosticsEntityRef, DomainDocumentType } from '@endge/core'

import { Endge, FilterType } from '@endge/core'

import { resolveComponentDocument } from '@/features/endge-ide/tools/resolve-component-document'

/** Редакторский document target, разрешённый из универсальной diagnostics entity reference. */
export interface DiagnosticsDocumentTarget {
  documentId: string
  documentType: DomainDocumentType
}

/** Возвращает стабильную identity или storage id как fallback для открытия документа. */
function getReferenceDocumentId(reference: DiagnosticsEntityRef): string {
  return String(reference.identity || reference.id || '').trim()
}

/**
 * Разрешает compiler/runtime entity type в реальный authoring document type.
 * Query и Filter требуют специализации, потому что compiler использует generic types.
 */
export function resolveDiagnosticsDocumentTarget(reference: DiagnosticsEntityRef): DiagnosticsDocumentTarget | null {
  const fallbackId = getReferenceDocumentId(reference)
  if (!fallbackId) {
    return null
  }

  if (reference.entityType === 'query') {
    const query = Endge.domain.getQuery(reference.id) ?? Endge.domain.getQuery(reference.identity)
    if (!query) {
      return null
    }
    return {
      documentId: String(query.identity || fallbackId),
      documentType: query.type,
    }
  }

  if (reference.entityType === 'filter') {
    const filter = Endge.domain.getFilter(reference.id) ?? Endge.domain.getFilter(reference.identity)
    if (!filter) {
      return null
    }
    return {
      documentId: String(filter.identity || fallbackId),
      documentType: filter.type ?? FilterType.DefaultFilter,
    }
  }

  if (reference.entityType === 'component') {
    return resolveComponentDocument(String(reference.id))
      ?? resolveComponentDocument(reference.identity)
  }

  return {
    documentId: fallbackId,
    documentType: reference.entityType as DomainDocumentType,
  }
}
