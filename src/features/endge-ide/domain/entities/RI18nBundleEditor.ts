import type { RI18nBundle } from '@endge/core'

/**
 * Модель редактора для RI18nBundle (коллекция i18n-bundles).
 */
export class RI18nBundleEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  /** По коду локали — дерево ключ→значение. */
  locales: Record<string, Record<string, unknown>> = {}
  /** Editor-only JSON source полного объекта locales. */
  sourceText: string = '{}'
  active: boolean = true

  fillFromSource(source: RI18nBundle): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.description = String(source.description ?? '')
    this.locales = (source.locales && typeof source.locales === 'object' && !Array.isArray(source.locales))
      ? { ...source.locales }
      : {}
    this.syncSourceTextFromLocales()
    this.active = source.active !== false
  }

  updateSource(source: RI18nBundle): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description || null
    source.locales = this.locales && typeof this.locales === 'object' ? { ...this.locales } : {}
    source.active = this.active !== false
  }

  syncSourceTextFromLocales(): void {
    this.sourceText = JSON.stringify(this.locales ?? {}, null, 2)
  }

  applySourceText(value = this.sourceText): void {
    const parsed = JSON.parse(value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('JSON словаря должен быть объектом локалей')

    for (const [locale, messages] of Object.entries(parsed)) {
      if (!messages || typeof messages !== 'object' || Array.isArray(messages))
        throw new Error(`Локаль "${locale}" должна быть объектом сообщений`)
    }

    this.locales = { ...parsed } as Record<string, Record<string, unknown>>
    this.sourceText = JSON.stringify(this.locales, null, 2)
  }
}
