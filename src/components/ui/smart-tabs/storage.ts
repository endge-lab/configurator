import type { SmartTabsPersistedState } from './types'

const VERSION = 2

interface StoredPayload {
  v: number
  state: SmartTabsPersistedState
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

export function loadSmartTabs(key: string): SmartTabsPersistedState | null {
  if (typeof window === 'undefined') {
    return null
  }

  let parsed: StoredPayload | null
  try {
    parsed = safeParse<StoredPayload>(localStorage.getItem(key))
  }
  catch (error) {
    console.warn('[SmartTabs] Failed to restore tab state.', { key, error })
    return null
  }
  if (!parsed || (parsed.v !== 1 && parsed.v !== VERSION)) {
    return null
  }

  if (parsed.v === 1) {
    return {
      openTabs: Array.isArray(parsed.state?.openTabs) ? parsed.state.openTabs : [],
      activeTabId: parsed.state?.activeTabId ?? null,
      viewStateByTabId: {},
    }
  }

  return parsed.state
}

export function saveSmartTabs(key: string, state: SmartTabsPersistedState): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const payload: StoredPayload = { v: VERSION, state }
    localStorage.setItem(key, JSON.stringify(payload))
  }
  catch (error) {
    console.warn('[SmartTabs] Failed to persist tab state.', { key, error })
  }
}

export function clearSmartTabs(key: string): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(key)
  }
  catch (error) {
    console.warn('[SmartTabs] Failed to clear tab state.', { key, error })
  }
}
