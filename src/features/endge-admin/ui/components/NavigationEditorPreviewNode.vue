<script setup lang="ts">
import type { NavigationTreeNodeEditor } from '@/features/endge-admin/domain/entities/RNavigationEditor'

const props = defineProps<{
  node: NavigationTreeNodeEditor
  openedIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'toggle', nodeId: string): void
}>()

function toggle(): void {
  emit('toggle', props.node.id)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="node.type === 'section'"
      class="px-1 pt-2 text-xs font-semibold uppercase text-muted-foreground"
    >
      {{ node.title || 'Без названия' }}
    </div>

    <button
      v-else-if="node.type === 'group'"
      type="button"
      class="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm"
      @click="toggle"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium leading-none">
          {{ node.title || 'Без названия' }}
        </span>
      </span>
      <span class="text-xs text-muted-foreground">
        {{ openedIds.has(node.id) ? 'открыть' : 'закрыть' }}
      </span>
    </button>

    <div
      v-else
      class="rounded-xl border bg-card px-3 py-2.5 shadow-sm"
    >
      <div class="truncate text-sm font-medium leading-none">
        {{ node.title || 'Без названия' }}
      </div>
    </div>

    <div
      v-if="node.type !== 'link' && openedIds.has(node.id)"
      :class="node.type === 'section' ? 'space-y-2' : 'ml-4 space-y-2 border-l border-border/70 pl-4'"
    >
      <NavigationEditorPreviewNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :opened-ids="openedIds"
        @toggle="(nodeId) => emit('toggle', nodeId)"
      />
    </div>
  </div>
</template>
