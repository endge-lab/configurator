export { default as SmartTabsHost } from '@/features/endge-ide/ui/smart-tabs/SmartTabsHost.vue'
export { SmartTabViewRegistry } from '@/features/endge-ide/ui/smart-tabs/SmartTabViewRegistry'
export type {
  SmartTab,
  SmartTabId,
  SmartTabRef,
  SmartTabsApi,
  SmartTabsOptions,
  SmartTabsPersistedState,
  SmartTabsState,
  SmartTabViewFactory,
  SmartTabViewState,
  SmartTabViewStateSlice,
} from '@/features/endge-ide/ui/smart-tabs/types'

export { useSmartTabs } from '@/features/endge-ide/ui/smart-tabs/useSmartTabs'
export { useSmartTabSelection, useSmartTabSharedViewState, useSmartTabViewState, useSmartTabViewStateFlush, useSmartTabVolatileViewState } from '@/features/endge-ide/ui/smart-tabs/useSmartTabViewState'
