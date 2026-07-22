import type { DomainDocumentType, DomainSectionType } from '@endge/core'

export type CreateDocumentKind = DomainDocumentType | 'query-composition'

export interface DocumentCreateDescriptor {
  type: CreateDocumentKind
  label: string
  description: string
  keywords: string[]
  defaultName: string
  section: DomainSectionType
  group: string
  supportsFolder: boolean
  supportsDescription: boolean
}
