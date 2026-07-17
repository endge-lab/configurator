import type { EndgeConfigurationContribution, RProject } from '@endge/core'

function normalizeRelationId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text)
    return null
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

/**
 * Модель редактора для RProject (коллекция projects).
 */
export class RProjectEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string | null = null
  slug: string | null = null
  order: number | null = null
  navigationId: number | null = null
  allowedEnvironmentIds: number[] = []
  configuration: EndgeConfigurationContribution = { mode: 'inherit', patch: {} }

  fillFromSource(source: RProject): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.description = source.description ?? null
    this.slug = source.slug ?? null
    this.order = source.order ?? null
    this.navigationId = normalizeRelationId(source.navigationId)
    this.allowedEnvironmentIds = Array.isArray(source.allowedEnvironmentIds)
      ? source.allowedEnvironmentIds.map(id => normalizeRelationId(id)).filter((id): id is number => id != null)
      : []
    this.configuration = clone(source.configuration)
  }

  updateSource(source: RProject): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description ?? null
    source.slug = this.slug ?? null
    source.order = this.order ?? null
    source.navigationId = this.navigationId ?? null
    source.allowedEnvironmentIds = Array.from(new Set(this.allowedEnvironmentIds))
    source.configuration = clone(this.configuration)
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
