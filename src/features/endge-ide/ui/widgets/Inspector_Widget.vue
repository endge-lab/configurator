<script setup lang="ts">
import { computed } from 'vue'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const inspectorView = computed(() =>
  EndgeIDE.inspector.getViewForTab(
    EndgeIDE.tabs.activeTab.value,
    EndgeIDE.tabs,
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
