<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  UIEditorLibraryGroup,
  UIEditorLibraryItem,
} from '@/features/endge-admin-ui-editor/types'

import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Layout,
  Rows3,
  Search,
  SquareStack,
  Type,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UI_EDITOR_DND_MIME, uiEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import { buildUIEditorLibraryGroups } from '@/features/endge-admin-ui-editor/entities/ui-editor-library-catalog'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const UI_EDITOR_LIBRARY_EXPANDED_GROUPS_LS_KEY = 'endge-admin-ui-editor-library-expanded-groups'
const EXPAND_ALL_LABEL = 'Развернуть все блоки'
const COLLAPSE_ALL_LABEL = 'Свернуть все блоки'

const query = ref('')
const expandedGroupKeys = useSafeLocalStorage<Record<string, boolean>>(
  UI_EDITOR_LIBRARY_EXPANDED_GROUPS_LS_KEY,
  {},
)
const hasActiveQuery = computed(() => query.value.trim().length > 0)

function filterGroups(groups: UIEditorLibraryGroup[]): UIEditorLibraryGroup[] {
  const needle = query.value.trim().toLowerCase()
  return groups
    .map(group => ({
      ...group,
      items: !needle
        ? group.items
        : group.items.filter(item =>
            item.label.toLowerCase().includes(needle)
            || item.description.toLowerCase().includes(needle)
            || item.id.toLowerCase().includes(needle)
            || item.keywords?.some(keyword => keyword.toLowerCase().includes(needle)) === true,
          ),
    }))
    .filter(group => group.items.length > 0)
}

const expandedGroupIds = computed<Set<string>>({
  get(): Set<string> {
    const next = new Set<string>()
    for (const [key, value] of Object.entries(expandedGroupKeys.value)) {
      if (value) {
        next.add(key)
      }
    }
    return next
  },
  set(next: Set<string>) {
    const serialized: Record<string, boolean> = {}
    for (const groupId of next) {
      serialized[groupId] = true
    }
    expandedGroupKeys.value = serialized
  },
})

const baseGroups = computed<UIEditorLibraryGroup[]>(() => filterGroups(buildUIEditorLibraryGroups()))

const allGroupIds = computed<string[]>(() => buildUIEditorLibraryGroups().map(group => group.id))

const isEverythingExpanded = computed<boolean>(() =>
  allGroupIds.value.every(groupId => expandedGroupIds.value.has(groupId)),
)

const toggleAllLabel = computed<string>(() =>
  isEverythingExpanded.value ? COLLAPSE_ALL_LABEL : EXPAND_ALL_LABEL,
)

function isExpanded(groupId: string): boolean {
  return hasActiveQuery.value || expandedGroupIds.value.has(groupId)
}

function toggleGroup(groupId: string): void {
  const next = new Set(expandedGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  }
  else {
    next.add(groupId)
  }
  expandedGroupIds.value = next
}

function expandAll(): void {
  expandedGroupIds.value = new Set(allGroupIds.value)
}

function collapseAll(): void {
  expandedGroupIds.value = new Set()
}

function toggleAll(): void {
  if (isEverythingExpanded.value) {
    collapseAll()
    return
  }
  expandAll()
}

function createTransparentDragImage(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas
}

function onDragstart(event: DragEvent, item: UIEditorLibraryItem): void {
  const payload = {
    source: 'palette' as const,
    paletteSource: item.source,
    definitionRef: item.definitionRef,
    kind: item.kind,
    label: item.label,
    itemId: item.id,
    sourceLabel: item.sourceLabel ?? item.label,
    configRef: item.configRef ?? undefined,
    assetRef: item.assetRef ?? undefined,
    propsPatch: item.propsPatch,
    layoutPatch: item.layoutPatch,
  }

  uiEditorDemoState.beginGridDrag(payload)
  event.dataTransfer?.setData(UI_EDITOR_DND_MIME, JSON.stringify(payload))
  event.dataTransfer?.setData('text/plain', item.label)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setDragImage(createTransparentDragImage(), 0, 0)
  }
}

function onDragend(): void {
  uiEditorDemoState.endGridInteraction()
}

function getGroupIcon(groupId: string) {
  if (groupId === 'layout') {
    return Layout
  }
  if (groupId === 'content') {
    return Type
  }
  return Layout
}

function getItemIcon(item: UIEditorLibraryItem) {
  if (item.kind === 'flex') {
    return Rows3
  }
  if (item.kind === 'box') {
    return SquareStack
  }
  return Type
}

function rowClasses(): string {
  return 'flex items-center gap-1 rounded px-1 py-0.5 text-sm select-none transition hover:bg-primary/25'
}

function itemRowClasses(): string {
  return 'flex w-full cursor-grab items-center gap-1 rounded px-1 py-0.5 text-left text-sm select-none transition hover:bg-primary/25 active:cursor-grabbing'
}

function filterRowClasses(): string {
  return 'relative rounded-md border border-border/60 bg-background/70'
}

function getItemTitle(item: UIEditorLibraryItem): string {
  const parts = [item.label]
  if (item.description) {
    parts.push(item.description)
  }
  return parts.join('\n')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-border/70 px-2 py-2">
      <div class="flex items-center gap-1.5">
        <div :class="filterRowClasses()" class="min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            class="h-8 border-0 bg-transparent pl-7 shadow-none focus-visible:ring-0"
            placeholder="Фильтр по SFC primitives"
          />
        </div>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="toggleAll">
              <ChevronsUp v-if="isEverythingExpanded" class="size-3.5" />
              <ChevronsDown v-else class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ toggleAllLabel }}</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <ScrollArea class="h-full flex-1">
      <div class="p-2 text-sm">
        <div class="mb-3">
          <div class="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            SFC primitives
          </div>

          <div
            v-for="group in baseGroups"
            :key="group.id"
            class="mb-1 last:mb-0"
          >
            <button
              type="button"
              :class="rowClasses()"
              class="w-full text-left"
              @click="toggleGroup(group.id)"
            >
              <ChevronDown v-if="isExpanded(group.id)" class="size-4 shrink-0" />
              <ChevronRight v-else class="size-4 shrink-0" />
              <component :is="getGroupIcon(group.id)" class="size-4 shrink-0 text-emerald-500" />
              <span class="truncate">
                {{ group.title }}
              </span>
            </button>

            <div v-if="isExpanded(group.id)" class="mt-1 space-y-1">
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                draggable="true"
                :class="itemRowClasses()"
                :title="getItemTitle(item)"
                @dragstart="onDragstart($event, item)"
                @dragend="onDragend"
              >
                <span class="ml-5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm" :class="item.accentClass">
                  <component :is="getItemIcon(item)" class="size-3 text-slate-900 dark:text-slate-100" />
                </span>

                <span class="min-w-0 flex-1 truncate">
                  {{ item.label }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
