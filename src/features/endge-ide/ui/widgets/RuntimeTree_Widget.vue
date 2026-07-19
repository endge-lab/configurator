<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Pause, Play, RefreshCw, Square, Trash2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import RuntimeTreeNode from '@/features/endge-ide/ui/widgets/components/RuntimeTreeNode.vue'

interface RuntimeContextMenu {
  entryKey: string
  node: RuntimePreviewTreeNode
  x: number
  y: number
}

const preview = EndgeIDE.runtimePreview
const contextMenu = ref<RuntimeContextMenu | null>(null)
const busy = ref(false)
const hasEntries = computed(() => preview.entries.value.length > 0)
const hasStartableEntries = computed(() => preview.entries.value.some(entry => ['inactive', 'paused', 'stopped', 'error'].includes(entry.status.value)))
const hasActiveEntries = computed(() => preview.entries.value.some(entry => entry.status.value === 'active'))
const hasRunningEntries = computed(() => preview.entries.value.some(entry => ['active', 'paused', 'preparing', 'error'].includes(entry.status.value)))
const menuState = computed(() => {
  const menu = contextMenu.value
  return menu ? preview.lifecycleState(menu.entryKey, menu.node) : 'inactive'
})
const isRootMenu = computed(() => contextMenu.value?.node.parentId == null)
const canRunMenu = computed(() => {
  const menu = contextMenu.value
  if (!menu || menu.node.parentId == null) { return true }
  const rootState = preview.get(menu.entryKey)?.status.value
  return rootState !== 'stopped'
    && rootState !== 'error'
    && rootState !== 'preparing'
    && rootState !== 'disposed'
})
const menuStyle = computed(() => ({
  left: `${Math.min(contextMenu.value?.x ?? 0, Math.max(8, window.innerWidth - 210))}px`,
  top: `${Math.min(contextMenu.value?.y ?? 0, Math.max(8, window.innerHeight - 230))}px`,
}))

function openContextMenu(payload: RuntimeContextMenu): void {
  if (payload.node.kind === 'resource') { return }
  contextMenu.value = payload
  document.addEventListener('mousedown', closeFromOutside, { once: true })
  document.addEventListener('keydown', closeFromEscape)
}

function closeContextMenu(): void {
  contextMenu.value = null
  document.removeEventListener('mousedown', closeFromOutside)
  document.removeEventListener('keydown', closeFromEscape)
}

function closeFromOutside(event: MouseEvent): void {
  const element = event.target as HTMLElement | null
  if (!element?.closest('[data-runtime-preview-context-menu]')) { closeContextMenu() }
}

function closeFromEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !contextMenu.value) { return }
  event.preventDefault()
  event.stopPropagation()
  closeContextMenu()
}

async function run(operation: (menu: RuntimeContextMenu) => Promise<void>): Promise<void> {
  const menu = contextMenu.value
  if (!menu || busy.value) { return }
  busy.value = true
  closeContextMenu()
  try { await operation(menu) }
  catch (error) {
    toast.error('Не удалось изменить состояние Runtime', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
  finally { busy.value = false }
}

async function runAll(operation: () => Promise<void>): Promise<void> {
  if (busy.value) { return }
  busy.value = true
  closeContextMenu()
  try { await operation() }
  catch (error) {
    toast.error('Не удалось изменить состояние Runtime', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
  finally { busy.value = false }
}

function pause(menu: RuntimeContextMenu): Promise<void> {
  return menu.node.parentId == null
    ? preview.pause(menu.entryKey)
    : preview.pauseNode(menu.entryKey, menu.node.id)
}

function resume(menu: RuntimeContextMenu): Promise<void> {
  return menu.node.parentId == null
    ? preview.resume(menu.entryKey)
    : preview.resumeNode(menu.entryKey, menu.node.id)
}

function stop(menu: RuntimeContextMenu): Promise<void> {
  return menu.node.parentId == null
    ? preview.stop(menu.entryKey)
    : preview.stopNode(menu.entryKey, menu.node.id)
}

function restart(menu: RuntimeContextMenu): Promise<void> {
  return menu.node.parentId == null
    ? preview.restart(menu.entryKey)
    : preview.restartNode(menu.entryKey, menu.node.id)
}

onBeforeUnmount(closeContextMenu)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-9 shrink-0 items-center justify-end border-b px-1.5">
      <TooltipProvider :delay-duration="150">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
              aria-label="Запустить все Runtime"
              :disabled="busy || !hasStartableEntries"
              @click="runAll(() => preview.startAll())"
            >
              <Play class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Запустить все
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              aria-label="Поставить все Runtime на паузу"
              :disabled="busy || !hasActiveEntries"
              @click="runAll(() => preview.pauseAll())"
            >
              <Pause class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Пауза всех
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              aria-label="Остановить все Runtime"
              :disabled="busy || !hasRunningEntries"
              @click="runAll(() => preview.stopAll())"
            >
              <Square class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Остановить все
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Удалить все из Runtime Tree"
              :disabled="busy || !hasEntries"
              @click="runAll(() => preview.removeAll())"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Удалить все
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="min-h-0 flex-1 overflow-auto py-1.5">
      <template v-for="entry in preview.entries.value" :key="entry.key">
        <RuntimeTreeNode
          v-for="node in entry.tree.value"
          :key="node.id"
          :entry-key="entry.key"
          :node="node"
          :depth="0"
          @contextmenu="openContextMenu"
        />
      </template>

      <div
        v-if="!preview.entries.value.length"
        class="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-10 text-center text-xs text-muted-foreground"
      >
        <Square class="size-6 opacity-35" stroke-width="1.4" />
        <span>Runtime Tree пуст.</span>
        <span class="max-w-52 text-[10px] leading-4 opacity-75">Запустите документ кнопкой Debug Preview в его редакторе.</span>
      </div>
    </div>

    <div class="shrink-0 border-t px-3 py-2 text-[10px] leading-4 text-muted-foreground">
      Выбор manual-узла запускает его. Остальные runtime instances продолжают работать независимо.
    </div>

    <div
      v-if="contextMenu"
      data-runtime-preview-context-menu
      class="fixed z-[240] min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
      :style="menuStyle"
      @mousedown.stop
      @contextmenu.prevent
    >
      <button
        v-if="menuState === 'active'"
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
        @click="run(pause)"
      >
        <Pause class="size-3.5" />
        Поставить на паузу
      </button>
      <button
        v-else-if="menuState === 'paused'"
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
        @click="run(resume)"
      >
        <Play class="size-3.5" />
        Продолжить
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-45"
        :disabled="menuState === 'stopped' || menuState === 'disposed' || menuState === 'inactive'"
        @click="run(stop)"
      >
        <Square class="size-3.5" />
        Остановить
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
        :disabled="!canRunMenu"
        @click="run(restart)"
      >
        <RefreshCw class="size-3.5" />
        Перезапустить
      </button>
      <template v-if="isRootMenu">
        <div class="my-1 h-px bg-border" />
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
          @click="run(menu => preview.remove(menu.entryKey))"
        >
          <Trash2 class="size-3.5" />
          Удалить из Runtime Tree
        </button>
      </template>
    </div>
  </div>
</template>
