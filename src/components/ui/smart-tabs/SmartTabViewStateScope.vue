<script setup lang="ts">
import type { SmartTabsApi } from '@/components/ui/smart-tabs/types'

import { provide } from 'vue'

import { SMART_TAB_VIEW_STATE_SCOPE } from '@/components/ui/smart-tabs/useSmartTabViewState'

const props = defineProps<{
  api: SmartTabsApi
  tabId: string
}>()

provide(SMART_TAB_VIEW_STATE_SCOPE, {
  read: key => props.api.getTabViewState(props.tabId, key),
  write: (key, slice) => props.api.setTabViewState(props.tabId, key, slice),
  clear: key => props.api.clearTabViewState(props.tabId, key),
  readShared: key => props.api.getSharedViewState(key),
  writeShared: (key, slice) => props.api.setSharedViewState(key, slice),
  clearShared: key => props.api.clearSharedViewState(key),
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <slot />
  </div>
</template>
