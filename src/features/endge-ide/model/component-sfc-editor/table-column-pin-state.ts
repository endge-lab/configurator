export type TableVisualColumnPinSide = 'left' | 'right' | 'none'

const PIN_SIDES = new Set<TableVisualColumnPinSide>(['left', 'right'])

/** Читает статическую default-pin строку, следуя compiler semantics: первое валидное значение побеждает. */
export function parseTableDefaultPin(value: string): Map<string, Exclude<TableVisualColumnPinSide, 'none'>> {
  const result = new Map<string, Exclude<TableVisualColumnPinSide, 'none'>>()

  for (const token of splitPinTokens(value)) {
    const [rawKey, rawSide] = token.split(':').map(part => part?.trim())
    const key = rawKey ?? ''
    const side = rawSide ?? ''
    if (!key || !PIN_SIDES.has(side as TableVisualColumnPinSide) || result.has(key)) {
      continue
    }
    result.set(key, side as Exclude<TableVisualColumnPinSide, 'none'>)
  }

  return result
}

/** Точечно заменяет одну колонку в default-pin, сохраняя остальные, включая Source-owned invalid tokens. */
export function updateTableDefaultPin(
  value: string,
  key: string,
  side: Exclude<TableVisualColumnPinSide, 'none'> | null,
): string | null {
  const normalizedKey = key.trim()
  const nextTokens = splitPinTokens(value).filter(token => pinTokenKey(token) !== normalizedKey)

  if (normalizedKey && side) {
    nextTokens.push(`${normalizedKey}:${side}`)
  }

  return nextTokens.join(',') || null
}

function splitPinTokens(value: string): string[] {
  return value.split(',').map(token => token.trim()).filter(Boolean)
}

function pinTokenKey(token: string): string {
  return token.split(':')[0]?.trim() ?? ''
}
