<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import type { LazyJsonNodeDescriptor } from '@/features/endge-ide/model/json-tree/lazy-json-tree'

import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  createLazyJsonChildren,
  formatLazyJsonScalar,
  isLazyJsonContainer,
  lazyJsonNodeSummary,
  lazyJsonNodeValue,
  lazyJsonValueTone,
  shouldAutoExpandLazyJsonNode,
} from '@/features/endge-ide/model/json-tree/lazy-json-tree'
import { LazyJsonTreeControllerKey } from '@/features/endge-ide/model/json-tree/lazy-json-tree-controller'

defineOptions({ name: 'SourceJsonTreeNode' })

const props = defineProps<{
  node: LazyJsonNodeDescriptor
  depth: number
  initialDepth: number
}>()

const controller = inject(LazyJsonTreeControllerKey)
if (!controller) { throw new Error('[SourceJsonTreeNode] Lazy tree controller is missing.') }

const value = computed(() => lazyJsonNodeValue(props.node))
const circular = computed(() => props.node.kind === 'value'
  && isLazyJsonContainer(props.node.value)
  && props.node.ancestors.includes(props.node.value))
const container = computed(() => !circular.value && (props.node.kind === 'range' || isLazyJsonContainer(value.value)))
const expanded = ref(false)
const reservedChildren = ref(0)
const children = computed(() => expanded.value
  ? createLazyJsonChildren(props.node, {
      eagerLimit: controller.eagerLimit.value,
      pageSize: controller.pageSize.value,
    })
  : [])
const summary = computed(() => circular.value ? '[Circular]' : lazyJsonNodeSummary(props.node))
const scalarTone = computed(() => lazyJsonValueTone(value.value))
const scalarValue = computed(() => circular.value ? '[Circular]' : formatLazyJsonScalar(value.value))
const keyLabel = computed(() => props.node.kind === 'range'
  ? props.node.key
  : props.depth === 0 || /^\d+$/.test(props.node.key)
    ? props.node.key
    : JSON.stringify(props.node.key))

watch(
  controller.commandRevision,
  () => {
    if (controller.command.value === 'collapse-all') {
      releaseChildren()
      expanded.value = false
      return
    }
    if (controller.command.value === 'expand-visible' && container.value) { expandWithinBudget() }
  },
)

watch(container, (isContainer) => {
  if (!isContainer) {
    releaseChildren()
    expanded.value = false
  }
})

watch(
  [() => props.node, controller.eagerLimit, controller.pageSize],
  () => reconcileReservation(),
)

onMounted(() => {
  if (container.value && shouldAutoExpandLazyJsonNode(props.node, props.depth, props.initialDepth)) {
    expandWithinBudget()
  }
})

onBeforeUnmount(() => {
  releaseChildren()
})

function toggle(): void {
  if (!container.value) { return }
  if (expanded.value) {
    releaseChildren()
    expanded.value = false
    controller.notice.value = null
    return
  }
  expandWithinBudget()
}

function expandWithinBudget(): void {
  if (expanded.value) { return }
  const nextCount = plannedChildCount()
  if (controller.allocatedNodes.value + nextCount > controller.maxMountedNodes.value) {
    controller.notice.value = `Node budget ${controller.maxMountedNodes.value} reached. Collapse another branch before expanding this one.`
    return
  }
  controller.notice.value = null
  reservedChildren.value = nextCount
  controller.allocatedNodes.value += nextCount
  expanded.value = true
}

function reconcileReservation(): void {
  if (!expanded.value) { return }
  const nextCount = plannedChildCount()
  const delta = nextCount - reservedChildren.value
  if (delta > 0 && controller.allocatedNodes.value + delta > controller.maxMountedNodes.value) {
    releaseChildren()
    expanded.value = false
    controller.notice.value = `Node budget ${controller.maxMountedNodes.value} reached after the data update. The branch was collapsed.`
    return
  }
  controller.allocatedNodes.value = Math.max(1, controller.allocatedNodes.value + delta)
  reservedChildren.value = nextCount
}

function plannedChildCount(): number {
  return createLazyJsonChildren(props.node, {
    eagerLimit: controller.eagerLimit.value,
    pageSize: controller.pageSize.value,
  }).length
}

function releaseChildren(): void {
  if (reservedChildren.value === 0) { return }
  controller.allocatedNodes.value = Math.max(1, controller.allocatedNodes.value - reservedChildren.value)
  reservedChildren.value = 0
}
</script>

<template>
  <div class="source-json-tree-node">
    <button
      type="button"
      class="source-json-tree-node__row"
      :class="{ 'source-json-tree-node__row--scalar': !container }"
      :style="{ paddingLeft: `${8 + depth * 16}px` }"
      :aria-expanded="container ? expanded : undefined"
      :aria-label="container ? `${keyLabel}: ${summary}` : undefined"
      :disabled="!container"
      @click="toggle"
    >
      <span class="source-json-tree-node__caret">
        <ChevronDown v-if="container && expanded" class="size-3.5" />
        <ChevronRight v-else-if="container" class="size-3.5" />
      </span>
      <span class="source-json-tree-node__key">{{ keyLabel }}</span>
      <span class="source-json-tree-node__colon">:</span>
      <span v-if="container" class="source-json-tree-node__summary">
        {{ summary }}
      </span>
      <span v-else class="source-json-tree-node__value" :data-tone="scalarTone">{{ scalarValue }}</span>
    </button>

    <div v-if="expanded" class="source-json-tree-node__children">
      <SourceJsonTreeNode
        v-for="child in children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :initial-depth="initialDepth"
      />
    </div>
  </div>
</template>

<style scoped>
.source-json-tree-node__row {
  width: 100%;
  min-height: 22px;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.45;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.source-json-tree-node__row:hover {
  background: rgb(30 41 59 / 0.72);
}

.source-json-tree-node__row:focus-visible {
  outline: 1px solid rgb(56 189 248 / 0.72);
  outline-offset: -1px;
}

.source-json-tree-node__row--scalar {
  cursor: default;
}

.source-json-tree-node__row:disabled {
  opacity: 1;
}

.source-json-tree-node__caret {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.source-json-tree-node__key {
  color: #bfdbfe;
}

.source-json-tree-node__colon,
.source-json-tree-node__summary {
  color: #64748b;
}

.source-json-tree-node__value[data-tone='string'] {
  color: #86efac;
}

.source-json-tree-node__value[data-tone='number'],
.source-json-tree-node__value[data-tone='boolean'] {
  color: #7dd3fc;
}

.source-json-tree-node__value[data-tone='null'] {
  color: #94a3b8;
}

.source-json-tree-node__value[data-tone='other'] {
  color: #c4b5fd;
}
</style>
