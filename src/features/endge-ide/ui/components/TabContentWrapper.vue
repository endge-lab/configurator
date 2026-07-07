<script setup lang="ts">
import type { SmartTabRef } from '@/components/ui/smart-tabs/types'

import { computed } from 'vue'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tab: SmartTabRef | null
}>()

const view = computed(() => {
  if (!props.tab)
    return null
  return EndgeIDE.tabs.getViewForTab(props.tab)
})
</script>

<template>
  <div v-if="view" class="flex h-full min-h-0 w-full flex-col overflow-hidden">
    <component
      :is="view.component"
      v-bind="view.props"
      class="min-h-0 flex-1"
    />
  </div>
  <div
    v-else
    class="h-full p-4 text-sm text-muted-foreground"
  >
    Нет данных для вкладки
  </div>
</template>
