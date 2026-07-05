<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted } from 'vue'

import { getAreaActiveWidget, getWidget } from '@/components/layouts/grid'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { startPulseRuntimeSync, stopPulseRuntimeSync } from '@/features/endge-ide/model/pulse/pulse.mock.ts'
import PulseSidebar from '@/features/endge-ide/ui/section/pulse/PulseSidebar.vue'

const hasPulseTab = computed(() =>
  EndgeIDE.tabs.openTabs.value.some(tab => tab.id === 'pulse'),
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

  EndgeIDE.tabs.openPulseTab()
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
