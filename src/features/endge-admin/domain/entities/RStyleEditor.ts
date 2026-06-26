import type { RStyle } from '@endge/core'

/**
 * Модель редактора для RStyle (коллекция styles).
 */
export class RStyleEditor {
  id!: number
  identity!: string
  displayName!: string
  styles!: Record<string, unknown>

  fillFromSource(source: RStyle): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.styles = (source.styles && typeof source.styles === 'object') ? { ...source.styles } : {}
  }

  updateSource(source: RStyle): void {
    source.id = this.id
    if (!source.isSystem) {
      source.identity = this.identity
      source.name = this.displayName
    }
    source.styles = (this.styles && typeof this.styles === 'object') ? { ...this.styles } : {}
  }
}
