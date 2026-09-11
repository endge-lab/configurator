import type { EndgeConfigurationContribution, RFacetDocument } from '@endge/core'

export class RFacetDocumentEditor {
  id!: string | number
  facetIdentity = ''
  identity = ''
  displayName = ''
  description = ''
  configuration: EndgeConfigurationContribution = { mode: 'inherit', patch: {} }
  meta: Record<string, unknown> = {}

  public fillFromSource(source: RFacetDocument): void {
    this.id = source.id
    this.facetIdentity = source.facetIdentity
    this.identity = source.identity
    this.displayName = source.displayName
    this.description = source.description ?? ''
    this.configuration = clone(source.configuration)
    this.meta = clone(source.meta)
  }

  public updateSource(source: RFacetDocument): void {
    source.identity = this.identity.trim()
    source.displayName = this.displayName.trim()
    source.name = source.displayName
    source.description = this.description.trim() || null
    source.configuration = clone(this.configuration)
    source.meta = clone(this.meta)
  }

  public toMutation(): Record<string, unknown> {
    return {
      identity: this.identity.trim(),
      displayName: this.displayName.trim(),
      description: this.description.trim() || null,
      configuration: clone(this.configuration),
      meta: clone(this.meta),
      active: true,
    }
  }
}

export class FacetDocumentMetadataSession {
  public draft: string
  public error: string | null = null
  public readonly readOnly = false
  public readonly projection = { editable: true, message: null }
  private _savedDraft: string

  public constructor(private readonly _editor: RFacetDocumentEditor) {
    this.draft = JSON.stringify(_editor.meta, null, 2)
    this._savedDraft = this.draft
  }

  public get dirty(): boolean {
    return this.draft !== this._savedDraft
  }

  public refreshFromDocument(): void {}
  public updateDraft(value: string): void {
    this.draft = value
    this.error = validate(value)
  }

  public prepareBeforeSave(): boolean {
    this.error = validate(this.draft)
    if (this.error) {
      return false
    }
    this._editor.meta = JSON.parse(this.draft) as Record<string, unknown>
    return true
  }

  public acceptSaved(): void {
    this._savedDraft = this.draft
  }
}

function validate(value: string): string | null {
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
