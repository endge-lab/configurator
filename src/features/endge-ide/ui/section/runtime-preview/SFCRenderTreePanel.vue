<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { SFCRenderInspectionTreeNode } from '@endge/core'

import { ListTree, PinOff, X } from 'lucide-vue-next'

import SFCRenderTreeNode from './SFCRenderTreeNode.vue'

defineProps<{
  roots: SFCRenderInspectionTreeNode[]
  activeId: string | null
  pinnedId: string | null
}>()
const emit = defineEmits<{
  close: []
  select: [id: string]
  hover: [id: string]
  leave: []
  unpin: []
}>()
</script>

<template>
  <aside class="sfc-tree-panel" @mouseleave="emit('leave')">
    <header class="sfc-tree-panel__header">
      <ListTree class="size-3.5 text-sky-400" />
      <span>SFC hierarchy</span>
      <span class="sfc-tree-panel__count">{{ roots.length }}</span>
      <button v-if="pinnedId" type="button" title="Снять фиксацию" @click="emit('unpin')">
        <PinOff class="size-3.5" />
      </button>
      <button type="button" title="Закрыть дерево" @click="emit('close')">
        <X class="size-3.5" />
      </button>
    </header>

    <div v-if="roots.length" class="sfc-tree-panel__body">
      <ul class="m-0 list-none p-0">
        <SFCRenderTreeNode
          v-for="node in roots"
          :key="node.id"
          :node="node"
          :active-id="activeId"
          :pinned-id="pinnedId"
          @select="emit('select', $event)"
          @hover="emit('hover', $event)"
        />
      </ul>
    </div>
    <div v-else class="sfc-tree-panel__empty">
      <ListTree class="size-7 opacity-35" />
      <span>Tree will appear after the SFC render pass.</span>
    </div>
  </aside>
</template>

<style scoped>
.sfc-tree-panel {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(2 6 23);
  color: rgb(203 213 225);
}

.sfc-tree-panel__header {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px 0 10px;
  border-bottom: 1px solid rgb(51 65 85 / 0.72);
  color: rgb(203 213 225);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.sfc-tree-panel__header button {
  width: 25px;
  height: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgb(100 116 139);
}

.sfc-tree-panel__header button:hover { background: rgb(30 41 59); color: rgb(226 232 240); }
.sfc-tree-panel__count { flex: 1; color: rgb(100 116 139); font: 10px ui-monospace, monospace; }
.sfc-tree-panel__body { min-height: 0; flex: 1; overflow: auto; padding: 5px 0 12px; }
.sfc-tree-panel__empty {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 24px;
  color: rgb(100 116 139);
  font-size: 11px;
  text-align: center;
}
</style>
