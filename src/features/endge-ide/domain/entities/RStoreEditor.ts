import type { RStore } from '@endge/core'

import { Endge } from '@endge/core'

/** Source-first editor model Store. */
export class RStoreEditor {
  id!: string | number
  identity!: string
  name!: string
  description: string = ''
  source: string = ''
  sourceVersion: number = 1
  diagnostics: unknown[] = []

  fillFromSource(source: RStore): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String(source.description ?? '')
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
  }

  updateSource(target: RStore): void {
    target.id = this.id as any
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    target.description = this.description
    target.source = this.source
    target.sourceVersion = this.sourceVersion
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  refreshDiagnostics(): void {
    this.diagnostics = Endge.source.validate('store', this.source).diagnostics ?? []
  }
}
