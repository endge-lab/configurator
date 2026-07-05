import type { RParameter } from '@endge/core'

/** Поле параметра (как в query.types). */
interface ParameterFieldSchema {
  key: string
  label?: string
  [key: string]: any
}

/** Ссылка на runtime-фильтр. */
interface RuntimeFilterLinkItem {
  identity: string
  displayName: string
  description?: string
}

/**
 * Модель редактора для RParameter (коллекция parameters).
 */
export class RParameterEditor {
  id!: number
  identity!: string
  displayName!: string
  description?: string
  fields: Map<string, ParameterFieldSchema> = new Map()
  runtimeFilters: RuntimeFilterLinkItem[] = []

  fillFromSource(source: RParameter): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.description = source.description
    this.fields = new Map()
    for (const [k, v] of source.fields)
      this.fields.set(k, { ...v })
    this.runtimeFilters = (source.runtimeFilters ?? []).map(x => ({ ...x }))
  }

  updateSource(source: RParameter): void {
    source.id = this.id
    source.identity = this.identity
    source.displayName = this.displayName
    source.name = this.displayName
    source.description = this.description
    source.fields = new Map()
    for (const [k, v] of this.fields)
      source.fields.set(k, { ...v })
    source.runtimeFilters = this.runtimeFilters.map(x => ({ ...x }))
  }
}
