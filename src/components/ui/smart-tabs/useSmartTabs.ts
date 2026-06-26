import type {
  SmartTabId,
  SmartTabRef,
  SmartTabsOptions,
  SmartTabsPersistedState,
} from './types'

import { computed, reactive, watch } from 'vue'

import { clearSmartTabs, loadSmartTabs, saveSmartTabs } from './storage'

interface SmartTabsApi {
  openTabs: ReturnType<typeof computed<SmartTabRef[]>>
  activeTab: ReturnType<typeof computed<SmartTabRef | null>>
  activeTabId: ReturnType<typeof computed<SmartTabId | null>>

  openTab: (tab: SmartTabRef, opts?: { activate?: boolean, replace?: boolean }) => void
  activateTab: (id: SmartTabId) => void
  closeTab: (id: SmartTabId) => void
  closeAll: () => void
  closeOthers: (id: SmartTabId) => void
  closeAllToLeft: (id: SmartTabId) => void
  closeAllToRight: (id: SmartTabId) => void
  moveTab: (fromIndex: number, toIndex: number) => void

  clearStorage: () => void
}

function sanitizeInitial(raw: SmartTabsPersistedState | null | undefined): SmartTabsPersistedState {
  if (!raw || typeof raw !== 'object') {
    return { openTabs: [], activeTabId: null }
  }

  const openTabs = Array.isArray(raw.openTabs)
    ? raw.openTabs.filter((t): t is SmartTabRef =>
      Boolean(t)
      && typeof t === 'object'
      && typeof (t as SmartTabRef).id === 'string'
      && typeof (t as SmartTabRef).label === 'string'
      && typeof (t as SmartTabRef).viewId === 'string',
    )
    : []

  const activeTabId = (typeof raw.activeTabId === 'string' && openTabs.some(t => t.id === raw.activeTabId))
    ? raw.activeTabId
    : (openTabs[0]?.id ?? null)

  return { openTabs, activeTabId }
}

export function useSmartTabs(options: SmartTabsOptions): SmartTabsApi {
  const persist = options.persist !== false
  const maxTabs = options.maxTabs ?? 40

  const initial = persist ? sanitizeInitial(loadSmartTabs(options.storageKey)) : { openTabs: [], activeTabId: null }

  console.log('[useSmartTabs] Инициализация', {
    storageKey: options.storageKey,
    persist,
    loadedState: initial,
  })

  const state = reactive<SmartTabsPersistedState>({
    openTabs: initial.openTabs ?? [],
    activeTabId: initial.activeTabId ?? null,
  })

  function persistNow(): void {
    if (!persist)
      return
    const stateToSave = {
      openTabs: state.openTabs,
      activeTabId: state.activeTabId,
    }
    console.log('[useSmartTabs] Сохранение состояния в localStorage', {
      storageKey: options.storageKey,
      state: stateToSave,
    })
    saveSmartTabs(options.storageKey, stateToSave)
  }

  watch(
    () => [state.openTabs, state.activeTabId],
    () => {
      persistNow()
    },
    { deep: true, immediate: false },
  )

  const openTabs = computed(() => state.openTabs)

  const activeTab = computed(() => {
    if (!state.activeTabId)
      return null
    return state.openTabs.find(t => t.id === state.activeTabId) ?? null
  })

  const activeTabId = computed(() => state.activeTabId)

  function enforceMax(): void {
    if (state.openTabs.length <= maxTabs)
      return

    const overflow = state.openTabs.length - maxTabs
    state.openTabs.splice(0, overflow)

    // если активная вкладка была среди удалённых - подхватим первую
    if (state.activeTabId && !state.openTabs.some(t => t.id === state.activeTabId)) {
      state.activeTabId = state.openTabs[0]?.id ?? null
    }
  }

  function openTab(tab: SmartTabRef, opts?: { activate?: boolean, replace?: boolean }): void {
    console.log('[useSmartTabs] openTab вызван', {
      tab,
      opts,
      currentTabs: state.openTabs.length,
      currentActiveId: state.activeTabId,
    })

    const activate = opts?.activate !== false
    const replace = opts?.replace === true

    if (tab.singleton) {
      const existingIndex = state.openTabs.findIndex(t => t.viewId === tab.viewId)
      if (existingIndex !== -1) {
        const existing = state.openTabs[existingIndex]
        state.openTabs.splice(existingIndex, 1, { ...existing, ...tab })
        if (activate) state.activeTabId = existing.id
        return
      }
    }

    const existingIndex = state.openTabs.findIndex(t => t.id === tab.id)

    if (existingIndex !== -1) {
      console.log('[useSmartTabs] Вкладка уже существует, обновляем и активируем', {
        existingIndex,
        tabId: tab.id,
        activate,
      })
      state.openTabs.splice(existingIndex, 1, { ...state.openTabs[existingIndex], ...tab })
      if (activate)
        state.activeTabId = tab.id
      console.log('[useSmartTabs] После обновления', {
        openTabs: state.openTabs.length,
        activeTabId: state.activeTabId,
      })
      return
    }

    if (replace && state.activeTabId) {
      const idx = state.openTabs.findIndex(t => t.id === state.activeTabId)
      if (idx !== -1) {
        console.log('[useSmartTabs] Заменяем активную вкладку', {
          replaceIndex: idx,
          tabId: tab.id,
        })
        state.openTabs.splice(idx, 1, tab)
        state.activeTabId = activate ? tab.id : state.activeTabId
        enforceMax()
        return
      }
    }

    console.log('[useSmartTabs] Добавляем новую вкладку', {
      tabId: tab.id,
      activate,
    })
    state.openTabs.push(tab)
    if (activate)
      state.activeTabId = tab.id

    enforceMax()
    console.log('[useSmartTabs] После добавления', {
      openTabs: state.openTabs.length,
      activeTabId: state.activeTabId,
      tabs: state.openTabs.map(t => ({ id: t.id, label: t.label })),
    })
  }

  function activateTab(id: SmartTabId): void {
    console.log('[useSmartTabs] activateTab вызван', {
      id,
      exists: state.openTabs.some(t => t.id === id),
      currentActiveId: state.activeTabId,
    })
    if (!state.openTabs.some(t => t.id === id)) {
      console.warn('[useSmartTabs] Вкладка не найдена для активации, но это нормально если она была закрыта', { id })
      return
    }
    state.activeTabId = id
    console.log('[useSmartTabs] Вкладка активирована', {
      activeTabId: state.activeTabId,
    })
  }

  function closeTab(id: SmartTabId): void {
    const idx = state.openTabs.findIndex(t => t.id === id)
    if (idx === -1)
      return

    if (state.openTabs[idx]?.closable === false)
      return

    const wasActive = state.activeTabId === id

    if (!wasActive) {
      state.openTabs.splice(idx, 1)
      return
    }

    state.openTabs.splice(idx, 1)

    const remainingTabs = state.openTabs
    if (remainingTabs.length > 0) {
      const nextIndex = idx < remainingTabs.length ? idx : remainingTabs.length - 1
      state.activeTabId = remainingTabs[nextIndex]?.id ?? null
    } else {
      state.activeTabId = null
    }
  }

  function closeAll(): void {
    state.openTabs = state.openTabs.filter(t => t.closable === false)
    state.activeTabId = state.openTabs[0]?.id ?? null
  }

  function closeOthers(id: SmartTabId): void {
    state.openTabs = state.openTabs.filter(t => t.id === id || t.closable === false)
    state.activeTabId = state.openTabs.some(t => t.id === id) ? id : (state.openTabs[0]?.id ?? null)
  }

  function closeAllToLeft(id: SmartTabId): void {
    const idx = state.openTabs.findIndex(t => t.id === id)
    if (idx <= 0) return
    state.openTabs = state.openTabs.filter((t, i) => i >= idx || t.closable === false)
    state.activeTabId = id
  }

  function closeAllToRight(id: SmartTabId): void {
    const idx = state.openTabs.findIndex(t => t.id === id)
    if (idx === -1 || idx >= state.openTabs.length - 1) return
    state.openTabs = state.openTabs.filter((t, i) => i <= idx || t.closable === false)
    state.activeTabId = id
  }

  function moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.openTabs.length || toIndex >= state.openTabs.length) {
      return
    }

    const tab = state.openTabs[fromIndex]
    state.openTabs.splice(fromIndex, 1)
    state.openTabs.splice(toIndex, 0, tab)

    console.log('[useSmartTabs] Вкладка перемещена', {
      fromIndex,
      toIndex,
      tabId: tab.id,
      newOrder: state.openTabs.map(t => t.id),
    })
  }

  function clearStorage(): void {
    clearSmartTabs(options.storageKey)
  }

  return {
    openTabs,
    activeTab,
    activeTabId,
    openTab,
    activateTab,
    closeTab,
    closeAll,
    closeOthers,
    closeAllToLeft,
    closeAllToRight,
    moveTab,
    clearStorage,
  }
}
