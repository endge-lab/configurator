import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { shallowRef, watch } from 'vue'

import { i18n } from '@/i18n'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { deepClone, deepMerge } from '@/lib/utils.ts'

type MessageSchema = typeof en
export type ConfiguratorLocale = string

const brandLocaleFiles = import.meta.glob('/src/assets/branding/*/locale/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const brandLocaleMap: Record<string, Record<string, unknown>> = {}
for (const path in brandLocaleFiles) {
  const match = path.match(/\/assets\/branding\/([^/]+)\/locale\/([^/.]+)\.json$/)
  if (!match) {
    continue
  }
  const [, brand, locale] = match
  brandLocaleMap[brand!] ??= {}
  brandLocaleMap[brand!]![locale!] = brandLocaleFiles[path]
}

/** Synchronizes the Vue i18n adapter with the loaded Endge Workspace. */
export class ConfiguratorI18n_Module {
  private readonly _availableLocales = shallowRef<Array<{ label: string, value: ConfiguratorLocale }>>([])
  private readonly _stopHandles: Array<() => void> = []
  private _initialized = false

  public constructor(private readonly _branding: Ref<string>) {}

  public get availableLocales() {
    return this._availableLocales
  }

  public init(): void {
    if (this._initialized) {
      return
    }
    this._initialized = true

    this._syncWorkspace(this._branding.value)
    this._stopHandles.push(
      watch(() => i18n.global.locale.value, (newLocale) => {
        Endge.context.setCurrentLocale(newLocale)
      }),
      Endge.context.subscribe(() => {
        const next = Endge.workspace.normalizeLocale(Endge.context.currentLocale) as ConfiguratorLocale
        if (i18n.global.locale.value !== next) {
          i18n.global.locale.value = next
        }
      }),
      watch(this._branding, brand => this._applyBrandLocales(brand)),
      Endge.workspace.subscribe(() => this._syncWorkspace(this._branding.value)),
    )
  }

  public reset(): void {
    for (const stop of this._stopHandles.splice(0).reverse()) {
      stop()
    }
    this._availableLocales.value = []
    this._initialized = false
  }

  private _applyBrandLocales(brand: string): void {
    const locales = Endge.workspace.locales.map(locale => locale.code)
    for (const locale of locales) {
      const base = deepClone(this._resolveBaseMessages(locale))
      const override = (brandLocaleMap[brand]?.[locale] ?? {}) as Partial<MessageSchema>
      const merged = deepMerge(base, override)
      i18n.global.setLocaleMessage(locale, merged as any)
    }
  }

  private _syncWorkspace(brand: string): void {
    this._availableLocales.value = Endge.workspace.locales.map(locale => ({
      label: locale.displayName || locale.shortLabel || locale.code,
      value: locale.code,
    }))
    i18n.global.fallbackLocale.value = Endge.workspace.fallbackLocale
    const locale = Endge.workspace.normalizeLocale(Endge.context.currentLocale) as ConfiguratorLocale
    if (i18n.global.locale.value !== locale) {
      i18n.global.locale.value = locale
    }
    this._applyBrandLocales(brand)
  }

  private _resolveBaseMessages(locale: string): MessageSchema {
    const baseMessages: Record<string, MessageSchema> = { en, ru }
    return baseMessages[locale]
      ?? baseMessages[Endge.workspace.fallbackLocale]
      ?? baseMessages[Endge.workspace.defaultLocale]
      ?? en
  }
}
