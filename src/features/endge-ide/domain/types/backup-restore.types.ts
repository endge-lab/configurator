import type { DomainDocumentType } from '@endge/core'

export type BackupRestoreEntityKind =
  | 'project'
  | 'type'
  | 'query'
  | 'component'
  | 'action'
  | 'parameter'
  | 'filter'
  | 'composition'
  | 'store'
  | 'converter'
  | 'integration'
  | 'environment'
  | 'tenant'
  | 'policy'
  | 'style'
  | 'vocabs'
  | 'auth-profile'
  | 'page-template'
  | 'page'
  | 'navigation'

export interface BackupRestoreEntityItem {
  key: string
  documentType: DomainDocumentType
  entityKind: BackupRestoreEntityKind
  sectionTitle: string
  title: string
  identity: string
  importedId: string | number | null
  existsInCurrentDomain: boolean
  currentId: string | number | null
}

export interface BackupRestoreParsedFile {
  fileName: string
  source: 'bundle' | 'plain'
  plainDomain: Record<string, unknown>
  importedDomain: unknown
  items: BackupRestoreEntityItem[]
}

export interface BackupRestoreImportResult {
  importedCount: number
  replacedCount: number
  createdCount: number
}
