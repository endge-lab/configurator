<script setup lang="ts">
import type { SmartTabRef } from '@/components/ui/smart-tabs/types'

import { computed } from 'vue'

import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tab: SmartTabRef | null
}>()

const view = computed(() => {
  if (!props.tab)
    return null
  return EndgeAdmin.tabs.getViewForTab(props.tab)
})
</script>

<template>
  <template v-if="view">
    <component
      :is="view.component"
      v-bind="view.props"
    />
  </template>
  <div
    v-else
    class="p-4 text-sm text-muted-foreground"
  >
    Нет данных для вкладки
  </div>
</template>
