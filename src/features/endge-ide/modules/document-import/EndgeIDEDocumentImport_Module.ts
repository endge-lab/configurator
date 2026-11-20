import type { DocumentImportApplyResult, DocumentImportFormat } from '@endge/core'
import type {
  EndgeIDEDocumentImportSource,
  EndgeIDEDocumentImportState,
} from '@/features/endge-ide/modules/document-import/domain/types/document-import-ui.type'

import { Endge } from '@endge/core'
import { reactive, readonly } from 'vue'

import { loadDocumentImportSource } from '@/features/endge-ide/modules/document-import/services/document-import-source'

/**
 * Владеет состоянием пользовательского выбора поверх Core document import.
 */
export class EndgeIDEDocumentImport_Module {
  // Единственный state import-dialog в рамках lifecycle EndgeIDE.
  private readonly _state = reactive<EndgeIDEDocumentImportState>(createInitialState())
  private _sourceRequest: AbortController | null = null

  // ---------------------------------------------
  // PUBLIC API
  // ---------------------------------------------

  /**
   * Открывает чистый workflow для выбранного внешнего формата.
   */
  public open(format: DocumentImportFormat): void {
    this._replaceState({ ...createInitialState(), open: true, format })
  }

  /**
   * Открывает workflow с уже прочитанным документом, например сохранённой схемой GraphQL.
   */
  public openSource(format: DocumentImportFormat, input: EndgeIDEDocumentImportSource): void {
    this.open(format)
    this._prepareSource(input)
  }

  /**
   * Закрывает диалог, если подтверждённый импорт сейчас не выполняется.
   */
  public close(): void {
    if (this._state.status === 'applying') {
      return
    }
    this._replaceState(createInitialState())
  }

  public async prepareFile(file: File): Promise<void> {
    await this._readSource(async () => ({ source: await file.text(), sourceName: file.name }))
  }

  public async prepareUrl(url: string): Promise<void> {
    await this._readSource((format, signal) => loadDocumentImportSource(format, url, signal))
  }

  public clearSource(): void {
    if (!this._state.sourceName || (this._state.status !== 'ready' && this._state.status !== 'error')) {
      return
    }
    this._replaceState({
      ...createInitialState(),
      open: this._state.open,
      format: this._state.format,
      folderId: this._state.folderId,
    })
  }

  /**
   * Изменяет выбор одного доступного кандидата.
   */
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

  /**
   * Выбирает все готовые к созданию документы текущего plan.
   */
  public selectAllReady(): void {
    this._state.selectedCandidateIds = this._state.plan?.candidates
      .filter(candidate => candidate.status === 'ready')
      .map(candidate => candidate.id) ?? []
  }

  /**
   * Снимает пользовательский выбор без изменения подготовленного plan.
   */
  public clearSelection(): void {
    this._state.selectedCandidateIds = []
  }

  /**
   * Назначает существующую папку Types для выбранных документов.
   */
  public setDestinationFolder(folderId: string | number | null): void {
    this._state.folderId = folderId
  }

  /**
   * Применяет через Core только подтверждённые пользователем candidates.
   */
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

  /**
   * Сбрасывает dialog-state вместе с lifecycle EndgeIDE.
   */
  public reset(): void {
    this._replaceState(createInitialState())
  }

  // ---------------------------------------------
  // PRIVATE
  // ---------------------------------------------

  private async _readSource(
    read: (format: DocumentImportFormat, signal: AbortSignal) => Promise<EndgeIDEDocumentImportSource>,
  ): Promise<void> {
    const { format, status } = this._state
    if (!format || (status !== 'idle' && status !== 'error')) {
      return
    }
    const request = new AbortController()
    this._sourceRequest = request
    this._state.status = 'preparing'
    this._state.errorMessage = ''
    try {
      const input = await read(format, request.signal)
      if (!request.signal.aborted) {
        this._prepareSource(input)
      }
    }
    catch (error) {
      if (!request.signal.aborted) {
        this._state.status = 'error'
        this._state.errorMessage = errorText(error)
      }
    }
    finally {
      if (this._sourceRequest === request) {
        this._sourceRequest = null
      }
    }
  }

  /**
   * Передаёт прочитанную схему в Core и выбирает все готовые кандидаты.
   */
  private _prepareSource(input: EndgeIDEDocumentImportSource): void {
    if (!this._state.format) {
      throw new Error('Document import format is not selected.')
    }
    this._state.sourceName = input.sourceName
    try {
      const plan = Endge.documentImport.prepare({
        format: this._state.format,
        source: input.source,
        sourceName: input.sourceName,
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

  /**
   * Заменяет все поля reactive object без создания второго state owner.
   */
  private _replaceState(next: EndgeIDEDocumentImportState): void {
    this._sourceRequest?.abort()
    this._sourceRequest = null
    Object.assign(this._state, next)
  }

  // ---------------------------------------------
  // ACCESS
  // ---------------------------------------------

  /**
   * Возвращает readonly Vue-представление состояния workflow.
   */
  public get state(): Readonly<EndgeIDEDocumentImportState> {
    return readonly(this._state) as Readonly<EndgeIDEDocumentImportState>
  }
}

function createInitialState(): EndgeIDEDocumentImportState {
  return {
    open: false,
    format: null,
    status: 'idle',
    sourceName: '',
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
