import type { EndgeConfigurationContribution, RTenant } from '@endge/core'

/**
 * Модель редактора для RTenant (коллекция tenants).
 */
export class RTenantEditor {
  id!: number
  identity!: string
  displayName!: string
  code!: string
  description!: string
  configuration: EndgeConfigurationContribution = { mode: 'inherit', patch: {} }

  fillFromSource(source: RTenant): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.code = String(source.code ?? '').trim()
    this.description = source.description ?? ''
    this.configuration = clone(source.configuration)
  }

  updateSource(source: RTenant): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.code = this.code
    source.description = this.description || null
    source.configuration = clone(this.configuration)
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
