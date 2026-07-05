import type { DomainSectionType } from '@endge/core'
import { ref } from 'vue'

/**
 * Контроллер модальных окон Endge IDE.
 * Открытие/закрытие - здесь, разметка модалок - в Editor_View.
 */
const _createVersionOpen = ref(false)
const _createDocumentOpen = ref(false)
const _createDocumentContext = ref<{ sectionType: DomainSectionType, folderId?: string | number | null } | null>(null)
const _clearSoftDeletedOpen = ref(false)
const _duplicateDocumentOpen = ref(false)
const _duplicateSourceNode = ref<{ id: string, docType: string, name: string } | null>(null)
const _vocabJsonPreviewOpen = ref(false)
const _vocabJsonPreviewTitle = ref('Словарь')
const _vocabJsonPreviewData = ref<unknown>(null)

export class EndgeIDEModals {
  public init(): void {}
  public reset(): void {}

  /** Открыта ли модалка «Создать версию» */
  get isCreateVersionOpen() {
    return _createVersionOpen
  }

  openCreateVersion(): void {
    _createVersionOpen.value = true
  }

  closeCreateVersion(): void {
    _createVersionOpen.value = false
  }

  /** Открыта ли модалка «Создать документ» */
  get isCreateDocumentOpen() {
    return _createDocumentOpen
  }

  /** Контекст открытия (секция/папка из виджета домена). */
  get createDocumentContext() {
    return _createDocumentContext
  }

  openCreateDocument(options?: { sectionType?: DomainSectionType, folderId?: string | number | null }): void {
    _createDocumentContext.value = options ?? null
    _createDocumentOpen.value = true
  }

  closeCreateDocument(): void {
    _createDocumentOpen.value = false
    _createDocumentContext.value = null
  }

  get isDuplicateDocumentOpen() {
    return _duplicateDocumentOpen
  }

  get duplicateSourceNode() {
    return _duplicateSourceNode
  }

  openDuplicateDocument(payload: { id: string, docType: string, name: string }): void {
    _duplicateSourceNode.value = payload
    _duplicateDocumentOpen.value = true
  }

  closeDuplicateDocument(): void {
    _duplicateDocumentOpen.value = false
    _duplicateSourceNode.value = null
  }

  /** Открыта ли модалка «Очистить все» (папка «Удалённые») */
  get isClearSoftDeletedOpen() {
    return _clearSoftDeletedOpen
  }

  openClearSoftDeleted(): void {
    _clearSoftDeletedOpen.value = true
  }

  closeClearSoftDeleted(): void {
    _clearSoftDeletedOpen.value = false
  }

  get isVocabJsonPreviewOpen() {
    return _vocabJsonPreviewOpen
  }

  get vocabJsonPreviewTitle() {
    return _vocabJsonPreviewTitle
  }

  get vocabJsonPreviewData() {
    return _vocabJsonPreviewData
  }

  openVocabJsonPreview(payload: { title?: string; data: unknown }): void {
    _vocabJsonPreviewTitle.value = String(payload?.title ?? '').trim() || 'Словарь'
    _vocabJsonPreviewData.value = payload?.data ?? null
    _vocabJsonPreviewOpen.value = true
  }

  closeVocabJsonPreview(): void {
    _vocabJsonPreviewOpen.value = false
  }
}
