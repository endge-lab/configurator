function parseHelpURL(variableName: string, value: string | undefined): string | undefined {
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

  console.warn(`[EndgeIDE] ${variableName} must be an absolute http(s) URL`)
  return undefined
}

/** Внешняя документация Configurator, доступная из хедера IDE. */
export const ENDGE_IDE_DOCUMENTATION_URL = parseHelpURL(
  'VITE_DOCUMENTATION_URL',
  import.meta.env.VITE_DOCUMENTATION_URL,
)

/** Governance portal, доступный из хедера IDE. */
export const ENDGE_IDE_GOVERNANCE_PORTAL_URL = parseHelpURL(
  'VITE_GOVERNANCE_PORTAL_URL',
  import.meta.env.VITE_GOVERNANCE_PORTAL_URL,
)
