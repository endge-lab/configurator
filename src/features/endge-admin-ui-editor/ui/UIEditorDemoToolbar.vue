<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorBreakpoint, UIEditorWorkspaceMode } from '@/features/endge-admin-ui-editor/types'

import {
  Braces,
  Columns2,
  Eye,
  FileCode2,
  LayoutGrid,
  Monitor,
  MonitorSmartphone,
  PanelsTopLeft,
  Smartphone,
  Tablet,
} from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { UI_EDITOR_BREAKPOINTS } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const isPreviewMode = computed(() => props.state.canvasMode === 'preview')
const isGridOverlayEnabled = computed(() => props.state.showGridOverlay)
const activeBreakpoint = computed(() => UI_EDITOR_BREAKPOINTS.find(item => item.id === props.state.activeBreakpoint) ?? UI_EDITOR_BREAKPOINTS[0]!)
const workspaceModes: Array<{
  id: UIEditorWorkspaceMode
  label: string
  icon: typeof PanelsTopLeft
}> = [
  { id: 'visual', label: 'Только визуальный редактор', icon: PanelsTopLeft },
  { id: 'split', label: 'Визуальный редактор и SFC source', icon: Columns2 },
  { id: 'source', label: 'Только SFC source', icon: FileCode2 },
]

function togglePreview(): void {
  props.state.setCanvasMode(isPreviewMode.value ? 'editor' : 'preview')
}

function logAst(): void {
  props.state.logTree()
}

function getBreakpointIcon(breakpointId: UIEditorBreakpoint) {
  if (breakpointId === 'desktop') {
    return Monitor
  }
  if (breakpointId === 'tablet') {
    return Tablet
  }
  return Smartphone
}
</script>

<template>
  <div class="pointer-events-none absolute right-3 top-1 z-20 flex items-center justify-end gap-2">
    <TooltipProvider :delay-duration="120">
      <div
        role="group"
        aria-label="Режим отображения редактора"
        class="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/92 p-1 shadow-[0_14px_40px_rgba(15,23,42,0.10)] backdrop-blur"
      >
        <Tooltip
          v-for="mode in workspaceModes"
          :key="mode.id"
        >
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-md"
              :class="props.state.workspaceMode === mode.id ? 'bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:text-background' : 'text-muted-foreground hover:text-foreground'"
              :aria-label="mode.label"
              :aria-pressed="props.state.workspaceMode === mode.id"
              @click="props.state.setWorkspaceMode(mode.id)"
            >
              <component :is="mode.icon" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ mode.label }}</TooltipContent>
        </Tooltip>
      </div>

      <div class="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/92 p-1 shadow-[0_14px_40px_rgba(15,23,42,0.10)] backdrop-blur">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-md"
              :class="isPreviewMode ? 'bg-sky-600 text-white hover:bg-sky-600 hover:text-white' : ''"
              @click="togglePreview"
            >
              <Eye class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ isPreviewMode ? 'Вернуться в редактор' : 'Запустить превью' }}
          </TooltipContent>
        </Tooltip>

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
              @click="props.state.toggleGridOverlay()"
            >
              <LayoutGrid class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isGridOverlayEnabled ? 'Скрыть постоянную сетку' : 'Всегда показывать сетку' }}</TooltipContent>
        </Tooltip>

        <div class="mx-1 h-5 w-px bg-border/80" />

        <Tooltip>
          <TooltipTrigger as-child>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8 rounded-md">
                    <component :is="getBreakpointIcon(activeBreakpoint.id)" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" class="min-w-36">
                  <DropdownMenuItem
                    v-for="breakpoint in UI_EDITOR_BREAKPOINTS"
                    :key="breakpoint.id"
                    class="gap-2"
                    @click="props.state.setBreakpoint(breakpoint.id)"
                  >
                    <component :is="getBreakpointIcon(breakpoint.id)" class="size-4" />
                    <span class="flex-1">{{ breakpoint.label }}</span>
                    <MonitorSmartphone v-if="props.state.activeBreakpoint === breakpoint.id" class="size-3.5 text-sky-600 dark:text-sky-400" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent>Выбрать viewport</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>
