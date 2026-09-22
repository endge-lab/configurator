import type {
  DocumentMetadataProjection,
  DomainDocumentType,
  ProgramMetadataMap,
} from '@endge/core'

import { inspectDocumentMetadata, patchDocumentMetadata } from '@endge/core'

interface MetadataDocument {
  source?: string
  meta?: Record<string, unknown>
  applySourceText?: (source: string) => void
  parseSource?: () => void
  managedBy?: 'system' | 'integration' | 'user'
}

/** Владеет JSON draft и подготовкой metadata до общего syncBeforeSave editor-сессии. */
export class DocumentMetadataSession {
  public draft = '{}'
  public error: string | null = null
  public projection: DocumentMetadataProjection
  private _savedDraft = '{}'
  private _appliedDraft = '{}'
  private _documentKey = ''

  public constructor(
    public readonly documentType: DomainDocumentType,
    private readonly _editor: MetadataDocument,
    private readonly _model: MetadataDocument,
    public readonly readOnly = false,
  ) {
    this.projection = this._inspect()
    this._adoptProjection()
  }

  public get dirty(): boolean {
    return this.draft !== this._savedDraft
  }

  public updateDraft(value: string): void {
    this.draft = value
    this.error = validateMetadataJSON(value)
  }

  /** Подхватывает Source-изменения, пока пользователь не начал собственный metadata draft. */
  public refreshFromDocument(): void {
    const key = this._inputKey()
    if (key === this._documentKey || (this.dirty && (this.error != null || this.draft !== this._appliedDraft))) {
      return
    }
    const savedDraft = this._savedDraft
    const wasDirty = this.dirty
    this.projection = this._inspect()
    this._adoptProjection()
    if (wasDirty) {
      this._savedDraft = savedDraft
    }
  }

  /** Валидирует и применяет draft к каноническому backing перед обычным editor sync. */
  public prepareBeforeSave(): boolean {
    this.refreshFromDocument()
    if (!this.dirty) {
      return true
    }
    if (this.readOnly) {
      return !this.dirty
    }
    this.error = validateMetadataJSON(this.draft)
    if (this.error) {
      return false
    }
    if (!this.projection.editable) {
      this.error = this.projection.message ?? 'Metadata нельзя безопасно изменить визуально.'
      return false
    }
    const metadata = JSON.parse(this.draft) as ProgramMetadataMap
    const result = patchDocumentMetadata(this.documentType, this._input(), metadata)
    if (!result.ok) {
      this.error = result.message ?? 'Не удалось подготовить metadata к сохранению.'
      return false
    }
    if (result.source !== this._source()) {
      if (typeof this._editor.applySourceText === 'function') {
        this._editor.applySourceText(result.source)
      }
      else {
        this._editor.source = result.source
        this._editor.parseSource?.()
      }
    }
    if (result.projection.backing === 'entity-meta') {
      this._model.meta = result.meta
      if ('meta' in this._editor) {
        this._editor.meta = result.meta
      }
    }
    this.projection = result.projection
    this.draft = result.projection.json
    this._appliedDraft = this.draft
    this.error = null
    this._documentKey = this._inputKey()
    return true
  }

  public acceptSaved(): void {
    this._savedDraft = this.draft
    this._documentKey = this._inputKey()
  }

  private _inspect(): DocumentMetadataProjection {
    return inspectDocumentMetadata(this.documentType, this._input())
  }

  private _input(): { source: string, meta: Record<string, unknown> } {
    return { source: this._source(), meta: this._meta() }
  }

  private _source(): string {
    return String(this._editor.source ?? this._model.source ?? '')
  }

  private _meta(): Record<string, unknown> {
    return this._model.meta ?? this._editor.meta ?? {}
  }

  private _inputKey(): string {
    return JSON.stringify([this._source(), this._meta()])
  }

  private _adoptProjection(): void {
    this.draft = this.projection.json
    this._savedDraft = this.draft
    this._appliedDraft = this.draft
    // Projection diagnostics are rendered separately from draft validation.
    // Keeping them in `error` would duplicate the message and make Table's
    // unrelated pending-edit preparation reject an untouched document.
    this.error = null
    this._documentKey = this._inputKey()
  }
}

export function validateMetadataJSON(value: string): string | null {
  try {
    const parsed = JSON.parse(value)
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? null
      : 'Metadata должна быть JSON-объектом верхнего уровня.'
  }
  catch (error) {
    return error instanceof Error ? error.message : 'Некорректный JSON.'
  }
}
