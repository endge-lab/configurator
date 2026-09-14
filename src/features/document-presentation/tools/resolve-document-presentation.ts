import type { DomainDocumentType, DomainSectionType, EndgeDomainCollection } from '@endge/core'
import type { DomainDocumentPresentation } from '../types/document-presentation'

import { DOMAIN_DOCUMENT_DESCRIPTORS } from '@endge/core'
import { DOCUMENT_AUXILIARY_PRESENTATION, DOCUMENT_BADGE_ICONS, DOCUMENT_SECTION_BY_TYPE, DOCUMENT_TYPE_PRESENTATION, DOMAIN_SECTION_PRESENTATION, FALLBACK_PRESENTATION } from '../config/document-presentation'

const DOCUMENT_COLLECTION_PRESENTATION: Partial<Record<EndgeDomainCollection, DomainDocumentPresentation>> = {
  folders: DOCUMENT_AUXILIARY_PRESENTATION.folder,
  streams: DOCUMENT_TYPE_PRESENTATION.stream,
  updates: DOCUMENT_TYPE_PRESENTATION.update,
}

export function getDomainSectionPresentation(sectionType: DomainSectionType): DomainDocumentPresentation {
  return DOMAIN_SECTION_PRESENTATION[sectionType] ?? FALLBACK_PRESENTATION
}

export function getDomainDocumentPresentation(
  docType: DomainDocumentType,
  _presentationKind?: string,
): DomainDocumentPresentation {
  const key = String(docType)
  const sectionType = DOCUMENT_SECTION_BY_TYPE[key]
  const presentation = DOCUMENT_TYPE_PRESENTATION[key]
    ?? (sectionType == null ? FALLBACK_PRESENTATION : getDomainSectionPresentation(sectionType))
  const badgeIcon = DOCUMENT_BADGE_ICONS[key]
  return badgeIcon ? { ...presentation, badgeIcon } : presentation
}

/** Возвращает базовое представление persisted-коллекции без загрузки payload документа. */
export function getDomainCollectionPresentation(collection: EndgeDomainCollection): DomainDocumentPresentation {
  const explicit = DOCUMENT_COLLECTION_PRESENTATION[collection]
  if (explicit) {
    return explicit
  }
  const descriptor = Object.values(DOMAIN_DOCUMENT_DESCRIPTORS)
    .find(item => item.persistence?.collection === collection)
  return descriptor ? getDomainSectionPresentation(descriptor.section) : FALLBACK_PRESENTATION
}

/** Program uses compiler family names, which can differ from authoring document types. */
export function getProgramDocumentPresentation(entityType: string): DomainDocumentPresentation {
  const descriptor = Object.values(DOMAIN_DOCUMENT_DESCRIPTORS)
    .find(value => value.type === entityType || value.capabilities.program === entityType)
  return getDomainDocumentPresentation(descriptor?.type ?? entityType as DomainDocumentType)
}
