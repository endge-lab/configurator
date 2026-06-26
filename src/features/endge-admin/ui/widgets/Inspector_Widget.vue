<script setup lang="ts">
import { computed } from 'vue'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const inspectorView = computed(() =>
  EndgeAdmin.inspector.getViewForTab(
    EndgeAdmin.tabs.activeTab.value,
    EndgeAdmin.tabs,
  ),
)
</script>

<template>
  <div class="h-full w-full">
    <component
      v-if="inspectorView"
      :is="inspectorView.component"
      v-bind="inspectorView.props"
    />
    <div v-else class="flex items-center justify-center h-full text-sm text-muted-foreground">
      Выберите документ для просмотра инспектора
    </div>
  </div>
</template>
