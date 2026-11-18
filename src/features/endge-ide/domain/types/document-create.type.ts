import type { DomainDocumentType, DomainSectionType } from '@endge/core'

export type CreateDocumentKind = DomainDocumentType | 'query-composition' | 'timeline-chart' | 'timeline-group'

export interface DocumentCreateDescriptor {
  type: CreateDocumentKind
  label: string
  description: string
  keywords: string[]
  defaultName: string
  section: DomainSectionType
  supportsFolder: boolean
  supportsDescription: boolean
}
