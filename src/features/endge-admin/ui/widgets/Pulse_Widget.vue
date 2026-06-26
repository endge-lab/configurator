<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted } from 'vue'

import { getAreaActiveWidget, getWidget } from '@/components/layouts/grid'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import { startPulseRuntimeSync, stopPulseRuntimeSync } from '@/features/endge-admin/model/pulse/pulse.mock.ts'
import PulseSidebar from '@/features/endge-admin/ui/section/pulse/PulseSidebar.vue'

const hasPulseTab = computed(() =>
  EndgeAdmin.tabs.openTabs.value.some(tab => tab.id === 'pulse'),
)

function ensurePulseTabSynced(): void {
  if (hasPulseTab.value)
    return

  const widget = getWidget('pulse')
  const position = widget?.position

  if (position === 'left' || position === 'right' || position === 'bottom') {
    if (getAreaActiveWidget(position) !== 'pulse')
      return
  }

  EndgeAdmin.tabs.openPulseTab()
}

onMounted(() => {
  startPulseRuntimeSync()
  ensurePulseTabSynced()
})

onActivated(() => {
  ensurePulseTabSynced()
})

onUnmounted(() => {
  stopPulseRuntimeSync()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="min-h-0 flex-1 overflow-hidden">
      <PulseSidebar :open-in-tab-on-select="true" />
    </div>
  </div>
</template>
