<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

interface ContextTreeRow {
  path: string
  key: string
  depth: number
  expandable: boolean
  expanded: boolean
  valuePreview: string
}

const props = defineProps<{
  state: unknown | null
}>()

const expandedContextPaths = ref<Set<string>>(new Set(['ctx']))

function isExpandableContextValue(value: unknown): boolean {
  if (!value || typeof value !== 'object')
    return false
  if (Array.isArray(value))
    return value.length > 0
  return Object.keys(value as Record<string, unknown>).length > 0
}

function getContextValuePreview(value: unknown): string {
  if (Array.isArray(value))
    return ''
  if (value == null)
    return 'null'
  if (typeof value === 'object')
    return ''
  if (typeof value === 'string')
    return `"${value}"`
  return String(value)
}

async function copyContextPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(`{${path}}`)
    toast.success('Путь скопирован', {
      description: `{${path}}`,
    })
  }
  catch {
    toast.error('Не удалось скопировать путь')
  }
}

function appendContextRows(
  rows: ContextTreeRow[],
  value: unknown,
  path: string,
  key: string,
  depth: number,
  visited: WeakSet<object>,
): void {
  const expandable = isExpandableContextValue(value)
  const expanded = expandedContextPaths.value.has(path)

  rows.push({
    path,
    key,
    depth,
    expandable,
    expanded,
    valuePreview: getContextValuePreview(value),
  })

  if (!expandable || !expanded || value == null || typeof value !== 'object')
    return

  const objectValue = value as object
  if (visited.has(objectValue))
    return
  visited.add(objectValue)

  if (Array.isArray(value)) {
    const maxItems = Math.min(value.length, 500)
    for (let index = 0; index < maxItems; index += 1)
      appendContextRows(rows, value[index], `${path}.${index}`, `[${index}]`, depth + 1, visited)
    return
  }

  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>))
    appendContextRows(rows, childValue, `${path}.${childKey}`, childKey, depth + 1, visited)
}

const contextTreeRows = computed<ContextTreeRow[]>(() => {
  const state = props.state
  if (!state || typeof state !== 'object')
    return []

  const rows: ContextTreeRow[] = []
  appendContextRows(rows, state, 'ctx', 'ctx', 0, new WeakSet<object>())
  return rows
})

function toggleContextPath(path: string): void {
  const next = new Set(expandedContextPaths.value)
  if (next.has(path))
    next.delete(path)
  else
    next.add(path)
  expandedContextPaths.value = next
}

function collectExpandablePaths(
  value: unknown,
  path: string,
  visited: WeakSet<object>,
  paths: Set<string>,
): void {
  if (!isExpandableContextValue(value) || value == null || typeof value !== 'object')
    return

  const objectValue = value as object
  if (visited.has(objectValue))
    return
  visited.add(objectValue)
  paths.add(path)

  if (Array.isArray(value)) {
    const maxItems = Math.min(value.length, 500)
    for (let index = 0; index < maxItems; index += 1)
      collectExpandablePaths(value[index], `${path}.${index}`, visited, paths)
    return
  }

  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>))
    collectExpandablePaths(childValue, `${path}.${childKey}`, visited, paths)
}

function expandAll(): void {
  const state = props.state
  if (!state || typeof state !== 'object') {
    expandedContextPaths.value = new Set()
    return
  }

  const paths = new Set<string>()
  collectExpandablePaths(state, 'ctx', new WeakSet<object>(), paths)
  expandedContextPaths.value = paths
}

function collapseAll(): void {
  expandedContextPaths.value = new Set()
}

defineExpose({
  expandAll,
  collapseAll,
})
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <template v-if="state">
    <div class="action-playgrounds-context-tree">
      <div
        v-for="row in contextTreeRows"
        :key="`ctx-row-${row.path}`"
        class="action-playgrounds-context-tree__row"
        :style="{ paddingLeft: `${row.depth * 14 + 10}px` }"
        role="button"
        tabindex="0"
        @click="copyContextPath(row.path)"
        @keydown.enter.prevent="copyContextPath(row.path)"
      >
        <button
          v-if="row.expandable"
          type="button"
          class="action-playgrounds-context-tree__toggle"
          :aria-label="row.expanded ? 'Свернуть ветку' : 'Развернуть ветку'"
          @click.stop="toggleContextPath(row.path)"
        >
          <ChevronRight
            class="size-3.5 transition-transform"
            :class="{ 'rotate-90': row.expanded }"
          />
        </button>
        <div
          v-else
          class="action-playgrounds-context-tree__spacer"
        />

        <div class="action-playgrounds-context-tree__key">
          {{ row.key }}
        </div>
        <div class="action-playgrounds-context-tree__value">
          {{ row.valuePreview }}
        </div>
      </div>
    </div>
  </template>
  <div
    v-else
    class="action-playgrounds-bottom-panel__placeholder"
  >
    Контекст выполнения еще не сформирован.
  </div>
  <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
</template>

<style scoped>
.action-playgrounds-bottom-panel__placeholder {
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.92);
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
  padding: 16px;
}

.action-playgrounds-context-tree {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.92);
  overflow: hidden;
}

.action-playgrounds-context-tree__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding-right: 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.action-playgrounds-context-tree__row:hover {
  background: rgba(219, 234, 254, 0.55);
}

.action-playgrounds-context-tree__row:last-child {
  border-bottom: 0;
}

.action-playgrounds-context-tree__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.action-playgrounds-context-tree__toggle:hover {
  background: rgba(226, 232, 240, 0.82);
  color: #334155;
}

.action-playgrounds-context-tree__spacer {
  width: 18px;
  height: 18px;
}

.action-playgrounds-context-tree__key {
  min-width: 0;
  color: #0f172a;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-playgrounds-context-tree__value {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}
</style>
