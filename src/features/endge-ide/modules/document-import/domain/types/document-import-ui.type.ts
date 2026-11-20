import type {
  DocumentImportApplyResult,
  DocumentImportFormat,
  DocumentImportPlan,
} from '@endge/core'

// Состояния пользовательского сценария выборочного импорта документов.
export type EndgeIDEDocumentImportStatus
  = | 'idle'
    | 'preparing'
    | 'ready'
    | 'applying'
    | 'completed'
    | 'error'

// Реактивное состояние диалога, принадлежащее IDE Module.
export interface EndgeIDEDocumentImportState {
  open: boolean
  format: DocumentImportFormat | null
  status: EndgeIDEDocumentImportStatus
  sourceName: string
  plan: DocumentImportPlan | null
  selectedCandidateIds: string[]
  folderId: string | number | null
  errorMessage: string
  result: DocumentImportApplyResult | null
}

// Прочитанная схема из файла, URL или кеша редактора GraphQL.
export interface EndgeIDEDocumentImportSource {
  source: string
  sourceName: string
}
