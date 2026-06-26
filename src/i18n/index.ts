import type { I18nOptions } from 'vue-i18n'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { deepClone, deepMerge } from '@/lib/utils.ts'
import { useBranding } from '../lib/branding'
import en from './locales/en.json'
import ru from './locales/ru.json'

// Type-define 'en' as the master schema for the resource
type MessageSchema = typeof en

export type Locale = 'ru' | 'en'

export const availableLocales: { label: string, value: Locale }[] = [
  {
    label: 'English',
    value: 'en',
  },
  {
    label: 'Русский',
    value: 'ru',
  },
]

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

// Get locale from localStorage or fall back to env variable or 'en'
const LOCALE_STORAGE_KEY = 'replaceme:locale'
const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
const initialLocale = storedLocale ?? import.meta.env.VITE_DEFAULT_LOCALE ?? 'en'

const i18nOptions: I18nOptions<{ message: MessageSchema }, Locale> = {
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, ru },
  availableLocales: availableLocales.map(locale => locale.value),
}

export const i18n = createI18n<false, typeof i18nOptions>(i18nOptions)

// Watch for locale changes and persist to localStorage
watch(() => i18n.global.locale.value, (newLocale) => {
  localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
})

// Reactively apply brand-specific overrides on top of base locales
const baseMessages: Record<'en' | 'ru', MessageSchema> = { en, ru }
function applyBrandLocales(brand: string) {
  const locales = ['en', 'ru'] as const
  for (const loc of locales) {
    const base = deepClone(baseMessages[loc])
    const override = (brandLocaleMap[brand]?.[loc] ?? {}) as Partial<MessageSchema>
    const merged = deepMerge(base, override)
    i18n.global.setLocaleMessage(loc, merged as any)
  }
}

const { branding } = useBranding()
watch(branding, b => applyBrandLocales(b), { immediate: true })
