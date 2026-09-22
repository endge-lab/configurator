import type { DomainDocumentType } from '@endge/core'

import { Endge } from '@endge/core'

/** Разрешает executable SFC и legacy Component по общей source-ссылке. */
export function resolveComponentDocument(identity: string): {
  documentId: string
  documentType: DomainDocumentType
} | null {
  const component = Endge.domain.getComponentSFC(identity) ?? Endge.domain.getComponent(identity)
  return component
    ? {
        documentId: String(component.identity),
        documentType: component.type as DomainDocumentType,
      }
    : null
}
