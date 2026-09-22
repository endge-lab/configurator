/** Читает статический список default-hidden; повторяющиеся ключи не меняют результат. */
export function parseTableDefaultHidden(value: string): Set<string> {
  return new Set(splitVisibilityTokens(value))
}

/** Точечно меняет видимость колонки, сохраняя остальные Source-токены без нормализации. */
export function updateTableDefaultHidden(
  value: string,
  key: string,
  hidden: boolean,
): string | null {
  const normalizedKey = key.trim()
  const nextKeys = splitVisibilityTokens(value).filter(item => item !== normalizedKey)

  if (normalizedKey && hidden) {
    nextKeys.push(normalizedKey)
  }

  return nextKeys.join(',') || null
}

function splitVisibilityTokens(value: string): string[] {
  return value.split(',').map(token => token.trim()).filter(Boolean)
}
