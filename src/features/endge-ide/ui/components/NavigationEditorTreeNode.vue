<script setup lang="ts">
import type { NavigationTreeNodeEditor, NavigationTreeNodeType } from '@/features/endge-ide/domain/entities/RNavigationEditor'

import { ChevronDown, ChevronRight, FolderTree, Link2, Plus, PlusSquare } from 'lucide-vue-next'
import { ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  node: NavigationTreeNodeEditor
  collapsedGroupIds: Set<string>
  depth?: number
  selectedId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', nodeId: string): void
  (e: 'toggleGroup', nodeId: string): void
  (e: 'add-after', payload: { targetId: string, type: NavigationTreeNodeType }): void
  (e: 'add-child', payload: { targetId: string, type: NavigationTreeNodeType }): void
  (e: 'drag-start', nodeId: string): void
  (e: 'drag-end'): void
  (e: 'drop-node', payload: { targetId: string, position: DropPosition }): void
  (e: 'remove', nodeId: string): void
}>()

type DropPosition = 'before' | 'inside' | 'after'

const dropPosition = ref<DropPosition | null>(null)

function isCollapsed(nodeId: string): boolean {
  return props.collapsedGroupIds.has(nodeId)
}

function select(): void {
  if (props.node.type !== 'link') {
    emit('toggleGroup', props.node.id)
  }
  emit('select', props.node.id)
}

function fallbackTitle(type: NavigationTreeNodeType): string {
  if (type === 'section') { return 'Безымянная секция' }
  if (type === 'group') { return 'Безымянная группа' }
  return 'Безымянная ссылка'
}

function resolveDropPosition(event: DragEvent): DropPosition {
  const target = event.currentTarget as HTMLElement | null
  if (!target) { return 'after' }

  const rect = target.getBoundingClientRect()
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 1

  if (props.node.type === 'link') {
    return ratio < 0.5 ? 'before' : 'after'
  }

  if (ratio < 0.25) { return 'before' }
  if (ratio > 0.75) { return 'after' }
  return 'inside'
}

function onDragStart(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', props.node.id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
  emit('drag-start', props.node.id)
}

function onDragOver(event: DragEvent): void {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dropPosition.value = resolveDropPosition(event)
}

function onDrop(event: DragEvent): void {
  const position = dropPosition.value ?? resolveDropPosition(event)
  dropPosition.value = null
  emit('drop-node', { targetId: props.node.id, position })
}

function onDragEnd(): void {
  dropPosition.value = null
  emit('drag-end')
}

function clearDropPosition(): void {
  dropPosition.value = null
}

function dropClass(): string {
  if (dropPosition.value === 'inside') { return 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-300/70' }
  if (dropPosition.value === 'before') { return 'border-t-sky-500 border-t-4 bg-sky-500/5' }
  if (dropPosition.value === 'after') { return 'border-b-sky-500 border-b-4 bg-sky-500/5' }
  return ''
}
</script>

<template>
  <div class="space-y-2">
    <button
      type="button"
      draggable="true"
      class="group w-full rounded-xl border px-3 py-2 text-left transition"
      :class="[selectedId === node.id ? 'border-sky-500/50 bg-sky-500/10 shadow-sm' : 'border-border bg-background hover:border-sky-400/40 hover:bg-muted/30', dropClass()]"
      :style="{ marginLeft: `${(depth ?? 0) * 16}px` }"
      @dragstart.stop="onDragStart"
      @dragover.prevent.stop="onDragOver"
      @dragleave.stop="clearDropPosition"
      @drop.prevent.stop="onDrop"
      @dragend.stop="onDragEnd"
      @click="select"
    >
      <div class="flex items-center gap-2">
        <div class="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronRight
            v-if="node.type !== 'link' && isCollapsed(node.id)"
            class="size-3.5"
          />
          <ChevronDown
            v-else-if="node.type !== 'link'"
            class="size-3.5"
          />
        </div>

        <div
          class="flex size-7 shrink-0 items-center justify-center rounded-md"
          :class="node.type === 'section' ? 'bg-violet-500/10 text-violet-600' : node.type === 'group' ? 'bg-sky-500/10 text-sky-600' : 'bg-amber-500/10 text-amber-600'"
        >
          <FolderTree v-if="node.type !== 'link'" class="size-3.5" />
          <Link2 v-else class="size-3.5" />
        </div>

        <div class="min-w-0 flex-1 truncate text-sm font-medium leading-none">
          {{ node.title || fallbackTitle(node.type) }}
        </div>

        <TooltipProvider>
          <div class="flex shrink-0 items-center justify-end gap-0.5 opacity-70 transition group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button draggable="false" size="icon-sm" variant="ghost" @click.stop="emit('add-after', { targetId: node.id, type: 'group' })">
                  <PlusSquare class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Добавить соседнюю группу</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button draggable="false" size="icon-sm" variant="ghost" @click.stop="emit('add-after', { targetId: node.id, type: 'link' })">
                  <Plus class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Добавить соседнюю ссылку</TooltipContent>
            </Tooltip>

            <Tooltip v-if="node.type === 'section'">
              <TooltipTrigger as-child>
                <Button
                  draggable="false"
                  size="icon-sm"
                  variant="ghost"
                  @click.stop="emit('add-child', { targetId: node.id, type: 'group' })"
                >
                  <FolderTree class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Добавить дочернюю группу</TooltipContent>
            </Tooltip>

            <Tooltip v-if="node.type !== 'link'">
              <TooltipTrigger as-child>
                <Button
                  draggable="false"
                  size="icon-sm"
                  variant="ghost"
                  @click.stop="emit('add-child', { targetId: node.id, type: 'link' })"
                >
                  <Link2 class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Добавить дочернюю ссылку</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button draggable="false" size="icon-sm" variant="ghost" @click.stop="emit('remove', node.id)">
                  <span class="text-sm leading-none">×</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Удалить</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </button>

    <template v-if="node.type === 'link' || !isCollapsed(node.id)">
      <NavigationEditorTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :collapsed-group-ids="collapsedGroupIds"
        :depth="(depth ?? 0) + 1"
        :selected-id="selectedId"
        @select="(nodeId) => emit('select', nodeId)"
        @toggle-group="(nodeId) => emit('toggleGroup', nodeId)"
        @add-after="(payload) => emit('add-after', payload)"
        @add-child="(payload) => emit('add-child', payload)"
        @drag-start="(nodeId) => emit('drag-start', nodeId)"
        @drag-end="emit('drag-end')"
        @drop-node="(payload) => emit('drop-node', payload)"
        @remove="(nodeId) => emit('remove', nodeId)"
      />
    </template>
  </div>
</template>
