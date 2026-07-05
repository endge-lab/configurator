import type { RConverter } from '@endge/core'

/**
 * Модель редактора для RConverter (коллекция converters).
 */
export class RConverterEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''

  fillFromSource(source: RConverter): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
  }

  updateSource(source: RConverter): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
  }
}
