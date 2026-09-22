import type { DocumentImportApplyResult, DocumentImportFormat } from '@endge/core'
import type {
  EndgeIDEDocumentImportSource,
  EndgeIDEDocumentImportState,
} from '@/features/endge-ide/modules/document-import/domain/types/document-import-ui.type'

import { Endge } from '@endge/core'
import { reactive, readonly } from 'vue'

/** Владеет состоянием пользовательского выбора поверх Core document import. */
export class EndgeIDEDocumentImport_Module {
  /** Единственный state import-dialog в рамках lifecycle EndgeIDE. */
  private readonly _state = reactive<EndgeIDEDocumentImportState>(createInitialState())

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Открывает чистый workflow для выбранного внешнего формата. */
  public open(format: DocumentImportFormat): void {
    this._replaceState({ ...createInitialState(), open: true, format })
  }

  /** Закрывает диалог, если подтверждённый импорт сейчас не выполняется. */
  public close(): void {
    if (this._state.status === 'applying') {
      return
    }
    this._replaceState(createInitialState())
  }

  /** Передаёт текст файла в Core и выбирает все готовые кандидаты. */
  public prepareSource(input: EndgeIDEDocumentImportSource): void {
    if (!this._state.format) {
      throw new Error('Document import format is not selected.')
    }
    this._state.status = 'preparing'
    this._state.fileName = input.fileName
    this._state.fileSize = input.fileSize
    this._state.plan = null
    this._state.selectedCandidateIds = []
    this._state.errorMessage = ''
    this._state.result = null
    try {
      const plan = Endge.documentImport.prepare({
        format: this._state.format,
        source: input.source,
        sourceName: input.fileName,
      })
      this._state.plan = plan
      this._state.selectedCandidateIds = plan.candidates
        .filter(candidate => candidate.status === 'ready')
        .map(candidate => candidate.id)
      this._state.status = 'ready'
    }
    catch (error) {
      this._state.status = 'error'
      this._state.errorMessage = errorText(error)
    }
  }

  /** Изменяет выбор одного доступного кандидата. */
  public setCandidateSelected(candidateId: string, selected: boolean): void {
    const candidate = this._state.plan?.candidates.find(item => item.id === candidateId)
    if (!candidate || candidate.status !== 'ready') {
      return
    }
    const next = new Set(this._state.selectedCandidateIds)
    if (selected) {
      next.add(candidateId)
    }
    else {
      next.delete(candidateId)
    }
    this._state.selectedCandidateIds = [...next]
  }

  /** Выбирает все готовые к созданию документы текущего plan. */
  public selectAllReady(): void {
    this._state.selectedCandidateIds = this._state.plan?.candidates
      .filter(candidate => candidate.status === 'ready')
      .map(candidate => candidate.id) ?? []
  }

  /** Снимает пользовательский выбор без изменения подготовленного plan. */
  public clearSelection(): void {
    this._state.selectedCandidateIds = []
  }

  /** Назначает существующую папку Types для выбранных документов. */
  public setDestinationFolder(folderId: string | number | null): void {
    this._state.folderId = folderId
  }

  /** Применяет через Core только подтверждённые пользователем candidates. */
  public async apply(): Promise<DocumentImportApplyResult> {
    const plan = this._state.plan
    if (!plan) {
      throw new Error('Document import plan is not prepared.')
    }
    this._state.status = 'applying'
    this._state.errorMessage = ''
    try {
      const result = await Endge.documentImport.apply({
        planId: plan.id,
        selectedCandidateIds: this._state.selectedCandidateIds,
        destination: { folderId: this._state.folderId },
        conflictPolicy: 'skip',
      })
      this._state.result = result
      this._state.status = 'completed'
      return result
    }
    catch (error) {
      this._state.status = 'ready'
      this._state.errorMessage = errorText(error)
      throw error
    }
  }

  /** Сбрасывает dialog-state вместе с lifecycle EndgeIDE. */
  public reset(): void {
    this._replaceState(createInitialState())
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  /** Заменяет все поля reactive object без создания второго state owner. */
  private _replaceState(next: EndgeIDEDocumentImportState): void {
    Object.assign(this._state, next)
  }

  /**
   * ----------------------------------------
   * ACCESS
   * ----------------------------------------
   */

  /** Возвращает readonly Vue-представление состояния workflow. */
  public get state(): Readonly<EndgeIDEDocumentImportState> {
    return readonly(this._state) as Readonly<EndgeIDEDocumentImportState>
  }
}

function createInitialState(): EndgeIDEDocumentImportState {
  return {
    open: false,
    format: null,
    status: 'idle',
    fileName: '',
    fileSize: 0,
    plan: null,
    selectedCandidateIds: [],
    folderId: null,
    errorMessage: '',
    result: null,
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
