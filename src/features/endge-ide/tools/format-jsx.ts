import { formatSource } from '@/features/endge-ide/tools/format-source'

/**
 * Форматирует JSX общим browser-safe Prettier formatter-ом.
 * При ошибке парсинга возвращает исходную строку.
 */
export async function formatJsx(code: string): Promise<string> {
  const trimmed = code.trim()
  if (!trimmed) {
    return code
  }
  try {
    const out = await formatSource(trimmed, 'javascript')
    return out.trim()
  }
  catch {
    return code
  }
}
