import type { FilterFieldItemSchema, RFilter } from '@endge/core'

/**
 * Модель редактора для RFilter (коллекция filters).
 */
export class RFilterEditor {
  id!: number
  identity!: string
  displayName!: string
  fields: FilterFieldItemSchema[] = []
  /** Индекс выбранного поля в списке (для синхронизации с инспектором) */
  selectedFieldIndex: number | null = null

  fillFromSource(source: RFilter): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.fields = (source.fields ?? []).map(x => ({ ...x, active: x.active !== false }))
  }

  updateSource(source: RFilter): void {
    source.id = this.id
    source.identity = this.identity
    source.displayName = this.displayName
    source.name = this.displayName
    source.fields = this.fields.map(x => ({ ...x, active: x.active !== false }))
  }
}
