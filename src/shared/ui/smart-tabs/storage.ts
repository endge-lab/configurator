import type { SmartTabsPersistedState, SmartTabsPersistence } from './types'

const VERSION = 2

interface StoredPayload {
  v: number
  state: SmartTabsPersistedState
}

export function loadSmartTabs(persistence: SmartTabsPersistence, key: string): SmartTabsPersistedState | null {
  let parsed: StoredPayload | null = null
  try {
    parsed = persistence.read<StoredPayload | null>(key, null)
  }
  catch (error) {
    console.warn(`[SmartTabs] Failed to restore tab state "${key}": ${error instanceof Error ? error.message : String(error)}`)
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

export function saveSmartTabs(persistence: SmartTabsPersistence, key: string, state: SmartTabsPersistedState): void {
  try {
    const payload: StoredPayload = { v: VERSION, state }
    persistence.write(key, payload)
  }
  catch (error) {
    console.warn(`[SmartTabs] Failed to persist tab state "${key}": ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function clearSmartTabs(persistence: SmartTabsPersistence, key: string): void {
  try {
    persistence.remove(key)
  }
  catch (error) {
    console.warn(`[SmartTabs] Failed to clear tab state "${key}": ${error instanceof Error ? error.message : String(error)}`)
  }
}
