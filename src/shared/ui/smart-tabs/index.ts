export { default as SmartTabsHost } from '@/shared/ui/smart-tabs/SmartTabsHost.vue'
export { SmartTabViewRegistry } from '@/shared/ui/smart-tabs/SmartTabViewRegistry'
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
} from '@/shared/ui/smart-tabs/types'

export { useSmartTabs } from '@/shared/ui/smart-tabs/useSmartTabs'
export { useSmartTabSelection, useSmartTabSharedViewState, useSmartTabViewState, useSmartTabViewStateFlush, useSmartTabVolatileViewState } from '@/shared/ui/smart-tabs/useSmartTabViewState'
