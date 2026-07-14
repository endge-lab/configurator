<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css'

import { computed, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'

type JsonTreeData = string | number | boolean | unknown[] | Record<string, unknown> | null

const props = withDefaults(defineProps<{
  data: unknown
  rootPath?: string
  deep?: number
  collapsedNodeLength?: number
}>(), {
  rootPath: 'root',
  deep: 2,
  collapsedNodeLength: 12,
})

const normalizedData = computed<JsonTreeData>(() => {
  if (props.data === undefined) {
    return 'undefined'
  }
  if (typeof props.data === 'bigint' || typeof props.data === 'symbol' || typeof props.data === 'function') {
    return String(props.data)
  }
  return props.data as JsonTreeData
})

const treeRevision = ref(0)
const treeMode = ref<'default' | 'expanded' | 'collapsed'>('default')
const treeDeep = computed(() => {
  if (treeMode.value === 'expanded') {
    return Number.POSITIVE_INFINITY
  }
  if (treeMode.value === 'collapsed') {
    return 0
  }
  return props.deep
})
const treeCollapsedNodeLength = computed(() => treeMode.value === 'expanded'
  ? Number.POSITIVE_INFINITY
  : props.collapsedNodeLength)

function setTreeMode(mode: 'expanded' | 'collapsed'): void {
  treeMode.value = mode
  treeRevision.value += 1
}

function expandAll(): void {
  setTreeMode('expanded')
}

function collapseAll(): void {
  setTreeMode('collapsed')
}

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <VueJsonPretty
    :key="treeRevision"
    class="source-json-tree"
    :data="normalizedData"
    :root-path="rootPath"
    :deep="treeDeep"
    :collapsed-node-length="treeCollapsedNodeLength"
    show-icon
    show-length
    show-line
    theme="dark"
  />
</template>

<style scoped>
.source-json-tree {
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  margin: 0;
  padding: 10px 12px 16px;
  overflow: auto;
  color: #d8e1ee;
  font-size: 11px;
  line-height: 1.55;
  scrollbar-gutter: stable;
}

.source-json-tree :deep(.vjs-tree-node) {
  min-height: 21px;
  line-height: 21px;
}

.source-json-tree :deep(.vjs-tree-node.dark:hover) {
  background: rgb(30 41 59 / 0.72);
}

.source-json-tree :deep(.vjs-tree-node .vjs-indent-unit.has-line) {
  border-left-color: rgb(71 85 105 / 0.55);
}

.source-json-tree :deep(.vjs-key) {
  color: #bfdbfe;
}

.source-json-tree :deep(.vjs-value-string) {
  color: #86efac;
}

.source-json-tree :deep(.vjs-value-number),
.source-json-tree :deep(.vjs-value-boolean) {
  color: #7dd3fc;
}

.source-json-tree :deep(.vjs-comment) {
  color: #64748b;
}
</style>
