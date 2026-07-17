import type { EndgeConfigurationContribution, REnvironment } from '@endge/core'

/**
 * Модель редактора для REnvironment (коллекция environments).
 */
export class REnvironmentEditor {
  id!: number
  identity!: string
  displayName!: string
  configuration: EndgeConfigurationContribution = { mode: 'inherit', patch: {} }

  fillFromSource(source: REnvironment): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.configuration = clone(source.configuration)
  }

  updateSource(source: REnvironment): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.configuration = clone(this.configuration)
  }

  updateConfigurationSource(source: REnvironment): void {
    source.configuration = clone(this.configuration)
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
