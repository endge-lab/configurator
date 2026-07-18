<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorPanel } from '@/features/endge-admin-ui-editor/types'

import {
  Braces,
  FileCode2,
  LayoutGrid,
  MonitorPlay,
  PanelsTopLeft,
} from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const isGridOverlayEnabled = computed(() => props.state.showGridOverlay)
const isVisualPanelVisible = computed(() => props.state.isPanelVisible('visual'))
const panelToggles: Array<{
  id: UIEditorPanel
  label: string
  icon: typeof PanelsTopLeft
}> = [
  { id: 'visual', label: 'Визуальный UI-редактор', icon: PanelsTopLeft },
  { id: 'source', label: 'SFC Source', icon: FileCode2 },
  { id: 'preview', label: 'Runtime Preview', icon: MonitorPlay },
]

function logAst(): void {
  props.state.logTree()
}
</script>

<template>
  <div class="pointer-events-none absolute right-3 top-1 z-20 flex items-center justify-end gap-2">
    <TooltipProvider :delay-duration="120">
      <div
        role="group"
        aria-label="Видимые панели UI-редактора"
        class="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/92 p-1 shadow-[0_14px_40px_rgba(15,23,42,0.10)] backdrop-blur"
      >
        <Tooltip
          v-for="panel in panelToggles"
          :key="panel.id"
        >
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-md"
              :class="props.state.isPanelVisible(panel.id) ? 'bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:text-background' : 'text-muted-foreground hover:text-foreground'"
              :aria-label="panel.label"
              :aria-pressed="props.state.isPanelVisible(panel.id)"
              :disabled="props.state.isPanelVisible(panel.id) && props.state.activePanels.length === 1"
              @click="props.state.togglePanel(panel.id)"
            >
              <component :is="panel.icon" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ panel.label }}</TooltipContent>
        </Tooltip>
      </div>

      <div class="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/92 p-1 shadow-[0_14px_40px_rgba(15,23,42,0.10)] backdrop-blur">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-md"
              @click="logAst"
            >
              <Braces class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Вывести AST в консоль</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-md"
              :class="isGridOverlayEnabled ? 'bg-sky-100 text-sky-700 hover:bg-sky-100 hover:text-sky-700 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-950 dark:hover:text-sky-300' : ''"
              :disabled="!isVisualPanelVisible"
              @click="props.state.toggleGridOverlay()"
            >
              <LayoutGrid class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isGridOverlayEnabled ? 'Скрыть постоянную сетку' : 'Всегда показывать сетку' }}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>
