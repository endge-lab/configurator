import type {
  DocumentImportApplyResult,
  DocumentImportFormat,
  DocumentImportPlan,
} from '@endge/core'

/** Состояния пользовательского сценария выборочного импорта документов. */
export type EndgeIDEDocumentImportStatus
  = | 'idle'
    | 'preparing'
    | 'ready'
    | 'applying'
    | 'completed'
    | 'error'

/** Реактивное состояние диалога, принадлежащее IDE Module. */
export interface EndgeIDEDocumentImportState {
  open: boolean
  format: DocumentImportFormat | null
  status: EndgeIDEDocumentImportStatus
  fileName: string
  fileSize: number
  plan: DocumentImportPlan | null
  selectedCandidateIds: string[]
  folderId: string | number | null
  errorMessage: string
  result: DocumentImportApplyResult | null
}

/** Прочитанный UI-файл без передачи browser File API в Core. */
export interface EndgeIDEDocumentImportSource {
  source: string
  fileName: string
  fileSize: number
}
