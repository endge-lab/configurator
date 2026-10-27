/**
 * Копирует текст в буфер обмена: Clipboard API, а без него (не secure context,
 * отказ в разрешении) — через временное скрытое поле и `execCommand('copy')`.
 * Возвращает `false`, если скопировать не удалось. Текст не логируется.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  }
  catch {
    // Переходим к запасному способу ниже.
  }
  return copyWithTextarea(text)
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  const activeElement = document.activeElement as HTMLElement | null
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  }
  catch {
    return false
  }
  finally {
    textarea.value = ''
    textarea.remove()
    activeElement?.focus?.()
  }
}
