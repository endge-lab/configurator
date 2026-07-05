import type { REnvironment } from '@endge/core'

/**
 * Модель редактора для REnvironment (коллекция environments).
 */
export class REnvironmentEditor {
  id!: number
  identity!: string
  displayName!: string

  fillFromSource(source: REnvironment): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
  }

  updateSource(source: REnvironment): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
  }
}
