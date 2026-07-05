<script setup lang="ts">
import { Endge } from '@endge/core'
import { Download, PanelTopClose } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'

import { showWidget } from '@/components/layouts/grid'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { pulseActiveTab, pulseSelectedHost, startPulseRuntimeSync, stopPulseRuntimeSync } from '@/features/endge-ide/model/pulse/pulse.mock.ts'
import PulseDetailsPanel from '@/features/endge-ide/ui/section/pulse/PulseDetailsPanel.vue'
import PulseDiagnosticsPanel from '@/features/endge-ide/ui/section/pulse/PulseDiagnosticsPanel.vue'
import PulseOverviewPanel from '@/features/endge-ide/ui/section/pulse/PulseOverviewPanel.vue'

function moveToWidget(): void {
  EndgeIDE.tabs.closeTab('pulse')
  showWidget('pulse')
}

function downloadSnapshot(): void {
  try {
    const snapshot = Endge.runtime.snapshot()
    const now = new Date()
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '')
    const filename = `endge-runtime-snapshot-${timestamp}.json`
    const content = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Snapshot скачан', {
      description: filename,
    })
  }
  catch (e) {
    toast.error('Не удалось скачать snapshot', {
      description: String(e),
    })
  }
}

const hasDetails = computed(() => pulseSelectedHost.value != null)

watch(hasDetails, (value) => {
  if (!value && pulseActiveTab.value === 'details')
    pulseActiveTab.value = 'overview'
}, { immediate: true })

const isOverview = computed(() => pulseActiveTab.value === 'overview')
const isDetails = computed(() => pulseActiveTab.value === 'details')
const isDiagnostics = computed(() => pulseActiveTab.value === 'diagnostics')

onMounted(() => {
  startPulseRuntimeSync()
})

onUnmounted(() => {
  stopPulseRuntimeSync()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-2 border-b px-3 py-2 shrink-0">
      <Button
        size="sm"
        variant="outline"
        :class="{ 'bg-primary text-primary-foreground border-primary': isOverview }"
        @click="pulseActiveTab = 'overview'"
      >
        Обзор
      </Button>
      <Button
        v-if="hasDetails"
        size="sm"
        variant="outline"
        :class="{ 'bg-primary text-primary-foreground border-primary': isDetails }"
        @click="pulseActiveTab = 'details'"
      >
        Детали
      </Button>
      <Button
        size="sm"
        variant="outline"
        :class="{ 'bg-primary text-primary-foreground border-primary': isDiagnostics }"
        @click="pulseActiveTab = 'diagnostics'"
      >
        Логи / Трейсы
      </Button>

      <div class="ml-auto flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8"
                @click="downloadSnapshot"
              >
                <Download class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Скачать полный snapshot
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          title="Показать в виджете"
          @click="moveToWidget"
        >
          <PanelTopClose class="size-4" />
        </Button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <ScrollArea v-if="isOverview" class="h-full">
        <PulseOverviewPanel />
      </ScrollArea>
      <ScrollArea v-else-if="isDetails" class="h-full">
        <PulseDetailsPanel />
      </ScrollArea>
      <ScrollArea v-else-if="isDiagnostics" class="h-full">
        <PulseDiagnosticsPanel />
      </ScrollArea>
    </div>
  </div>
</template>
