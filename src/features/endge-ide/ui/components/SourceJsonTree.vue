<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import type { LazyJsonValueNode } from '@/features/endge-ide/model/json-tree/lazy-json-tree'

import { computed, provide, ref, watch } from 'vue'

import {
  DEFAULT_JSON_TREE_EAGER_LIMIT,
  DEFAULT_JSON_TREE_NODE_BUDGET,
  DEFAULT_JSON_TREE_PAGE_SIZE,
} from '@/features/endge-ide/model/json-tree/lazy-json-tree'
import { LazyJsonTreeControllerKey } from '@/features/endge-ide/model/json-tree/lazy-json-tree-controller'
import SourceJsonTreeNode from '@/features/endge-ide/ui/components/SourceJsonTreeNode.vue'

const props = withDefaults(defineProps<{
  data: unknown
  rootPath?: string
  deep?: number
  /** Kept for source compatibility; eagerLimit now owns collection paging. */
  collapsedNodeLength?: number
  eagerLimit?: number
  pageSize?: number
  maxMountedNodes?: number
}>(), {
  rootPath: 'root',
  deep: 2,
  collapsedNodeLength: 12,
  eagerLimit: DEFAULT_JSON_TREE_EAGER_LIMIT,
  pageSize: DEFAULT_JSON_TREE_PAGE_SIZE,
  maxMountedNodes: DEFAULT_JSON_TREE_NODE_BUDGET,
})

const allocatedNodes = ref(1)
const command = ref<'expand-visible' | 'collapse-all' | null>(null)
const commandRevision = ref(0)
const notice = ref<string | null>(null)
const eagerLimit = ref(normalizePositiveInteger(props.eagerLimit, DEFAULT_JSON_TREE_EAGER_LIMIT))
const pageSize = ref(normalizePositiveInteger(props.pageSize, DEFAULT_JSON_TREE_PAGE_SIZE))
const maxMountedNodes = ref(normalizePositiveInteger(props.maxMountedNodes, DEFAULT_JSON_TREE_NODE_BUDGET))

watch(() => props.eagerLimit, value => eagerLimit.value = normalizePositiveInteger(value, DEFAULT_JSON_TREE_EAGER_LIMIT))
watch(() => props.pageSize, value => pageSize.value = normalizePositiveInteger(value, DEFAULT_JSON_TREE_PAGE_SIZE))
watch(() => props.maxMountedNodes, value => maxMountedNodes.value = normalizePositiveInteger(value, DEFAULT_JSON_TREE_NODE_BUDGET))

provide(LazyJsonTreeControllerKey, {
  eagerLimit,
  pageSize,
  maxMountedNodes,
  allocatedNodes,
  command,
  commandRevision,
  notice,
})

const rootNode = computed<LazyJsonValueNode>(() => ({
  kind: 'value',
  key: props.rootPath,
  path: props.rootPath,
  value: normalizeRootValue(props.data),
  ancestors: [],
}))

function expandAll(): void {
  command.value = 'expand-visible'
  commandRevision.value += 1
}

function collapseAll(): void {
  command.value = 'collapse-all'
  commandRevision.value += 1
  notice.value = null
}

function normalizeRootValue(value: unknown): unknown {
  if (typeof value === 'symbol' || typeof value === 'function') { return String(value) }
  return value
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div class="source-json-tree">
    <SourceJsonTreeNode
      :node="rootNode"
      :depth="0"
      :initial-depth="Math.max(0, deep)"
    />
    <div v-if="notice" class="source-json-tree__notice" role="status">
      {{ notice }}
    </div>
  </div>
</template>

<style scoped>
.source-json-tree {
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  margin: 0;
  padding: 10px 0 16px;
  overflow: auto;
  color: #d8e1ee;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.55;
  scrollbar-gutter: stable;
}

.source-json-tree__notice {
  position: sticky;
  bottom: 0;
  margin: 8px 12px 0;
  padding: 7px 9px;
  border: 1px solid rgb(245 158 11 / 0.42);
  border-radius: 5px;
  background: rgb(69 26 3 / 0.94);
  color: #fde68a;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 10px;
  line-height: 1.4;
}
</style>
