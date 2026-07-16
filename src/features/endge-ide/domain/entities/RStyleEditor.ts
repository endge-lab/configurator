import type { RStyle } from '@endge/core'

/** Editor state for a persisted source-first EndgeCSS document. */
export class RStyleEditor {
  id!: string | number
  identity!: string
  name!: string
  description: string = ''
  source: string = ''
  sourceVersion: number = 1
  isSystem: boolean = false
  diagnostics: string[] = []

  fillFromSource(source: RStyle): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String(source.description ?? '')
    this.source = String(source.source ?? '')
    this.sourceVersion = Math.max(1, Number(source.sourceVersion ?? 1) || 1)
    this.isSystem = source.isSystem === true
    this.refreshDiagnostics()
  }

  updateSource(target: RStyle): void {
    target.id = this.id as any
    if (!target.isSystem) {
      target.identity = this.identity.trim()
      target.name = this.name.trim() || target.identity
      target.displayName = target.name
    }
    target.description = this.description.trim() || null
    target.source = this.source
    target.sourceVersion = Math.max(1, Number(this.sourceVersion) || 1)
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  /** Structural metadata checks. EndgeCSS drafts may be saved with syntax diagnostics. */
  refreshDiagnostics(): void {
    const diagnostics: string[] = []
    if (!this.identity.trim()) {
      diagnostics.push('Identity не может быть пустым.')
    }
    if (!Number.isInteger(Number(this.sourceVersion)) || Number(this.sourceVersion) < 1) {
      diagnostics.push('sourceVersion должен быть целым числом больше нуля.')
    }
    this.diagnostics = diagnostics
  }
}
