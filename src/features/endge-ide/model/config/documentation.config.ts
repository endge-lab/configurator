function parseDocumentationURL(value: string | undefined): string | undefined {
  const candidate = value?.trim()
  if (!candidate) {
    return undefined
  }

  try {
    const url = new URL(candidate)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  }
  catch {
    // Сообщение ниже одинаково обрабатывает некорректный URL и запрещённый protocol.
  }

  console.warn('[EndgeIDE] VITE_DOCUMENTATION_URL must be an absolute http(s) URL')
  return undefined
}

/** Внешняя документация Configurator, доступная из хедера IDE. */
export const ENDGE_IDE_DOCUMENTATION_URL = parseDocumentationURL(
  import.meta.env.VITE_DOCUMENTATION_URL,
)
