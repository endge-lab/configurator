<script setup lang="ts">
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorBreakpoint } from '@/features/endge-admin-ui-editor/types'

import { Braces, Eye, FileCode2, LayoutGrid, Monitor, MonitorSmartphone, Smartphone, Tablet } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
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

const jsxDialogOpen = ref(false)
const generatedJsx = computed(() => props.state.toJsx())
const isPreviewMode = computed(() => props.state.canvasMode === 'preview')
const isGridOverlayEnabled = computed(() => props.state.showGridOverlay)
const activeBreakpoint = computed(() => UI_EDITOR_BREAKPOINTS.find(item => item.id === props.state.activeBreakpoint) ?? UI_EDITOR_BREAKPOINTS[0])

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
  <div class="pointer-events-none absolute right-3 top-1 z-20 flex items-center justify-end">
    <TooltipProvider :delay-duration="120">
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
              @click="jsxDialogOpen = true"
            >
              <FileCode2 class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Показать сгенерированный JSX</TooltipContent>
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
              :class="isGridOverlayEnabled ? 'bg-sky-100 text-sky-700 hover:bg-sky-100 hover:text-sky-700' : ''"
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
                    <MonitorSmartphone v-if="props.state.activeBreakpoint === breakpoint.id" class="size-3.5 text-sky-600" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent>Выбрать viewport</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>

    <Dialog v-model:open="jsxDialogOpen">
      <DialogContent class="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Сгенерированный JSX</DialogTitle>
        </DialogHeader>
        <Textarea
          readonly
          :model-value="generatedJsx"
          class="min-h-[60vh] font-mono text-[12px] leading-6"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
