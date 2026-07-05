import type { AccessorDescriptor, ColumnComponentType, ColumnSortConfig } from '@endge/core'
import { randomString } from '@endge/utils'
import type { RComponentTableColumn } from '@endge/core'
import {
  RComponentTableColumn_isHtml,
  RComponentTableColumn_isComponent,
  RComponentTableColumn_TypeCtor,
} from '@endge/core'
import type { EndgeEventBinding } from '@endge/core'

function normalizeRelationId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value === 'object') {
    const raw = value as Record<string, unknown>
    const nested = raw.id ?? raw.value ?? raw.componentId ?? null
    return nested == null ? null : normalizeRelationId(nested)
  }
  const text = String(value).trim()
  if (!text)
    return null
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

export class RComponentTableColumnEditor {
  id: string = randomString(5)
  isActive: boolean = true
  title!: string
  type!: ColumnComponentType
  template: string | null = null
  componentId: number | null = null

  // Ширина колонки
  width: number = 150

  // Закрепление колонки
  pin: 'left' | 'right' | 'none' = 'none'

  // Новый массив accessors
  accessors: AccessorDescriptor[] = []

  /** Индекс строки привязки данных (dataPaths), на которой фокус - для инспектора */
  selectedAccessorIndex: number = 0

  /** Настройки сортировки колонки (ColumnSortConfig) */
  sort: ColumnSortConfig | null = null

  //
  eventBindings: EndgeEventBinding[] = []

  // Сериализация в доменную сущность
  toSource(): RComponentTableColumn | null {
    const ColumnCtor = RComponentTableColumn_TypeCtor(this.type)
    if (!ColumnCtor) return null

    const source = new ColumnCtor()
    source.id = this.id
    source.isActive = this.isActive
    source.title = this.title
    source.type = this.type
    source.width = this.width
    source.pin = this.pin
    source.eventBindings = this.eventBindings

    // Преобразование массива accessors в объект dataPaths
    source.dataPaths = {}
    source.dataConverters = {}
    for (const x of this.accessors) {
      source.dataPaths[x.name] = x.accessor
      source.dataConverters[x.name] = x.converter || ''
    }

    source.sort = this.sort ? { by: this.sort.by, type: this.sort.type } : null
    if (RComponentTableColumn_isHtml(source)) {
      source.template = this.template
    } else if (RComponentTableColumn_isComponent(source)) {
      source.componentId = this.componentId
    }
    return source
  }

  // Десериализация из доменной сущности
  fromSource(source: RComponentTableColumn): void {
    this.id = source.id
    this.isActive = source.isActive
    this.title = source.title
    this.type = source.type
    this.width = source.width
    this.pin = source.pin
    this.eventBindings = source.eventBindings

    // Преобразование объекта dataPaths в массив accessors
    this.accessors = Object.entries(source.dataPaths || {}).map(
      ([name, path]) => ({
        name,
        accessor: path || '',
        converter: '',
      }),
    )
    Object.entries(source.dataConverters || {}).forEach(([name, converter]) => {
      const accessor = this.accessors.find((x) => x.name === name)
      if (accessor) {
        accessor.converter = converter
      }
    })

    this.sort = source.sort ? { by: source.sort.by, type: source.sort.type } : null
    if (RComponentTableColumn_isHtml(source)) {
      this.template = source.template
    } else if (RComponentTableColumn_isComponent(source)) {
      this.componentId = normalizeRelationId(source.componentId)
    }
  }
}
