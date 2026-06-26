<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight, Plus, PlusSquare, Trash2 } from 'lucide-vue-next'

import { cn } from '@/lib/utils'

export interface TableTreeColumn {
  key: string
  title: string
  width?: string | number
  align?: 'left' | 'right' | 'center'
  class?: HTMLAttributes['class']
}

export interface TableTreeRow {
  id: string
  label: string
  icon?: 'table' | 'column' | 'tag' | 'default'
  selectorType?: 'component' | 'column'
  cells?: Record<string, string | number | null | undefined>
  children?: TableTreeRow[]
}

const props = defineProps<{
  columns: TableTreeColumn[]
  rows: TableTreeRow[]
  dense?: boolean
  class?: HTMLAttributes['class']
  modelValue?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'add:root'): void
  (e: 'add:after', rowId: string): void
  (e: 'add:child', rowId: string): void
  (e: 'remove', rowId: string): void
}>()

const expandedIds = ref<Set<string>>(new Set())

function ensureInitialExpanded(rows: TableTreeRow[]): void {
  const next = new Set(expandedIds.value)
  const walk = (rs: TableTreeRow[]): void => {
    for (const r of rs) {
      if (r.children && r.children.length)
        next.add(r.id)
      walk(r.children ?? [])
    }
  }
  walk(rows)
  expandedIds.value = next
}

ensureInitialExpanded(props.rows)

function toggleRow(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expandedIds.value = next
}

interface FlatRow {
  row: TableTreeRow
  depth: number
  hasChildren: boolean
}

const flatRows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  const walk = (rows: TableTreeRow[], depth: number): void => {
    for (const r of rows) {
      const hasChildren = !!(r.children && r.children.length)
      out.push({ row: r, depth, hasChildren })
      if (hasChildren && expandedIds.value.has(r.id))
        walk(r.children!, depth + 1)
    }
  }
  walk(props.rows, 0)
  return out
})

function iconClass(kind: TableTreeRow['icon']): string {
  if (kind === 'table')
    return 'i-tabler-table text-sky-600'
  if (kind === 'column')
    return 'i-tabler-columns-3 text-emerald-600'
  if (kind === 'tag')
    return 'i-tabler-tag text-amber-600'
  return 'i-tabler-box text-muted-foreground'
}

function selectorTypeLabel(t?: TableTreeRow['selectorType']): string {
  if (t === 'component') return 'Компонент'
  if (t === 'column') return 'Колонка таблицы'
  return ''
}
</script>

<template>
  <div :class="cn('border rounded-md bg-background overflow-hidden text-xs', props.class)">
    <div class="border-b bg-muted/60 text-[11px] font-medium uppercase tracking-wide">
      <div class="flex items-center justify-between">
        <div class="flex flex-1">
          <div
            v-for="col in columns"
            :key="col.key"
            :class="cn(
              'px-2 py-1.5 border-r last:border-r-0 flex items-center',
              col.align === 'right' ? 'justify-end text-right' : (col.align === 'center' ? 'justify-center text-center' : 'justify-start text-left'),
              col.class,
            )"
            :style="col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined"
          >
            {{ col.title }}
          </div>
        </div>
        <button
          type="button"
          class="px-2 text-muted-foreground hover:text-foreground"
          @click.stop="emit('add:root')"
        >
          <Plus class="size-3.5" />
        </button>
      </div>
    </div>

    <div class="divide-y">
      <div
        v-for="{ row, depth, hasChildren } in flatRows"
        :key="row.id"
        class="grid cursor-pointer"
        :class="props.modelValue === row.id ? 'bg-accent/40' : 'hover:bg-accent/10'"
        @click="emit('update:modelValue', row.id)"
      >
        <div class="flex">
          <div
            v-for="(col, colIndex) in columns"
            :key="col.key"
            :class="cn(
              'px-2 py-1.5 border-r last:border-r-0 flex items-center',
              dense ? 'py-1' : 'py-1.5',
              colIndex === 0 ? 'text-left' : (col.align === 'right' ? 'justify-end text-right' : col.align === 'center' ? 'justify-center text-center' : 'justify-start text-left'),
              col.class,
            )"
            :style="col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined"
          >
            <template v-if="colIndex === 0">
              <div class="flex items-center gap-1 min-w-0">
                <button
                  v-if="hasChildren"
                  type="button"
                  class="shrink-0 text-muted-foreground hover:text-foreground"
                  @click.stop="toggleRow(row.id)"
                >
                  <ChevronDown
                    v-if="expandedIds.has(row.id)"
                    class="size-3.5"
                  />
                  <ChevronRight
                    v-else
                    class="size-3.5"
                  />
                </button>
                <span
                  class="inline-flex shrink-0"
                  :style="{ marginLeft: `${depth * 12}px` }"
                >
                  <span
                    class="inline-flex items-center justify-center rounded-sm bg-muted size-4"
                  >
                    <span :class="cn('inline-block size-3', iconClass(row.icon || 'default'))" />
                  </span>
                </span>
                <span class="ml-1 truncate">
                  {{ row.label }}
                  <span v-if="row.selectorType" class="ml-1 text-[10px] text-muted-foreground">
                    ({{ selectorTypeLabel(row.selectorType) }})
                  </span>
                </span>
                <span class="ml-2 inline-flex items-center gap-0.5 opacity-70 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground"
                    @click.stop="emit('add:after', row.id)"
                  >
                    <Plus class="size-3" />
                  </button>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground"
                    @click.stop="emit('add:child', row.id)"
                  >
                    <PlusSquare class="size-3" />
                  </button>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive"
                    @click.stop="emit('remove', row.id)"
                  >
                    <Trash2 class="size-3" />
                  </button>
                </span>
              </div>
            </template>
            <template v-else>
              <span class="truncate">
                {{ row.cells?.[col.key] ?? '' }}
              </span>
            </template>
          </div>
        </div>
      </div>
      <div v-if="!flatRows.length" class="px-3 py-4 text-xs text-muted-foreground">
        Нет строк.
      </div>
    </div>
  </div>
</template>

