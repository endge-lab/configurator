<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { Component } from 'vue'

import { Braces, ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'

import { getIconComponent } from '@/components/layouts/grid/icons'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { runtimeTreeNodeExpansionKey } from '@/features/endge-ide/model/runtime-preview/runtime-tree-view-state'
import RuntimeLifecycleStatusIcon from '@/features/endge-ide/ui/widgets/components/RuntimeLifecycleStatusIcon.vue'

defineOptions({ name: 'RuntimeTreeNode' })

const props = defineProps<{
  entryKey: string
  node: RuntimePreviewTreeNode
  depth?: number
  expandedNodeKeys: ReadonlySet<string>
}>()

const emit = defineEmits<{
  contextmenu: [payload: { entryKey: string, node: RuntimePreviewTreeNode, x: number, y: number }]
  toggleExpanded: [nodeKey: string, expanded: boolean]
}>()

const preview = EndgeIDE.runtimePreview
const nodeKey = computed(() => runtimeTreeNodeExpansionKey(props.entryKey, props.node.id))
const expanded = computed(() => props.expandedNodeKeys.has(nodeKey.value))
const selected = computed(() => preview.selectedEntryKey.value === props.entryKey
  && preview.selectedNode.value?.id === props.node.id)
const state = computed(() => preview.lifecycleState(props.entryKey, props.node))
const hasChildren = computed(() => props.node.children.length > 0)
const leftPadding = computed(() => `${Math.max(0, props.depth ?? 0) * 14 + 8}px`)
const nodeIcon = computed<Component>(() => getIconComponent(props.node.presentation?.icon) as Component ?? Braces)
const badgeIcon = computed<Component | null>(() => getIconComponent(props.node.presentation?.badgeIcon ?? undefined) as Component | null)
const iconColorClass = computed(() => props.node.presentation?.colorClass ?? 'text-muted-foreground')

function select(): void {
  void preview.select(props.entryKey, props.node.id)
}

function toggleExpanded(): void {
  if (hasChildren.value) {
    emit('toggleExpanded', nodeKey.value, !expanded.value)
  }
}

function forwardToggleExpanded(childNodeKey: string, childExpanded: boolean): void {
  emit('toggleExpanded', childNodeKey, childExpanded)
}

function openContextMenu(event: MouseEvent): void {
  emit('contextmenu', {
    entryKey: props.entryKey,
    node: props.node,
    x: event.clientX,
    y: event.clientY,
  })
}
</script>

<template>
  <div class="min-w-0" :class="(depth ?? 0) === 0 && 'border-b border-border/45 py-1 last:border-b-0'">
    <button
      type="button"
      class="group flex w-full min-w-0 items-center gap-1.5 border-l-2 pr-2 text-left text-xs transition-colors"
      :class="[
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted/65 hover:text-foreground',
        node.subtitle ? 'min-h-10 py-1' : 'h-8',
      ]"
      :style="{ paddingLeft: leftPadding }"
      @click="select"
      @contextmenu.prevent.stop="openContextMenu"
    >
      <span
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/5"
        @click.stop="toggleExpanded"
      >
        <ChevronRight
          v-if="hasChildren"
          class="size-3 transition-transform"
          :class="expanded && 'rotate-90'"
        />
      </span>
      <span class="relative size-3.5 shrink-0">
        <component :is="nodeIcon" class="size-3.5" :class="iconColorClass" stroke-width="1.8" />
        <component
          :is="badgeIcon"
          v-if="badgeIcon"
          class="absolute -bottom-1 -right-1 size-2 rounded-[2px] bg-background p-px"
          :class="iconColorClass"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col" :title="node.subtitle ?? node.title">
        <span class="truncate font-medium text-foreground">{{ node.title }}</span>
        <span v-if="node.subtitle" class="truncate text-[10px] leading-3 text-muted-foreground/75">
          {{ node.subtitle }}
        </span>
      </span>
      <span
        v-if="node.activationMode === 'manual'"
        class="shrink-0 rounded border px-1 py-px text-[9px] leading-3 text-muted-foreground/80"
      >
        manual
      </span>
      <RuntimeLifecycleStatusIcon :state="state" />
    </button>

    <div v-if="expanded && hasChildren">
      <RuntimeTreeNode
        v-for="child in node.children"
        :key="child.id"
        :entry-key="entryKey"
        :node="child"
        :depth="(depth ?? 0) + 1"
        :expanded-node-keys="expandedNodeKeys"
        @contextmenu="emit('contextmenu', $event)"
        @toggle-expanded="forwardToggleExpanded"
      />
    </div>
  </div>
</template>
