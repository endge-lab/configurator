<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { SearchableSelectOption } from '@/components/ui/searchable-select'
import type {
  ComponentSFCTableColumnProjection,
  ComponentSFCTableSourcePatch,
  ComponentSFCTableVisualProjection,
  ComponentSFCVisualSourceValue,
  RComponentDiagnostic,
} from '@endge/core'

import { patchComponentSFCTableSource } from '@endge/core'
import {
  AlertCircle,
  Code2,
  Columns3,
  FileCode2,
  GripVertical,
  Plus,
  Table2,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  source: string
  projection: ComponentSFCTableVisualProjection
  componentOptions: SearchableSelectOption[]
  diagnostics?: RComponentDiagnostic[]
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'openSource'): void
}>()

const DEFAULT_COMPONENT_VALUE = '__default_cell__'

const mainTab = ref<'columns' | 'table'>('columns')
const columnDetailTab = ref<'interface' | 'cell'>('interface')
const selectedColumnIndex = ref<number | null>(null)
const dragColumnIndex = ref<number | null>(null)
const dragOverColumnIndex = ref<number | null>(null)
const titleDraft = ref('')
const keyDraft = ref('')
const widthDraft = ref('')

const columns = computed(() => props.projection.columns)
const selectedColumn = computed(() => {
  const index = selectedColumnIndex.value
  return index == null ? null : columns.value[index] ?? null
})
const relevantDiagnostics = computed(() => (
  props.diagnostics?.filter(item => item.sourcePath?.startsWith('template') || item.code.startsWith('sfc-table')) ?? []
))
const errorCount = computed(() => relevantDiagnostics.value.filter(item => item.severity === 'error').length)
const componentSelectOptions = computed<SearchableSelectOption[]>(() => [
  { value: DEFAULT_COMPONENT_VALUE, label: 'Без компонента — стандартная ячейка' },
  ...props.componentOptions,
])
const selectedComponentValue = computed(() => {
  const cell = selectedColumn.value?.cell
  return cell?.kind === 'component' && cell.identity
    ? cell.identity
    : DEFAULT_COMPONENT_VALUE
})

watch(
  columns,
  (nextColumns) => {
    if (!nextColumns.length) {
      selectedColumnIndex.value = null
      return
    }
    if (selectedColumnIndex.value == null || selectedColumnIndex.value >= nextColumns.length) {
      selectedColumnIndex.value = Math.min(selectedColumnIndex.value ?? 0, nextColumns.length - 1)
    }
  },
  { immediate: true },
)

watch(
  selectedColumn,
  (column) => {
    titleDraft.value = sourceValueText(column?.title)
    keyDraft.value = sourceValueText(column?.key)
    widthDraft.value = sourceValueText(column?.width)
  },
  { immediate: true },
)

function sourceValueText(value: ComponentSFCVisualSourceValue | null | undefined): string {
  if (!value) {
    return ''
  }
  if (value.kind === 'expression') {
    return value.source
  }
  if (value.kind === 'boolean') {
    return value.value ? 'true' : 'false'
  }
  return value.value == null ? '' : String(value.value)
}

function columnTitle(column: ComponentSFCTableColumnProjection): string {
  return sourceValueText(column.title) || sourceValueText(column.key) || `Колонка ${column.index + 1}`
}

function columnKey(column: ComponentSFCTableColumnProjection): string {
  return sourceValueText(column.key) || `column_${column.index + 1}`
}

function canEdit(value: ComponentSFCVisualSourceValue | null | undefined): boolean {
  return value?.kind !== 'expression'
}

function applyPatch(patch: ComponentSFCTableSourcePatch): boolean {
  const result = patchComponentSFCTableSource(props.source, patch)
  if (!result.ok) {
    toast.error('Не удалось изменить Table Source', {
      description: result.message,
    })
    return false
  }
  if (result.changed) {
    emit('update:source', result.source)
  }
  return true
}

function addColumn(): void {
  const nextIndex = columns.value.length
  if (applyPatch({ type: 'add-column' })) {
    selectedColumnIndex.value = nextIndex
    columnDetailTab.value = 'interface'
  }
}

function removeSelectedColumn(): void {
  const index = selectedColumnIndex.value
  if (index == null) {
    return
  }
  if (applyPatch({ type: 'remove-column', columnIndex: index })) {
    selectedColumnIndex.value = columns.value.length <= 1 ? null : Math.min(index, columns.value.length - 2)
  }
}

function commitAttribute(
  name: 'key' | 'title' | 'width',
  value: string,
): void {
  const column = selectedColumn.value
  if (!column) {
    return
  }
  if (name === 'key' && !value.trim()) {
    keyDraft.value = sourceValueText(column.key)
    toast.warning('Key колонки не может быть пустым')
    return
  }

  const current = sourceValueText(column[name])
  const normalized = name === 'width' && !value.trim() ? null : value
  if ((normalized ?? '') === current) {
    return
  }
  applyPatch({
    type: 'set-column-attribute',
    columnIndex: column.index,
    name,
    value: normalized,
  })
}

function updateComponent(value: string | string[] | null): void {
  const column = selectedColumn.value
  if (!column || Array.isArray(value)) {
    return
  }
  applyPatch({
    type: 'set-column-component',
    columnIndex: column.index,
    identity: value === DEFAULT_COMPONENT_VALUE ? null : value,
  })
}

function onColumnDragStart(event: DragEvent, index: number): void {
  dragColumnIndex.value = index
  dragOverColumnIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onColumnDragOver(event: DragEvent, index: number): void {
  event.preventDefault()
  dragOverColumnIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onColumnDrop(event: DragEvent, toIndex: number): void {
  event.preventDefault()
  const fromIndex = dragColumnIndex.value
  if (fromIndex != null && fromIndex !== toIndex) {
    if (applyPatch({ type: 'move-column', fromIndex, toIndex })) {
      selectedColumnIndex.value = toIndex
    }
  }
  resetDragState()
}

function resetDragState(): void {
  dragColumnIndex.value = null
  dragOverColumnIndex.value = null
}

function blurInput(event: KeyboardEvent): void {
  (event.currentTarget as HTMLInputElement | null)?.blur()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden p-3">
    <Tabs v-model="mainTab" class="flex min-h-0 flex-1 flex-col">
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <TabsList class="grid h-9 w-full max-w-[360px] grid-cols-2">
          <TabsTrigger value="columns" class="gap-1.5">
            <Columns3 class="size-3.5" />
            Колонки
          </TabsTrigger>
          <TabsTrigger value="table" class="gap-1.5">
            <Table2 class="size-3.5" />
            Таблица
          </TabsTrigger>
        </TabsList>

        <div class="flex items-center gap-2">
          <Badge variant="outline" class="gap-1 font-normal">
            <Columns3 class="size-3" />
            {{ columns.length }}
          </Badge>
          <Badge
            v-if="relevantDiagnostics.length"
            :variant="errorCount ? 'destructive' : 'secondary'"
            class="gap-1 font-normal"
          >
            <AlertCircle class="size-3" />
            {{ relevantDiagnostics.length }}
          </Badge>
        </div>
      </div>

      <TabsContent value="columns" class="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden">
        <Card class="shrink-0 overflow-hidden">
          <div class="flex items-center justify-between gap-2 border-b p-2">
            <span class="text-xs font-medium">Колонки таблицы</span>
            <TooltipProvider :delay-duration="120">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon"
                    variant="outline"
                    class="size-7"
                    aria-label="Добавить колонку"
                    @click="addColumn"
                  >
                    <Plus class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Добавить колонку</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div class="flex min-h-12 flex-wrap gap-1 p-2">
            <button
              v-for="(column, index) in columns"
              :key="column.id"
              type="button"
              draggable="true"
              class="inline-flex cursor-move items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
              :class="[
                selectedColumnIndex === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-transparent hover:bg-muted',
                dragColumnIndex === index ? 'opacity-50' : '',
                dragOverColumnIndex === index && dragColumnIndex !== index
                  ? 'ring-1 ring-primary'
                  : '',
              ]"
              :title="columnTitle(column)"
              @click="selectedColumnIndex = index"
              @dragstart="(event: DragEvent) => onColumnDragStart(event, index)"
              @dragover="(event: DragEvent) => onColumnDragOver(event, index)"
              @dragleave="dragOverColumnIndex = null"
              @drop="(event: DragEvent) => onColumnDrop(event, index)"
              @dragend="resetDragState"
            >
              <GripVertical class="size-3.5 shrink-0 opacity-60" />
              <span class="max-w-52 truncate">{{ columnTitle(column) }}</span>
              <FileCode2 v-if="column.cell.kind === 'source'" class="ml-1 size-3.5 shrink-0 opacity-75" />
            </button>

            <div v-if="!columns.length" class="px-3 py-2 text-xs text-muted-foreground">
              Нет колонок. Нажмите «+» вверху.
            </div>
          </div>
        </Card>

        <Card class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div v-if="!selectedColumn" class="p-4 text-sm text-muted-foreground">
            Выберите колонку выше для настройки.
          </div>

          <template v-else>
            <div class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold">
                  {{ columnTitle(selectedColumn) }}
                </div>
                <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  &lt;Column key=&quot;{{ columnKey(selectedColumn) }}&quot;&gt;
                </div>
              </div>
              <Badge v-if="selectedColumn.cell.kind === 'source'" variant="secondary" class="gap-1 font-normal">
                <Code2 class="size-3" /> Source Cell
              </Badge>
            </div>

            <Tabs v-model="columnDetailTab" class="flex min-h-0 flex-1 flex-col">
              <div class="shrink-0 border-b px-4 pt-3">
                <TabsList class="grid h-9 w-full grid-cols-2">
                  <TabsTrigger value="interface">
                    Интерфейс
                  </TabsTrigger>
                  <TabsTrigger value="cell">
                    Ячейка
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea class="min-h-0 flex-1">
                <TabsContent value="interface" class="m-0 space-y-4 p-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between gap-3">
                      <Label for="sfc-table-column-title">Заголовок</Label>
                      <Button
                        v-if="!canEdit(selectedColumn.title)"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs"
                        @click="emit('openSource')"
                      >
                        Expression — открыть Source
                      </Button>
                    </div>
                    <Input
                      id="sfc-table-column-title"
                      v-model="titleDraft"
                      :disabled="!canEdit(selectedColumn.title)"
                      @blur="commitAttribute('title', titleDraft)"
                      @keydown.enter="blurInput"
                    />
                  </div>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <Label for="sfc-table-column-key">Key</Label>
                        <Button
                          v-if="!canEdit(selectedColumn.key)"
                          variant="link"
                          size="sm"
                          class="h-auto px-0 text-xs"
                          @click="emit('openSource')"
                        >
                          Expression
                        </Button>
                      </div>
                      <Input
                        id="sfc-table-column-key"
                        v-model="keyDraft"
                        class="font-mono"
                        spellcheck="false"
                        :disabled="!canEdit(selectedColumn.key)"
                        @blur="commitAttribute('key', keyDraft)"
                        @keydown.enter="blurInput"
                      />
                    </div>

                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <Label for="sfc-table-column-width">Ширина</Label>
                        <Button
                          v-if="!canEdit(selectedColumn.width)"
                          variant="link"
                          size="sm"
                          class="h-auto px-0 text-xs"
                          @click="emit('openSource')"
                        >
                          Expression
                        </Button>
                      </div>
                      <Input
                        id="sfc-table-column-width"
                        v-model="widthDraft"
                        placeholder="auto"
                        :disabled="!canEdit(selectedColumn.width)"
                        @blur="commitAttribute('width', widthDraft)"
                        @keydown.enter="blurInput"
                      />
                    </div>
                  </div>

                  <div class="space-y-2 border-t pt-4">
                    <div class="flex items-center justify-between gap-3">
                      <Label>Компонент ячейки</Label>
                      <Button
                        v-if="selectedColumn.cell.kind === 'source'"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs"
                        @click="emit('openSource')"
                      >
                        Редактировать в Source
                      </Button>
                    </div>
                    <SearchableSelect
                      :options="componentSelectOptions"
                      :model-value="selectedComponentValue"
                      :disabled="selectedColumn.cell.kind === 'source'"
                      placeholder="Выберите компонент"
                      trigger-class="w-full"
                      @update:model-value="updateComponent"
                    />
                    <p class="text-xs text-muted-foreground">
                      Visual editor создаёт простой &lt;Cell&gt;&lt;Component is=&quot;…&quot; /&gt;&lt;/Cell&gt;. Произвольная разметка остаётся в Source.
                    </p>
                  </div>

                  <div class="border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive"
                      @click="removeSelectedColumn"
                    >
                      <Trash2 class="mr-1 size-4" />
                      Удалить колонку
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="cell" class="m-0 p-4">
                  <div v-if="selectedColumn.cell.kind === 'source'" class="space-y-3">
                    <div class="overflow-hidden rounded-md border bg-slate-950 text-slate-100 shadow-inner">
                      <div class="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-slate-400">
                        <FileCode2 class="size-3.5" />
                        Пользовательская ячейка
                      </div>
                      <pre class="max-h-80 overflow-auto p-4 text-xs leading-5"><code>{{ selectedColumn.cellSource }}</code></pre>
                    </div>
                    <Button variant="outline" size="sm" @click="emit('openSource')">
                      <Code2 class="mr-1 size-4" />
                      Открыть Source
                    </Button>
                  </div>

                  <div v-else-if="selectedColumn.cell.kind === 'component' && selectedColumn.cell.identity" class="rounded-lg border p-4">
                    <div class="text-xs text-muted-foreground">
                      Прикреплённый компонент
                    </div>
                    <div class="mt-1 font-mono text-sm font-medium">
                      {{ selectedColumn.cell.identity }}
                    </div>
                    <code class="mt-3 block rounded-md bg-muted px-3 py-2 text-xs">&lt;Component is=&quot;{{ selectedColumn.cell.identity }}&quot; /&gt;</code>
                  </div>

                  <div v-else class="rounded-lg border border-dashed px-4 py-8 text-center">
                    <FileCode2 class="mx-auto size-5 text-muted-foreground" />
                    <div class="mt-2 text-sm font-medium">
                      Стандартная ячейка
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      Значение выводится таблицей без отдельного Cell-компонента.
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </template>
        </Card>
      </TabsContent>

      <TabsContent value="table" class="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <Card class="overflow-hidden">
            <div class="border-b px-4 py-3">
              <div class="text-sm font-semibold">
                Настройки Table
              </div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                Расширенные настройки пока отображаются без визуального редактирования.
              </div>
            </div>
            <div class="divide-y">
              <div
                v-for="item in [
                  { label: 'Rows', value: projection.rows },
                  { label: 'Row key', value: projection.rowKey },
                  { label: 'Sort mode', value: projection.sortMode },
                  { label: 'Default sort', value: projection.defaultSort },
                  { label: 'Column pin', value: projection.columnPin },
                  { label: 'Default pin', value: projection.defaultPin },
                ]"
                :key="item.label"
                class="grid grid-cols-[160px_minmax(0,1fr)] gap-4 px-4 py-3 text-sm"
              >
                <div class="text-muted-foreground">
                  {{ item.label }}
                </div>
                <code class="break-all">{{ sourceValueText(item.value) || 'Не задано' }}</code>
              </div>
            </div>
          </Card>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>
