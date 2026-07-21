<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { SFCRenderInspectionTreeNode } from '@endge/core'

import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

defineOptions({ name: 'SFCRenderTreeNode' })

const props = defineProps<{
  node: SFCRenderInspectionTreeNode
  activeId: string | null
  pinnedId: string | null
  depth?: number
}>()
const emit = defineEmits<{
  select: [id: string]
  hover: [id: string]
}>()

const expanded = ref((props.depth ?? 0) < 3)
const rowElement = ref<HTMLButtonElement | null>(null)
const hasChildren = computed(() => props.node.children.length > 0)
const label = computed(() => props.node.kind === 'component'
  ? props.node.componentIdentity
  : props.node.componentTag ?? props.node.tag)
const instanceLabel = computed(() => {
  const rowKey = props.node.locals.rowKey
  const columnKey = props.node.locals.columnKey
  if (rowKey != null || columnKey != null) { return `[row=${String(rowKey)}, col=${String(columnKey)}]` }
  if (props.node.meta?.iterationKey != null) { return `[key=${String(props.node.meta.iterationKey)}]` }
  return ''
})

watch(() => props.pinnedId, async (id) => {
  if (!id) { return }
  if (containsNode(props.node, id)) { expanded.value = true }
  if (props.node.id !== id) { return }
  await nextTick()
  rowElement.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  rowElement.value?.focus({ preventScroll: true })
}, { immediate: true })

function containsNode(node: SFCRenderInspectionTreeNode, id: string): boolean {
  return node.id === id || node.children.some(child => containsNode(child, id))
}
</script>

<template>
  <li class="sfc-tree-node">
    <button
      ref="rowElement"
      type="button"
      class="sfc-tree-node__row"
      :class="{
        'sfc-tree-node__row--active': activeId === node.id,
        'sfc-tree-node__row--pinned': pinnedId === node.id,
      }"
      :style="{ paddingLeft: `${8 + (depth ?? 0) * 14}px` }"
      @mouseenter="emit('hover', node.id)"
      @click="emit('select', node.id)"
    >
      <span
        class="sfc-tree-node__chevron"
        @click.stop="hasChildren && (expanded = !expanded)"
      >
        <ChevronDown v-if="hasChildren && expanded" class="size-3" />
        <ChevronRight v-else-if="hasChildren" class="size-3" />
      </span>
      <span class="sfc-tree-node__bracket">&lt;</span>
      <span class="sfc-tree-node__tag">{{ label }}</span>
      <span v-if="node.meta?.definition" class="sfc-tree-node__badge">template</span>
      <span v-if="instanceLabel" class="sfc-tree-node__instance">{{ instanceLabel }}</span>
      <span class="sfc-tree-node__bracket">&gt;</span>
    </button>

    <ul v-if="hasChildren && expanded" class="m-0 list-none p-0">
      <SFCRenderTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :active-id="activeId"
        :pinned-id="pinnedId"
        :depth="(depth ?? 0) + 1"
        @select="emit('select', $event)"
        @hover="emit('hover', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.sfc-tree-node__row {
  width: 100%;
  min-height: 25px;
  display: flex;
  align-items: center;
  gap: 3px;
  border: 0;
  background: transparent;
  color: rgb(148 163 184);
  font: 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-align: left;
  white-space: nowrap;
  cursor: default;
}

.sfc-tree-node__row:hover,
.sfc-tree-node__row:focus-visible,
.sfc-tree-node__row--active {
  background: rgb(30 41 59 / 0.72);
}

.sfc-tree-node__row:focus-visible {
  outline: 1px solid rgb(56 189 248 / 0.8);
  outline-offset: -1px;
}

.sfc-tree-node__row--pinned {
  box-shadow: inset 2px 0 rgb(56 189 248);
  background: rgb(14 116 144 / 0.18);
}

.sfc-tree-node__chevron {
  width: 13px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(100 116 139);
  cursor: pointer;
}

.sfc-tree-node__tag { color: rgb(125 211 252); }
.sfc-tree-node__bracket { color: rgb(71 85 105); }
.sfc-tree-node__instance { color: rgb(167 139 250); }
.sfc-tree-node__badge {
  margin-left: 3px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgb(51 65 85 / 0.8);
  color: rgb(148 163 184);
  font-size: 9px;
}
</style>
