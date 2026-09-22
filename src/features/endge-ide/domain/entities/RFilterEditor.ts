import type { FilterFieldItemSchema, RFilter } from '@endge/core'

import { Endge } from '@endge/core'

/**
 * Модель редактора для RFilter (коллекция filters).
 */
export class RFilterEditor {
  id!: number
  identity!: string
  displayName!: string
  fields: FilterFieldItemSchema[] = []
  source: string = ''
  sourceVersion: number = 1
  diagnostics: unknown[] = []
  /** Индекс выбранного поля в списке (для синхронизации с инспектором) */
  selectedFieldIndex: number | null = null

  fillFromSource(source: RFilter): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.fields = (source.fields ?? []).map(x => ({ ...x, active: x.active !== false }))
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
  }

  updateSource(source: RFilter): void {
    source.id = this.id
    source.identity = this.identity
    source.displayName = this.displayName
    source.name = this.displayName
    source.fields = this.fields.map(x => ({ ...x, active: x.active !== false }))
    source.source = this.source
    source.sourceVersion = this.sourceVersion
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  resetSource(): void {
    this.applySourceText(Endge.source.createDefault('filter'))
  }

  refreshDiagnostics(): void {
    this.diagnostics = Endge.source.validate('filter', this.source).diagnostics ?? []
  }
}
