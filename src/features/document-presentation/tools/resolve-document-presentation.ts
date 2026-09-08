import type { DomainDocumentType, DomainSectionType } from '@endge/core'
import type { DomainDocumentPresentation } from '../types/document-presentation'

import { DOCUMENT_BADGE_ICONS, DOCUMENT_SECTION_BY_TYPE, DOCUMENT_TYPE_PRESENTATION, DOMAIN_SECTION_PRESENTATION, FALLBACK_PRESENTATION } from '../config/document-presentation'

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
