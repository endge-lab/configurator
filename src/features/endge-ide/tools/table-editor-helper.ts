/**
 * Хелпер для автозаполнения dataPaths в редакторе таблицы по данным запроса.
 * Нечёткий поиск названия поля колонки среди путей в примере данных.
 */

/** Собирает пути до примитивов в объекте в формате "a.b.c" */
export function collectPathStrings(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined) return []
  const out: string[] = []
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${key}` : key
      const val = (obj as Record<string, unknown>)[key]
      const isLeaf = val === null || typeof val !== 'object' || Array.isArray(val)
      if (isLeaf && full) out.push(full)
      else out.push(...collectPathStrings(val, full))
    }
  }
  return out
}

/**
 * Разбивает строку на слова: camelCase и underscore_case.
 * Формат определяется по наличию подчёркиваний или заглавных букв.
 */
export function splitToWords(str: string): string[] {
  const s = String(str).trim()
  if (!s) return []
  // Сначала по подчёркиваниям, потом по границам camelCase
  return s
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

/** Оценка совпадения двух слов: точное = 100, одно содержит другое = 50, иначе 0. */
function wordScore(a: string, b: string): number {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  if (x === y) return 100
  if (x.includes(y) || y.includes(x)) return 50
  return 0
}

/**
 * Сумма очков по словам поля таблицы: для каждого слова выбирается
 * максимальное совпадение с любым словом поля данных; суммируем.
 */
function scoreByWords(tableWords: string[], dataWords: string[]): number {
  if (!tableWords.length) return 0
  let sum = 0
  for (const tw of tableWords) {
    let best = 0
    for (const dw of dataWords) {
      const s = wordScore(tw, dw)
      if (s > best) best = s
    }
    sum += best
  }
  return sum
}

/**
 * Выбирает наиболее подходящий путь только по названию (слова, очки).
 * Типы на этапе сравнения не проверяются - сравнение по всем путям по словам.
 * Подстановка конвертера выполняется отдельно после выбора пути.
 */
export function fuzzyMatchPath(
  targetName: string,
  paths: string[],
  _sample?: Record<string, unknown> | null,
  _targetType?: string,
): string | null {
  if (!paths.length) return null
  const first = paths[0]
  if (first === undefined) return null
  const name = targetName?.trim()
  if (!name) return first

  const tableWords = splitToWords(name)
  if (!tableWords.length) return first

  let bestPath: string = first
  const pathPart0 = first.split('.').pop() ?? first
  let bestScore = scoreByWords(tableWords, splitToWords(pathPart0))

  for (let i = 1; i < paths.length; i++) {
    const path = paths[i]
    if (path === undefined) continue
    const pathPart = path.split('.').pop() ?? path
    const dataWords = splitToWords(pathPart)
    const score = scoreByWords(tableWords, dataWords)
    if (score > bestScore) {
      bestScore = score
      bestPath = path
    }
  }

  return bestScore > 0 ? bestPath : null
}

export interface AccessorBuildOpts {
  subField?: string
  tabKey?: string
  hasTabs: boolean
}

/** Строит строку accessor по пути поля (как в инспекторе). */
export function buildAccessor(path: string, opts: AccessorBuildOpts): string {
  const { subField, tabKey, hasTabs } = opts
  const sub = subField?.trim()
  if (hasTabs && tabKey) {
    return sub
      ? `$store.${sub}.${tabKey}[$i].${path}`
      : `$store.${tabKey}[$i].${path}`
  }
  return sub ? `$store.${sub}[$i].${path}` : `$store[$i].${path}`
}

export interface AccessorRow {
  name?: string
  accessor?: string
  converter?: string
}

export interface ColumnForFill {
  accessors: AccessorRow[]
  title?: string
  /** Типы полей связного компонента по имени (если есть) */
  fieldTypes?: Record<string, string>
}

export interface AutoFillOpts extends AccessorBuildOpts {
  /** Образец одного элемента (объект) для получения путей */
  sample: Record<string, unknown> | null
}

export type PrimitiveKind = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'object' | 'unknown'

/** Значение по точечному пути a.b.c из объекта (sample) */
export function getValueByPath(obj: any, path: string): unknown {
  if (!obj || !path) return undefined
  return String(path).split('.').reduce<any>((acc, key) => {
    if (acc == null) return undefined
    return acc[key]
  }, obj)
}

/** Префикс runtime-ключей превью ячеек таблицы (виджет Демонстрация). */
export const TABLE_PREVIEW_STORE_PREFIX = 'endge:admin:table-preview:'

/** Путь в строке после [$i]. из accessor (например $store.legs[$i].id → "id") */
export function pathFromAccessor(accessor: string): string | null {
  const s = String(accessor ?? '').trim()
  if (!s) return null
  const match = s.match(/\[\$i\]\.?(.*)$/s)
  const path = match ? (match[1] ?? '').trim() : ''
  return path || null
}

/**
 * Извлечь данные для одной колонки из sample по accessors и применить конвертеры.
 * Используется в превью таблицы (инспектор и виджет Демонстрация).
 */
export function extractColumnDataForPreview(
  col: { accessors?: Array<{ name?: string; accessor?: string; converter?: string }> },
  sample: Record<string, unknown> | null,
  getConverter: (id: string) => { convert: (v: unknown) => unknown } | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!sample || typeof sample !== 'object' || !Array.isArray(col?.accessors))
    return out
  for (const acc of col.accessors) {
    const name = (acc.name ?? '').trim() || 'value'
    const path = pathFromAccessor(acc.accessor ?? '')
    let value = path ? getValueByPath(sample, path) : undefined
    if (value !== undefined && acc.converter && getConverter) {
      const ids = String(acc.converter)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (ids.length) {
        for (const id of ids) {
          const converter = getConverter(id)
          if (!converter)
            continue
          value = converter.convert(value)
        }
      }
    }
    out[name] = value
  }
  return out
}

/** Регулярки и проверки для определения типа значения из запроса. */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const TIME_ONLY = /^\d{1,2}:\d{2}(:\d{2})?$/
const NUMERIC_STRING = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/
const TIMESTAMP_MS_MIN = 1e10
const TIMESTAMP_MS_MAX = 2e12
const JSON_OBJECT_START = /^\s*\{/
const JSON_ARRAY_START = /^\s*\[/

/**
 * Определяет тип примитива значения из запроса по runtime-значению и формату строки.
 */
export function detectSamplePrimitiveKind(value: unknown): PrimitiveKind {
  if (value == null) return 'unknown'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 'unknown' : 'datetime'
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= TIMESTAMP_MS_MIN && value <= TIMESTAMP_MS_MAX)
      return 'datetime'
    return 'number'
  }
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return 'string'
    if (ISO_DATETIME.test(v)) return 'datetime'
    if (DATE_ONLY.test(v)) return 'date'
    if (TIME_ONLY.test(v)) return 'time'
    if (NUMERIC_STRING.test(v)) return 'number'
    if (JSON_OBJECT_START.test(v) || JSON_ARRAY_START.test(v)) return 'object'
    return 'string'
  }
  if (Array.isArray(value)) return 'unknown'
  if (typeof value === 'object') return 'object'
  return 'unknown'
}

/** Нормализует имя типа домена к примитивному виду или any. */
export function normalizeFieldType(typeName: string | undefined | null): PrimitiveKind | 'any' {
  if (!typeName) return 'unknown'
  const t = String(typeName).trim().toLowerCase()
  if (t === 'any') return 'any'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('int') || t.includes('float') || t.includes('number') || t.includes('decimal') || t.includes('double'))
    return 'number'
  if (t.includes('datetime') || (t.includes('date') && t.includes('time')))
    return 'datetime'
  if (t.includes('date')) return 'date'
  if (t.includes('time')) return 'time'
  if (t.includes('string') || t.includes('text')) return 'string'
  if (t.includes('object') || t.includes('json') || t.includes('record') || t.includes('map')) return 'object'
  return 'unknown'
}

/**
 * Таблица соответствий тип_до → тип_после → identity стандартного конвертера (Payload).
 * Конвертеры: iso-string-to-date, timestamp-to-date, date-to-iso-string, date-to-iso-z,
 * string-to-date, date-to-date-string, date-to-time-string, time-string-to-date,
 * iso-string-to-time-string, weekdays-range, string-trim, default-if-empty, string-to-boolean,
 * to-array, split, string-to-number, number-to-string, json-parse, json-stringify.
 */
const CONVERTER_MATRIX: Array<{ from: PrimitiveKind; to: PrimitiveKind; converterId: string }> = [
  // Строка → число / булево
  { from: 'string', to: 'number', converterId: 'string-to-number' },
  { from: 'string', to: 'boolean', converterId: 'string-to-boolean' },
  // Строка → дата/время
  { from: 'string', to: 'date', converterId: 'string-to-date' },
  { from: 'string', to: 'datetime', converterId: 'iso-string-to-date' },
  { from: 'string', to: 'time', converterId: 'iso-string-to-time-string' },
  // Число → строка / дата
  { from: 'number', to: 'string', converterId: 'number-to-string' },
  { from: 'number', to: 'date', converterId: 'timestamp-to-date' },
  { from: 'number', to: 'datetime', converterId: 'timestamp-to-date' },
  // Date/datetime → строка (разные форматы)
  { from: 'date', to: 'string', converterId: 'date-to-date-string' },
  { from: 'datetime', to: 'string', converterId: 'date-to-iso-string' },
  { from: 'datetime', to: 'time', converterId: 'date-to-time-string' },
  // Время HH:mm:ss → Date (сегодня) - для полей DateTime при значении только времени
  { from: 'time', to: 'date', converterId: 'time-string-to-date' },
  { from: 'time', to: 'datetime', converterId: 'time-string-to-date' },
  // Объект ↔ строка (JSON)
  { from: 'object', to: 'string', converterId: 'json-stringify' },
  { from: 'string', to: 'object', converterId: 'json-parse' },
]

/** Подобрать подходящий конвертер по типу до/после. */
export function pickConverterId(from: PrimitiveKind, to: PrimitiveKind): string | null {
  if (from === 'unknown' || to === 'unknown') return null
  const found = CONVERTER_MATRIX.find(r => r.from === from && r.to === to)
  return found?.converterId ?? null
}

/**
 * Заполняет dataPaths одной колонки: для каждой строки accessors
 * подбирает путь по нечёткому совпадению имени и подставляет accessor.
 */
export function autoFillColumn(column: ColumnForFill, opts: AutoFillOpts): number {
  const { sample, ...buildOpts } = opts
  if (!sample || typeof sample !== 'object') return 0
  const paths = collectPathStrings(sample)
  if (!paths.length) return 0
  let filled = 0
  const accessors = column.accessors ?? []
  for (const row of accessors) {
    const name = (row.name ?? column.title ?? '').trim() || 'value'
    const targetType = column.fieldTypes?.[name] ?? column.fieldTypes?.[row.name ?? '']
    const matched = fuzzyMatchPath(name, paths, sample, targetType)
    if (matched) {
      row.accessor = buildAccessor(matched, buildOpts)
      // Попробуем подобрать конвертер: по типу значения из sample и типу поля компонента
      if (!row.converter && column.fieldTypes) {
        const sampleValue = getValueByPath(sample, matched)
        const fromKind = detectSamplePrimitiveKind(sampleValue)
        const targetTypeName = column.fieldTypes[name] ?? column.fieldTypes[row.name ?? ''] ?? undefined
        const toKind = normalizeFieldType(targetTypeName)
        if (toKind !== 'any') {
          const convId = pickConverterId(fromKind, toKind)
          if (convId)
            row.converter = convId
        }
      }
      filled++
    }
  }
  return filled
}

export interface TableEditorForFill {
  columns: ColumnForFill[]
}

/**
 * Заполняет dataPaths по всем колонкам таблицы.
 */
export function autoFillAllColumns(editor: TableEditorForFill, opts: AutoFillOpts): number {
  let total = 0
  const cols = editor.columns ?? []
  for (const col of cols) {
    total += autoFillColumn(col, opts)
  }
  return total
}
