import type { RPolicy } from '@endge/core'

/**
 * Модель редактора для RPolicy (коллекция policies).
 */
export class RPolicyEditor {
  id!: number
  identity!: string
  displayName!: string
  description!: string

  fillFromSource(source: RPolicy): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
  }

  updateSource(source: RPolicy): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
  }
}
