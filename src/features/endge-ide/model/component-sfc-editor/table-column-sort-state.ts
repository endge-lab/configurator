export type TableVisualColumnSortDirection = 'asc' | 'desc'

export interface TableVisualColumnSortItem {
  key: string
  direction: TableVisualColumnSortDirection
}

const SORT_DIRECTIONS = new Set<TableVisualColumnSortDirection>(['asc', 'desc'])

/** Читает ordered dot paths из Column sort-by. */
export function parseTableColumnSortPaths(value: string): string[] {
  return value.split(',').map(path => path.trim()).filter(Boolean)
}

/** Сериализует paths обратно в компактный Source attribute. */
export function serializeTableColumnSortPaths(paths: readonly string[]): string | null {
  const value = paths.map(path => path.trim()).filter(Boolean).join(',')
  return value || null
}

/** Проверяет row-relative DataPath, поддерживаемый Table renderer. */
export function isTableColumnSortPath(value: string): boolean {
  const path = value.trim()
  const identifier = String.raw`[A-Za-z_$][\w$]*`
  const selectorKey = String.raw`[A-Za-z_$][\w$-]*`
  const selectorValue = String.raw`(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d+)`
  const segment = String.raw`${identifier}(?:\[\s*${selectorKey}\s*=\s*${selectorValue}\s*\]|\[\s*\d+\s*\])*`

  return new RegExp(String.raw`^${segment}(?:\.${segment})*$`).test(path)
}

/** Читает default-sort в compiler order; позиция элемента является его sort priority. */
export function parseTableDefaultSort(value: string): TableVisualColumnSortItem[] {
  return splitSortTokens(value)
    .map(parseSortToken)
    .filter((item): item is TableVisualColumnSortItem => item != null)
}

/** Меняет направление одной колонки, сохраняя её priority и посторонние Source-токены. */
export function updateTableDefaultSort(
  value: string,
  key: string,
  direction: TableVisualColumnSortDirection | null,
): string | null {
  const normalizedKey = key.trim()
  const nextTokens: string[] = []
  let inserted = false

  for (const token of splitSortTokens(value)) {
    if (sortTokenKey(token) !== normalizedKey) {
      nextTokens.push(token)
      continue
    }
    if (direction && !inserted) {
      nextTokens.push(`${normalizedKey}:${direction}`)
      inserted = true
    }
  }

  if (normalizedKey && direction && !inserted) {
    nextTokens.push(`${normalizedKey}:${direction}`)
  }

  return nextTokens.join(',') || null
}

/** Переименовывает ключ в default-sort без изменения priority и direction. */
export function renameTableDefaultSortKey(
  value: string,
  oldKey: string,
  newKey: string,
): string | null {
  const normalizedOldKey = oldKey.trim()
  const normalizedNewKey = newKey.trim()
  const nextTokens: string[] = []
  let renamed = false

  for (const token of splitSortTokens(value)) {
    const key = sortTokenKey(token)
    if (key === normalizedNewKey && normalizedNewKey !== normalizedOldKey) {
      continue
    }
    if (key !== normalizedOldKey) {
      nextTokens.push(token)
      continue
    }
    if (!renamed && normalizedNewKey) {
      const item = parseSortToken(token)
      nextTokens.push(`${normalizedNewKey}:${item?.direction ?? 'asc'}`)
      renamed = true
    }
  }

  return nextTokens.join(',') || null
}

/** Перемещает сортировку на один priority выше или ниже, не нормализуя остальные токены. */
export function moveTableDefaultSort(
  value: string,
  key: string,
  offset: -1 | 1,
): string | null {
  const tokens = splitSortTokens(value)
  const validTokenIndexes = tokens
    .map((token, index) => parseSortToken(token) ? index : -1)
    .filter(index => index >= 0)
  const currentPriority = validTokenIndexes.findIndex(index => sortTokenKey(tokens[index] ?? '') === key.trim())
  const targetPriority = currentPriority + offset

  if (currentPriority < 0 || targetPriority < 0 || targetPriority >= validTokenIndexes.length) {
    return tokens.join(',') || null
  }

  const currentIndex = validTokenIndexes[currentPriority]
  const targetIndex = validTokenIndexes[targetPriority]
  if (currentIndex == null || targetIndex == null) {
    return tokens.join(',') || null
  }
  ;[tokens[currentIndex], tokens[targetIndex]] = [tokens[targetIndex]!, tokens[currentIndex]!]
  return tokens.join(',') || null
}

function splitSortTokens(value: string): string[] {
  return value.split(',').map(token => token.trim()).filter(Boolean)
}

function parseSortToken(token: string): TableVisualColumnSortItem | null {
  const [rawKey, rawDirection] = token.split(':').map(part => part?.trim())
  const key = rawKey ?? ''
  const direction = rawDirection || 'asc'
  if (!key || !SORT_DIRECTIONS.has(direction as TableVisualColumnSortDirection)) {
    return null
  }
  return { key, direction: direction as TableVisualColumnSortDirection }
}

function sortTokenKey(token: string): string {
  return token.split(':')[0]?.trim() ?? ''
}
