import type { I18nOptions } from 'vue-i18n'

import { createI18n } from 'vue-i18n'

import en from './locales/en.json'
import ru from './locales/ru.json'

// Локаль 'en' задаёт основную схему ресурса для типов
type MessageSchema = typeof en

export type Locale = string

// Этот модуль импортируется до initial navigation и Endge boot. Актуальные
// Workspace locale/fallback применяются явной инициализацией после router barrier.
const initialLocale = String(import.meta.env.VITE_DEFAULT_LOCALE || 'en')

const i18nOptions: I18nOptions<{ message: MessageSchema }, Locale> = {
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, ru },
  availableLocales: ['en', 'ru'],
}

export const i18n = createI18n<false, typeof i18nOptions>(i18nOptions)
