import type { DomainDocumentType, DomainSectionType } from '@endge/core'
import type { CompositionCreateOwner } from '@/features/endge-ide/model/domain/composition-create'

import { ref } from 'vue'

export interface CreateDocumentContext {
  sectionType?: DomainSectionType
  folderId?: string | number | null
  documentType?: DomainDocumentType
  compositionOwner?: CompositionCreateOwner
  updateOwnerStoreIdentity?: string
}

/**
 * Контроллер модальных окон Endge IDE.
 * Открытие/закрытие - здесь, разметка модалок - в Editor_View.
 */
export class EndgeIDEModals_Module {
  private readonly _createDocumentOpen = ref(false)
  private readonly _createDocumentContext = ref<CreateDocumentContext | null>(null)
  private readonly _duplicateDocumentOpen = ref(false)
  private readonly _duplicateSourceNode = ref<{ id: string, docType: string, name: string } | null>(null)
  private readonly _vocabJsonPreviewOpen = ref(false)
  private readonly _vocabJsonPreviewTitle = ref('Словарь')
  private readonly _vocabJsonPreviewData = ref<unknown>(null)

  public init(): void {}
  public reset(): void {
    this._createDocumentOpen.value = false
    this._createDocumentContext.value = null
    this._duplicateDocumentOpen.value = false
    this._duplicateSourceNode.value = null
    this._vocabJsonPreviewOpen.value = false
    this._vocabJsonPreviewTitle.value = 'Словарь'
    this._vocabJsonPreviewData.value = null
  }

  /** Открыта ли модалка «Создать документ» */
  public get isCreateDocumentOpen() {
    return this._createDocumentOpen
  }

  /** Контекст открытия: секция, папка или typed owner для связанного документа. */
  public get createDocumentContext() {
    return this._createDocumentContext
  }

  public openCreateDocument(options?: CreateDocumentContext): void {
    this._createDocumentContext.value = options ?? null
    this._createDocumentOpen.value = true
  }

  public closeCreateDocument(): void {
    this._createDocumentOpen.value = false
    this._createDocumentContext.value = null
  }

  public get isDuplicateDocumentOpen() {
    return this._duplicateDocumentOpen
  }

  public get duplicateSourceNode() {
    return this._duplicateSourceNode
  }

  public openDuplicateDocument(payload: { id: string, docType: string, name: string }): void {
    this._duplicateSourceNode.value = payload
    this._duplicateDocumentOpen.value = true
  }

  public closeDuplicateDocument(): void {
    this._duplicateDocumentOpen.value = false
    this._duplicateSourceNode.value = null
  }

  public get isVocabJsonPreviewOpen() {
    return this._vocabJsonPreviewOpen
  }

  public get vocabJsonPreviewTitle() {
    return this._vocabJsonPreviewTitle
  }

  public get vocabJsonPreviewData() {
    return this._vocabJsonPreviewData
  }

  public openVocabJsonPreview(payload: { title?: string, data: unknown }): void {
    this._vocabJsonPreviewTitle.value = String(payload?.title ?? '').trim() || 'Словарь'
    this._vocabJsonPreviewData.value = payload?.data ?? null
    this._vocabJsonPreviewOpen.value = true
  }

  public closeVocabJsonPreview(): void {
    this._vocabJsonPreviewOpen.value = false
  }
}
