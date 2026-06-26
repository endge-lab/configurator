import type { SmartTabsPersistedState } from './types'

const VERSION = 1

interface StoredPayload {
  v: number
  state: SmartTabsPersistedState
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw)
    return null
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

export function loadSmartTabs(key: string): SmartTabsPersistedState | null {
  if (typeof window === 'undefined')
    return null

  const raw = localStorage.getItem(key)
  console.log('[storage] Загрузка из localStorage', { key, raw })
  
  const parsed = safeParse<StoredPayload>(raw)
  console.log('[storage] Распарсено', { parsed, version: parsed?.v, expectedVersion: VERSION })
  
  if (!parsed || parsed.v !== VERSION) {
    console.log('[storage] Версия не совпадает или данные отсутствуют')
    return null
  }

  console.log('[storage] Загружено состояние', parsed.state)
  return parsed.state
}

export function saveSmartTabs(key: string, state: SmartTabsPersistedState): void {
  if (typeof window === 'undefined')
    return

  const payload: StoredPayload = { v: VERSION, state }
  const serialized = JSON.stringify(payload)
  console.log('[storage] Сохранение в localStorage', { key, state, serialized })
  localStorage.setItem(key, serialized)
  console.log('[storage] Сохранено успешно')
}

export function clearSmartTabs(key: string): void {
  if (typeof window === 'undefined')
    return
  localStorage.removeItem(key)
}
