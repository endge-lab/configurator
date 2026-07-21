import type {
  SmartTabId,
  SmartTabRef,
  SmartTabsApi,
  SmartTabsOptions,
  SmartTabViewState,
  SmartTabViewStateSlice,
  SmartTabsPersistedState,
} from './types'

import { computed, reactive, watch } from 'vue'

import { clearSmartTabs, loadSmartTabs, saveSmartTabs } from './storage'

function sanitizeViewState(raw: unknown): SmartTabViewState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const state: SmartTabViewState = {}
  for (const [key, rawSlice] of Object.entries(raw)) {
    if (!rawSlice || typeof rawSlice !== 'object' || Array.isArray(rawSlice)) {
      continue
    }
    const slice = rawSlice as Partial<SmartTabViewStateSlice>
    if (!Number.isInteger(slice.version) || (slice.version ?? 0) < 1 || !Object.prototype.hasOwnProperty.call(slice, 'value')) {
      continue
    }
    state[key] = { version: slice.version!, value: slice.value }
  }
  return state
}

function sanitizeInitial(raw: SmartTabsPersistedState | null | undefined): SmartTabsPersistedState {
  if (!raw || typeof raw !== 'object') {
    return { openTabs: [], activeTabId: null, viewStateByTabId: {}, sharedViewState: {} }
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

  const openTabIds = new Set(openTabs.map(tab => tab.id))
  const viewStateByTabId: Record<SmartTabId, SmartTabViewState> = {}
  const rawViewState = raw.viewStateByTabId
  if (rawViewState && typeof rawViewState === 'object' && !Array.isArray(rawViewState)) {
    for (const [tabId, rawTabState] of Object.entries(rawViewState)) {
      if (!openTabIds.has(tabId) || !rawTabState || typeof rawTabState !== 'object' || Array.isArray(rawTabState)) {
        continue
      }

      const tabState = sanitizeViewState(rawTabState)
      if (Object.keys(tabState).length > 0) {
        viewStateByTabId[tabId] = tabState
      }
    }
  }

  return {
    openTabs,
    activeTabId,
    viewStateByTabId,
    sharedViewState: sanitizeViewState(raw.sharedViewState),
  }
}

export function useSmartTabs(options: SmartTabsOptions): SmartTabsApi {
  const persist = options.persist !== false
  const maxTabs = options.maxTabs ?? 40

  const initial = persist
    ? sanitizeInitial(loadSmartTabs(options.storageKey))
    : { openTabs: [], activeTabId: null, viewStateByTabId: {}, sharedViewState: {} }

  console.log('[useSmartTabs] Инициализация', {
    storageKey: options.storageKey,
    persist,
    loadedState: initial,
  })

  const state = reactive<SmartTabsPersistedState>({
    openTabs: initial.openTabs ?? [],
    activeTabId: initial.activeTabId ?? null,
    viewStateByTabId: initial.viewStateByTabId ?? {},
    sharedViewState: initial.sharedViewState ?? {},
  })

  function persistNow(): void {
    if (!persist)
      return
    const stateToSave = {
      openTabs: state.openTabs,
      activeTabId: state.activeTabId,
      viewStateByTabId: state.viewStateByTabId,
      sharedViewState: state.sharedViewState,
    }
    console.log('[useSmartTabs] Сохранение состояния в localStorage', {
      storageKey: options.storageKey,
      state: stateToSave,
    })
    saveSmartTabs(options.storageKey, stateToSave)
  }

  watch(
    () => [state.openTabs, state.activeTabId, state.viewStateByTabId, state.sharedViewState],
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
    const removed = state.openTabs.splice(0, overflow)
    removed.forEach((tab) => {
      delete state.viewStateByTabId[tab.id]
      options.onTabClosed?.(tab)
    })

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
        const existing = state.openTabs[existingIndex]!
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
        const replacedTabId = state.openTabs[idx]!.id
        const replacedTab = state.openTabs[idx]!
        state.openTabs.splice(idx, 1, tab)
        if (replacedTabId !== tab.id) {
          delete state.viewStateByTabId[replacedTabId]
          options.onTabClosed?.(replacedTab)
        }
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
    const closedTab = state.openTabs[idx]!

    if (!wasActive) {
      state.openTabs.splice(idx, 1)
      delete state.viewStateByTabId[id]
      options.onTabClosed?.(closedTab)
      return
    }

    state.openTabs.splice(idx, 1)
    delete state.viewStateByTabId[id]
    options.onTabClosed?.(closedTab)

    const remainingTabs = state.openTabs
    if (remainingTabs.length > 0) {
      const nextIndex = idx < remainingTabs.length ? idx : remainingTabs.length - 1
      state.activeTabId = remainingTabs[nextIndex]?.id ?? null
    }
    else {
      state.activeTabId = null
    }
  }

  function closeAll(): void {
    const closedTabs = state.openTabs.filter(t => t.closable !== false)
    state.openTabs = state.openTabs.filter(t => t.closable === false)
    pruneViewState()
    state.activeTabId = state.openTabs[0]?.id ?? null
    closedTabs.forEach(tab => options.onTabClosed?.(tab))
  }

  function closeOthers(id: SmartTabId): void {
    const closedTabs = state.openTabs.filter(t => t.id !== id && t.closable !== false)
    state.openTabs = state.openTabs.filter(t => t.id === id || t.closable === false)
    pruneViewState()
    state.activeTabId = state.openTabs.some(t => t.id === id) ? id : (state.openTabs[0]?.id ?? null)
    closedTabs.forEach(tab => options.onTabClosed?.(tab))
  }

  function closeAllToLeft(id: SmartTabId): void {
    const idx = state.openTabs.findIndex(t => t.id === id)
    if (idx <= 0) return
    const closedTabs = state.openTabs.filter((t, i) => i < idx && t.closable !== false)
    state.openTabs = state.openTabs.filter((t, i) => i >= idx || t.closable === false)
    pruneViewState()
    state.activeTabId = id
    closedTabs.forEach(tab => options.onTabClosed?.(tab))
  }

  function closeAllToRight(id: SmartTabId): void {
    const idx = state.openTabs.findIndex(t => t.id === id)
    if (idx === -1 || idx >= state.openTabs.length - 1) return
    const closedTabs = state.openTabs.filter((t, i) => i > idx && t.closable !== false)
    state.openTabs = state.openTabs.filter((t, i) => i <= idx || t.closable === false)
    pruneViewState()
    state.activeTabId = id
    closedTabs.forEach(tab => options.onTabClosed?.(tab))
  }

  function moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.openTabs.length || toIndex >= state.openTabs.length) {
      return
    }

    const tab = state.openTabs[fromIndex]!
    state.openTabs.splice(fromIndex, 1)
    state.openTabs.splice(toIndex, 0, tab)

    console.log('[useSmartTabs] Вкладка перемещена', {
      fromIndex,
      toIndex,
      tabId: tab.id,
      newOrder: state.openTabs.map(t => t.id),
    })
  }

  function pruneViewState(): void {
    const openTabIds = new Set(state.openTabs.map(tab => tab.id))
    for (const tabId of Object.keys(state.viewStateByTabId)) {
      if (!openTabIds.has(tabId))
        delete state.viewStateByTabId[tabId]
    }
  }

  function getTabViewState(tabId: SmartTabId, key: string): SmartTabViewStateSlice | undefined {
    return state.viewStateByTabId[tabId]?.[key]
  }

  function setTabViewState(tabId: SmartTabId, key: string, slice: SmartTabViewStateSlice): void {
    if (!state.openTabs.some(tab => tab.id === tabId)) {
      return
    }
    try {
      JSON.stringify(slice.value)
    }
    catch (error) {
      console.warn('[SmartTabs] Ignored non-serializable view state.', { tabId, key, error })
      return
    }
    const tabState = state.viewStateByTabId[tabId]
    if (tabState) {
      tabState[key] = slice
    }
    else {
      state.viewStateByTabId[tabId] = { [key]: slice }
    }
  }

  function clearTabViewState(tabId: SmartTabId, key?: string): void {
    if (key == null) {
      delete state.viewStateByTabId[tabId]
      return
    }
    const tabState = state.viewStateByTabId[tabId]
    if (!tabState) {
      return
    }
    delete tabState[key]
    if (Object.keys(tabState).length === 0) {
      delete state.viewStateByTabId[tabId]
    }
  }

  function getSharedViewState(key: string): SmartTabViewStateSlice | undefined {
    return state.sharedViewState?.[key]
  }

  function setSharedViewState(key: string, slice: SmartTabViewStateSlice): void {
    try {
      JSON.stringify(slice.value)
    }
    catch (error) {
      console.warn('[SmartTabs] Ignored non-serializable shared view state.', { key, error })
      return
    }
    if (!state.sharedViewState) {
      state.sharedViewState = {}
    }
    state.sharedViewState[key] = slice
  }

  function clearSharedViewState(key?: string): void {
    if (key == null) {
      state.sharedViewState = {}
      return
    }
    if (state.sharedViewState) {
      delete state.sharedViewState[key]
    }
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
    getTabViewState,
    setTabViewState,
    clearTabViewState,
    getSharedViewState,
    setSharedViewState,
    clearSharedViewState,
    clearStorage,
  }
}
