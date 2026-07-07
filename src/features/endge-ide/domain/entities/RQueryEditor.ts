import { Endge, RField } from '@endge/core'
import type { QueryType } from '@endge/core'
import type { RQuery } from '@endge/core'
import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor'
import type { RQueryAuth } from '@endge/core'
import type { RQueryFilterApplyMode } from '@endge/core'
import { RQueryFilter } from '@endge/core'
import { QueryType as QueryTypeValue } from '@endge/core'
import { Expose, Type } from 'class-transformer'

/**
 * Модель редактирования для сущности `RQuery`.
 * Используется как DTO между формой и доменной моделью.
 */
export class RQueryEditor {
  id!: number
  identity!: string
  name!: string
  endpoint!: string
  type!: QueryType
  query!: string
  source: string = ''
  sourceVersion: number = 1
  subField!: string

  auth: RQueryAuth = { mode: 'token' }

  /** REST: HTTP-метод */
  method: string = 'POST'
  /** REST: заголовки */
  headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  /** REST: таймаут (мс) */
  timeoutMs?: number
  /** REST: тело как form-urlencoded */
  sendAsFormUrlencoded: boolean = false

  @Expose()
  filterMode: RQueryFilterApplyMode = 'merge'

  @Expose()
  @Type(() => RQueryFilter)
  filters: RQueryFilter[] = []

  returnField!: string
  params: Map<string, RFieldEditor> = new Map()

  mockData: string = ''
  mockDataEnabled: boolean = false

  /**
   * Добавляет параметр в карту параметров.
   */
  addParam(name: string, param: RFieldEditor): void {
    this.params.set(name, param)
  }

  /**
   * Возвращает параметры запроса.
   */
  getParams(): Map<string, RFieldEditor> {
    return this.params
  }

  /**
   * Заполняет поля редактора на основе доменной сущности `RQuery`.
   */
  fillFromSource(source: RQuery): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.endpoint = source.endpoint
    this.type = source.type
    this.subField = source.subField
    this.query = source.query
    this.source = this.resolveSource(source)
    this.sourceVersion = Number((source as { sourceVersion?: number }).sourceVersion ?? 1) || 1
    this.auth = source.auth ?? { mode: 'token' }
    const raw = (source as { mockData?: unknown }).mockData
    this.mockData = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' ? JSON.stringify(raw, null, 2) : '')
    this.mockDataEnabled = source.mockDataEnabled
    this.returnField = source.returnField?.type ?? ''
    this.filterMode = source.filterMode ?? 'merge'
    this.filters = source.filters?.length ? [...source.filters] : []
    const rest = source as { method?: string; headers?: Record<string, string>; timeoutMs?: number; sendAsFormUrlencoded?: boolean }
    this.method = rest.method ?? 'POST'
    this.headers = rest.headers && typeof rest.headers === 'object' ? { ...rest.headers } : { Accept: 'application/json', 'Content-Type': 'application/json' }
    this.timeoutMs = rest.timeoutMs
    this.sendAsFormUrlencoded = rest.sendAsFormUrlencoded ?? false

    this.params = new Map()
    for (const [key, field] of source.params.entries()) {
      const editor = new RFieldEditor()
      editor.fillFromSource(field)
      this.params.set(key, editor)
    }
  }

  /**
   * Обновляет данные в доменной сущности `RQuery` из редактора.
   */
  updateSource(target: RQuery): void {
    target.id = this.id
    target.identity = this.identity
    target.name = this.name
    target.endpoint = this.endpoint
    target.type = this.type
    target.query = this.query
    target.source = this.source
    target.sourceVersion = this.sourceVersion
    target.auth = this.auth
    target.mockData = this.mockData
    target.subField = this.subField
    target.mockDataEnabled = this.mockDataEnabled
    target.returnField = new RField('returnField', this.returnField)
    target.filterMode = this.filterMode
    target.filters = this.filters?.length ? [...this.filters] : []
    const rest = target as { method?: string; headers?: Record<string, string>; timeoutMs?: number; sendAsFormUrlencoded?: boolean }
    rest.method = this.method
    rest.headers = this.headers && typeof this.headers === 'object' ? { ...this.headers } : undefined
    rest.timeoutMs = this.timeoutMs
    rest.sendAsFormUrlencoded = this.sendAsFormUrlencoded

    target.params = new Map()
    for (const [key, paramEditor] of this.params.entries()) {
      const param = new RField(paramEditor.name, paramEditor.type)
      paramEditor.updateSource(param)
      target.params.set(key, param)
    }
  }

  /**
   * Возвращает сохраненный source или генерирует REST source из legacy-полей.
   */
  private resolveSource(source: RQuery): string {
    const persisted = String((source as { source?: string }).source ?? '').trim()
    if (persisted)
      return persisted

    if (source.type !== QueryTypeValue.REST)
      return ''

    const generated = Endge.source.generate('query', source)
    return generated.ok && typeof generated.source === 'string'
      ? generated.source
      : ''
  }
}
