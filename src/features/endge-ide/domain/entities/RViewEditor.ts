import type { RView } from '@endge/core'

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
 * Модель редактора для RView (коллекция views).
 */
export class RViewEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  componentId: number | null = null
  filterId: number | null = null
  queryId: number | null = null

  fillFromSource(source: RView): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
    this.componentId = normalizeRelationId(source.componentId)
    this.filterId = normalizeRelationId(source.filterId)
    this.queryId = normalizeRelationId(source.queryId)
  }

  updateSource(source: RView): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
    source.componentId = this.componentId
    source.filterId = this.filterId
    source.queryId = this.queryId
  }
}
