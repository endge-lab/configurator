<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DiagnosticsSeverityNumber } from '@endge/core'
import type {
  DiagnosticsSpanTreeNode,
  DiagnosticsTreeNode,
} from '@/features/endge-ide/domain/types/diagnostics-presentation.type'

defineOptions({ name: 'LogTree' })

const props = defineProps<{
  nodes?: DiagnosticsTreeNode[]
  level?: number
  rowMessage?: (node: DiagnosticsTreeNode) => string
}>()

const safeNodes = computed<DiagnosticsTreeNode[]>(() =>
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

function levelClass(level: DiagnosticsSeverityNumber | undefined): string {
  switch (level) {
    case 1:
    case 5:
      return 'text-muted'
    case 9:
      return 'text-info'
    case 13:
      return 'text-warning'
    case 17:
    case 21:
      return 'text-danger'
    default:
      return ''
  }
}

function defaultRowMessage(node: DiagnosticsTreeNode): string {
  return node.kind === 'span'
    ? `${node.name} (${node.durationMs} ms)`
    : node.body
}

const rowMsg = (node: DiagnosticsTreeNode) =>
  props.rowMessage ? props.rowMessage(node) : defaultRowMessage(node)

const openStates = ref<Record<string, boolean>>({})

function nodeKey(node: DiagnosticsTreeNode, idx: number): string {
  return `${currentLevel}:${node.id}:${idx}`
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

function traverse(nodes: DiagnosticsTreeNode[], lvl: number, isOpen: boolean): void {
  nodes.forEach((node, idx) => {
    const key = `${lvl}:${node.id}:${idx}`
    openStates.value[key] = isOpen
    if (node.kind === 'span' && (node as DiagnosticsSpanTreeNode).children.length) {
      traverse((node as DiagnosticsSpanTreeNode).children, lvl + 1, isOpen)
    }
  })
}

function expandAll(): void {
  traverse(safeNodes.value, currentLevel, true)
}
function collapseAll(): void {
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
            :class="levelClass(node.severityNumber)"
            @click.prevent="
              openStates[nodeKey(node, idx)] = !openStates[nodeKey(node, idx)]
            "
          >
            <div class="flex items-center gap-2">
              <span>▶</span>
              <span>[{{ fmtTime(node.timestamp) }}]</span>
              <span>{{ rowMsg(node) }}</span>
              <span class="text-muted">- {{ node.scope }}</span>
            </div>
            <div class="text-muted">
              <span>{{ node.durationMs }} ms</span>
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
          :class="levelClass(node.severityNumber)"
        >
          <div class="flex items-center gap-2">
            <span>•</span>
            <span>[{{ fmtTime(node.timestamp) }}]</span>
            <span>{{ rowMsg(node) }}</span>
            <span class="text-muted">- {{ node.scope }}</span>
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
