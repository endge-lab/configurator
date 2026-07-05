<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LogLevel } from '@endge/core'
import type { LogNode, SpanNode } from '@endge/core'

defineOptions({ name: 'LogTree' })

const props = defineProps<{
  nodes?: LogNode[]
  level?: number
  rowMessage?: (n: LogNode) => string
}>()

const safeNodes = computed<LogNode[]>(() =>
  Array.isArray(props.nodes) ? props.nodes! : [],
)
const currentLevel = props.level ?? 0

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function levelClass(level: LogLevel | undefined): string {
  switch (level) {
    case 'trace':
    case 'debug':
      return 'text-muted'
    case 'info':
      return 'text-info'
    case 'warn':
      return 'text-warning'
    case 'error':
    case 'fatal':
      return 'text-danger'
    default:
      return ''
  }
}

function defaultRowMessage(n: LogNode): string {
  if (n.kind === 'span') {
    const base = n.name ?? 'span'
    const dur =
      typeof n.durMs === 'number'
        ? ` (${n.durMs} ms)`
        : n.endTs
          ? ` (${n.endTs - n.ts} ms)`
          : ''
    return `${base}${dur}`
  }
  return n.msg || n.name || 'event'
}

const rowMsg = (n: LogNode) =>
  props.rowMessage ? props.rowMessage(n) : defaultRowMessage(n)

const openStates = ref<Record<string, boolean>>({})

function nodeKey(n: LogNode, idx: number): string {
  const trace = n.corr?.traceId ?? ''
  const span = n.corr?.spanId ?? ''
  const name = n.name ?? ''
  return `${currentLevel}:${n.kind}:${trace}:${span}:${n.ts}:${name}:${idx}`
}

watch(
  safeNodes,
  (arr) => {
    arr.forEach((n, idx) => {
      const key = nodeKey(n, idx)
      if (!(key in openStates.value)) {
        // верхний уровень: раскрываем только спаны
        openStates.value[key] = currentLevel === 0 && n.kind === 'span'
      }
    })
  },
  { immediate: true, deep: true },
)

function traverse(nodes: LogNode[], lvl: number, isOpen: boolean) {
  nodes.forEach((n, idx) => {
    const key = `${lvl}:${n.kind}:${n.corr?.traceId ?? ''}:${n.corr?.spanId ?? ''}:${n.ts}:${n.name ?? ''}:${idx}`
    openStates.value[key] = isOpen
    if (n.kind === 'span' && (n as SpanNode).children?.length) {
      traverse((n as SpanNode).children, lvl + 1, isOpen)
    }
  })
}

function expandAll() {
  traverse(safeNodes.value, currentLevel, true)
}
function collapseAll() {
  traverse(safeNodes.value, currentLevel, false)
}
defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div class="relative">
    <div class="space-y-1 flex flex-col">
      <template v-for="(node, idx) in safeNodes" :key="nodeKey(node, idx)">
        <!-- SPAN (раскрываемая группа) -->
        <details
          v-if="node.kind === 'span'"
          :open="openStates[nodeKey(node, idx)]"
          class="border border-border bg-surface relative"
        >
          <summary
            class="cursor-pointer px-2 py-1 text-xs font-medium hover:bg-hover flex items-center justify-between"
            :class="levelClass(node.level)"
            @click.prevent="
              openStates[nodeKey(node, idx)] = !openStates[nodeKey(node, idx)]
            "
          >
            <div class="flex items-center gap-2">
              <span>▶</span>
              <span>[{{ fmtTime(node.ts) }}]</span>
              <span>{{ rowMsg(node) }}</span>
              <span v-if="node.lane" class="text-muted">- {{ node.lane }}</span>
            </div>
            <div class="text-muted">
              <span v-if="typeof node.durMs === 'number'"
                >{{ node.durMs }} ms</span
              >
            </div>
          </summary>

          <div class="pl-4 py-1">
            <LogTree
              v-if="node.children?.length"
              :nodes="node.children"
              :level="(level ?? 0) + 1"
              :row-message="rowMessage"
            />
          </div>
        </details>

        <!-- EVENT (лист) -->
        <div
          v-else
          class="flex items-center text-xs hover:bg-layer transition-colors relative px-2 py-1"
          :class="levelClass(node.level)"
        >
          <div class="flex items-center gap-2">
            <span>•</span>
            <span>[{{ fmtTime(node.ts) }}]</span>
            <span>{{ rowMsg(node) }}</span>
            <span v-if="node.lane" class="text-muted">- {{ node.lane }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bg-surface {
  background-color: var(--color-surface);
}
.border-border {
  border-color: var(--color-border);
}
.text-muted {
  color: var(--color-muted);
}
.text-info {
  color: var(--color-info);
}
.text-warning {
  color: var(--color-warning);
}
.text-danger {
  color: var(--color-danger);
}
.hover\:bg-hover:hover {
  background-color: var(--color-hover);
}
</style>
