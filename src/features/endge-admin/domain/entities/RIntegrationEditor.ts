import type { RIntegration } from '@endge/core'

/**
 * Модель редактора для RIntegration (коллекция integrations).
 */
export class RIntegrationEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''

  fillFromSource(source: RIntegration): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
  }

  updateSource(source: RIntegration): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
  }
}
