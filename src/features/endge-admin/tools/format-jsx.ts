import * as prettier from 'prettier'

const PRETTIER_OPTIONS: prettier.Options = {
  parser: 'babel',
  useTabs: true,
  tabWidth: 2,
  singleAttributePerLine: true,
  printWidth: 100,
}

/**
 * Форматирует JSX: табы, по одному атрибуту на строку.
 * При ошибке парсинга возвращает исходную строку.
 */
export async function formatJsx(code: string): Promise<string> {
  const trimmed = code.trim()
  if (!trimmed)
    return code
  try {
    const out = await prettier.format(trimmed, PRETTIER_OPTIONS)
    return out.trim()
  }
  catch {
    return code
  }
}
