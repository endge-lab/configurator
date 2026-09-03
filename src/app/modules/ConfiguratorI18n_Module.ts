import { Endge } from '@endge/core'
import { shallowRef, watch } from 'vue'

import { i18n } from '@/app/i18n'
import en from '@/app/i18n/locales/en.json'
import ru from '@/app/i18n/locales/ru.json'

type MessageSchema = typeof en
export type ConfiguratorLocale = string

/** Synchronizes the Vue i18n adapter with the loaded Endge Workspace. */
export class ConfiguratorI18n_Module {
  private readonly _availableLocales = shallowRef<Array<{ label: string, value: ConfiguratorLocale }>>([])
  private readonly _stopHandles: Array<() => void> = []
  private _initialized = false

  public get availableLocales() {
    return this._availableLocales
  }

  public init(): void {
    if (this._initialized) {
      return
    }
    this._initialized = true

    this._syncWorkspace()
    this._stopHandles.push(
      watch(() => i18n.global.locale.value, (newLocale) => {
        Endge.context.setCurrentLocale(newLocale)
      }),
      Endge.context.subscribe(() => {
        if (!Endge.workspace.isLoaded) {
          return
        }
        const next = Endge.workspace.normalizeLocale(Endge.context.currentLocale) as ConfiguratorLocale
        if (i18n.global.locale.value !== next) {
          i18n.global.locale.value = next
        }
      }),
      Endge.workspace.subscribe(() => this._syncWorkspace()),
    )
  }

  public reset(): void {
    for (const stop of this._stopHandles.splice(0).reverse()) {
      stop()
    }
    this._availableLocales.value = []
    this._initialized = false
  }

  private _applyLocales(): void {
    const locales = Endge.workspace.locales.map(locale => locale.code)
    for (const locale of locales) {
      i18n.global.setLocaleMessage(locale, this._resolveBaseMessages(locale) as any)
    }
  }

  private _syncWorkspace(): void {
    if (!Endge.workspace.isLoaded) {
      this._availableLocales.value = []
      return
    }

    this._availableLocales.value = Endge.workspace.locales.map(locale => ({
      label: locale.displayName || locale.shortLabel || locale.code,
      value: locale.code,
    }))
    i18n.global.fallbackLocale.value = Endge.workspace.fallbackLocale
    const locale = Endge.workspace.normalizeLocale(Endge.context.currentLocale) as ConfiguratorLocale
    if (i18n.global.locale.value !== locale) {
      i18n.global.locale.value = locale
    }
    this._applyLocales()
  }

  private _resolveBaseMessages(locale: string): MessageSchema {
    const baseMessages: Record<string, MessageSchema> = { en, ru }
    return baseMessages[locale]
      ?? baseMessages[Endge.workspace.fallbackLocale]
      ?? baseMessages[Endge.workspace.defaultLocale]
      ?? en
  }
}
