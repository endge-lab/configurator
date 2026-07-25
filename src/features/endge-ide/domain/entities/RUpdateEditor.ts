import type { RUpdate } from '@endge/core'
import { Endge } from '@endge/core'

/** Source-first editor model Store-owned Update. */
export class RUpdateEditor {
  readonly sourceKind = 'update' as const
  id!: string | number
  identity!: string
  name!: string
  description = ''
  storeIdentity = ''
  source = ''
  sourceVersion = 1
  diagnostics: unknown[] = []

  fillFromSource(source: RUpdate): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String((source as any).description ?? '')
    this.storeIdentity = source.storeIdentity
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
  }

  updateSource(target: RUpdate): void {
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    ;(target as any).description = this.description
    target.storeIdentity = this.storeIdentity
    target.source = this.source
    target.sourceVersion = this.sourceVersion
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  refreshDiagnostics(): void {
    this.diagnostics = Endge.source.validate('update', this.source).diagnostics ?? []
  }
}
