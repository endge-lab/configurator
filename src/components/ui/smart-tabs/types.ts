import type { Component, ComputedRef } from 'vue'

export type SmartTabId = string

export interface SmartTab {
  id: string
  label: string
  /**
   * Идентификатор view/рендера (не обязательно "документ")
   */
  viewId: string
  /**
   * Любые сериализуемые данные (для сохранения в LS).
   * Важно: функции/компоненты сюда НЕ класть.
   */
  payload?: Record<string, unknown>
  /**
   * Любые метаданные для UI (необязательно сериализовать)
   */
  meta?: Record<string, unknown>
}

export interface SmartTabRef extends SmartTab {
  /**
   * Можно ли закрыть вкладку
   */
  closable?: boolean
  /**
   * Если true, то может быть открыта только одна вкладка с таким viewId
   */
  singleton?: boolean
  /**
   * Пропсы для компонента view
   */
  props?: Record<string, unknown>
}

export interface SmartTabsState {
  tabs: SmartTab[]
  activeId: string
}

export interface SmartTabsPersistedState {
  openTabs: SmartTabRef[]
  activeTabId: SmartTabId | null
  viewStateByTabId: Record<SmartTabId, SmartTabViewState>
  sharedViewState?: SmartTabViewState
}

export interface SmartTabViewStateSlice {
  version: number
  value: unknown
}

export type SmartTabViewState = Record<string, SmartTabViewStateSlice>

export interface SmartTabsOptions {
  storageKey: string
  /**
   * Автосоздание первой вкладки при пустом состоянии
   */
  autoInit?: boolean
  /**
   * Сохранять состояние в localStorage
   */
  persist?: boolean
  /**
   * Максимальное количество открытых вкладок
   */
  maxTabs?: number
  /** Lifecycle callback after a tab was physically removed from the tab state. */
  onTabClosed?: (tab: SmartTabRef) => void
}

export interface SmartTabViewResolved {
  component: Component
  props?: Record<string, unknown>
}

export type SmartTabViewFactory = (tab: SmartTabRef) => SmartTabViewResolved

export interface SmartTabsApi {
  openTabs: ComputedRef<SmartTabRef[]>
  activeTab: ComputedRef<SmartTabRef | null>
  activeTabId: ComputedRef<SmartTabId | null>

  openTab: (tab: SmartTabRef, opts?: { activate?: boolean, replace?: boolean }) => void
  activateTab: (id: SmartTabId) => void
  closeTab: (id: SmartTabId) => void
  closeAll: () => void
  closeOthers: (id: SmartTabId) => void
  closeAllToLeft: (id: SmartTabId) => void
  closeAllToRight: (id: SmartTabId) => void
  moveTab: (fromIndex: number, toIndex: number) => void
  getTabViewState: (tabId: SmartTabId, key: string) => SmartTabViewStateSlice | undefined
  setTabViewState: (tabId: SmartTabId, key: string, slice: SmartTabViewStateSlice) => void
  clearTabViewState: (tabId: SmartTabId, key?: string) => void
  getSharedViewState: (key: string) => SmartTabViewStateSlice | undefined
  setSharedViewState: (key: string, slice: SmartTabViewStateSlice) => void
  clearSharedViewState: (key?: string) => void
  clearStorage: () => void
}
