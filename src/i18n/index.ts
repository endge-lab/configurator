import type { I18nOptions } from 'vue-i18n'
import { Endge } from '@endge/core'
import { shallowRef, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { deepClone, deepMerge } from '@/lib/utils.ts'
import { useBranding } from '../lib/branding'
import en from './locales/en.json'
import ru from './locales/ru.json'

// Type-define 'en' as the master schema for the resource
type MessageSchema = typeof en

export type Locale = string

export const availableLocales = shallowRef(mapAvailableLocales())

// Preload brand-specific locale overrides: /src/assets/branding/<brand>/locale/<locale>.json
const brandLocaleFiles = import.meta.glob('/src/assets/branding/*/locale/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, any>

// Build brand -> locale -> messages map
const brandLocaleMap: Record<string, Record<string, any>> = {}
for (const path in brandLocaleFiles) {
  const m = path.match(/\/assets\/branding\/([^/]+)\/locale\/([^/.]+)\.json$/)
  if (!m)
    continue
  const [, brand, locale] = m
  if (!brandLocaleMap[brand!])
    brandLocaleMap[brand!] = {}
  brandLocaleMap[brand!]![locale!] = brandLocaleFiles[path]
}

const initialLocale = Endge.workspace.normalizeLocale(
  Endge.context.currentLocale ?? import.meta.env.VITE_DEFAULT_LOCALE,
) as string

const i18nOptions: I18nOptions = {
  legacy: false,
  locale: initialLocale,
  fallbackLocale: Endge.workspace.fallbackLocale,
  messages: { en, ru },
  availableLocales: Endge.workspace.locales.map(locale => locale.code),
}

export const i18n = createI18n(i18nOptions)

watch(() => i18n.global.locale.value, (newLocale) => {
  Endge.context.setCurrentLocale(newLocale)
})

Endge.context.subscribe(() => {
  const next = Endge.workspace.normalizeLocale(Endge.context.currentLocale) as Locale
  if (i18n.global.locale.value !== next)
    i18n.global.locale.value = next
})

// Reactively apply brand-specific overrides on top of base locales
const baseMessages: Record<string, MessageSchema> = { en, ru }
function applyBrandLocales(brand: string) {
  const locales = Endge.workspace.locales.map(locale => locale.code)
  for (const loc of locales) {
    const base = deepClone(resolveBaseMessages(loc))
    const override = (brandLocaleMap[brand]?.[loc] ?? {}) as Partial<MessageSchema>
    const merged = deepMerge(base, override)
    i18n.global.setLocaleMessage(loc, merged as any)
  }
}

const { branding } = useBranding()
watch(branding, b => applyBrandLocales(b), { immediate: true })

Endge.workspace.subscribe(() => {
  availableLocales.value = mapAvailableLocales()
  i18n.global.fallbackLocale.value = Endge.workspace.fallbackLocale
  applyBrandLocales(branding.value)
})

function mapAvailableLocales(): { label: string, value: Locale }[] {
  return Endge.workspace.locales.map(locale => ({
    label: locale.displayName || locale.shortLabel || locale.code,
    value: locale.code,
  }))
}

function resolveBaseMessages(locale: string): MessageSchema {
  return baseMessages[locale]
    ?? baseMessages[Endge.workspace.fallbackLocale]
    ?? baseMessages[Endge.workspace.defaultLocale]
    ?? ru
}
