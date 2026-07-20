export { clearSmartTabViews, getSmartTabView, registerSmartTabView, unregisterSmartTabView } from '@/components/ui/smart-tabs/registry'

export { default as SmartTabsHost } from '@/components/ui/smart-tabs/SmartTabsHost.vue'
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
} from '@/components/ui/smart-tabs/types'

export { useSmartTabs } from '@/components/ui/smart-tabs/useSmartTabs'
export { useSmartTabSelection, useSmartTabSharedViewState, useSmartTabViewState } from '@/components/ui/smart-tabs/useSmartTabViewState'
