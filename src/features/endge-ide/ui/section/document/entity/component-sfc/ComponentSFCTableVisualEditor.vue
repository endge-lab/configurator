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

const mainTab = ref<'columns' | 'table'>('table')
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
const selectedComponentLabel = computed(() => {
  const value = selectedComponentValue.value
  const cell = selectedColumn.value?.cell
  const identity = cell?.kind === 'component' ? cell.identity : null
  return componentSelectOptions.value.find(option => option.value === value)?.label
    ?? identity
    ?? 'Стандартная ячейка'
})
const selectedComponentHint = computed(() => {
  const column = selectedColumn.value
  if (!column) {
    return ''
  }
  if (isSourceOwnedCell(column)) {
    return 'Сложная разметка управляется в Source и недоступна для визуального изменения.'
  }
  if (isDirectComponent(column)) {
    return 'Direct component можно заменить без потери его bindings.'
  }
  if (column.cell.kind === 'component') {
    return 'Компонент отвечает за отображение значения в ячейке таблицы.'
  }
  return 'Значение отображается стандартной ячейкой Table.'
})

function isDirectComponent(column: ComponentSFCTableColumnProjection): boolean {
  return column.cell.kind === 'component' && column.cell.syntax === 'direct'
}

function isSourceOwnedCell(column: ComponentSFCTableColumnProjection): boolean {
  return column.cell.kind === 'source'
}

function columnAttributeText(
  column: ComponentSFCTableColumnProjection,
  ...names: string[]
): string {
  const attribute = column.attributes.find(item => names.includes(item.name))
  return sourceValueText(attribute?.value)
}

function formatSizeValue(value: string): string {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value || '—'
}

function columnCellType(column: ComponentSFCTableColumnProjection): string {
  return columnAttributeText(column, 'type', 'cell-type', 'cellType') || 'Текст'
}

function columnCellAlignment(column: ComponentSFCTableColumnProjection): string {
  return columnAttributeText(column, 'align', 'alignment') || 'По левому краю'
}

function columnMinWidth(column: ComponentSFCTableColumnProjection): string {
  return formatSizeValue(columnAttributeText(column, 'min-width', 'minWidth'))
}

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
  if (!column || Array.isArray(value) || isSourceOwnedCell(column)) {
    return
  }
  const identity = value === DEFAULT_COMPONENT_VALUE ? null : value
  if (column.cell.kind === 'component' && column.cell.identity === identity) {
    return
  }
  applyPatch({
    type: 'set-column-component',
    columnIndex: column.index,
    identity,
    syntax: column.cell.kind === 'component' ? column.cell.syntax : undefined,
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
  <div class="component-sfc-table-visual-editor flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4">
    <Tabs v-model="mainTab" class="flex min-h-0 flex-1 flex-col">
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <TabsList class="grid h-9 w-full max-w-[360px] grid-cols-2">
          <TabsTrigger value="table" class="gap-1.5">
            <Table2 class="size-3.5" />
            Таблица
          </TabsTrigger>
          <TabsTrigger value="columns" class="gap-1.5">
            <Columns3 class="size-3.5" />
            Колонки
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

      <TabsContent value="table" class="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <Card class="editor-panel gap-0 overflow-hidden py-0">
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

      <TabsContent value="columns" class="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <div class="space-y-3 pb-3 pr-2">
            <Card class="editor-panel gap-0 overflow-hidden py-0">
              <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div class="text-sm font-semibold">
                    Колонки таблицы
                  </div>
                  <div class="mt-0.5 text-xs text-muted-foreground">
                    Определяют структуру данных и отображение в таблице
                  </div>
                </div>
                <TooltipProvider :delay-duration="120">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="outline"
                        class="size-8 shrink-0"
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

              <div class="flex min-h-16 flex-wrap items-center gap-2 p-3">
                <button
                  v-for="(column, index) in columns"
                  :key="column.id"
                  type="button"
                  draggable="true"
                  class="inline-flex cursor-move items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-[border-color,background-color,box-shadow,opacity]"
                  :class="[
                    selectedColumnIndex === index
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'editor-control border-border/70 hover:border-border hover:brightness-110',
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
                  <FileCode2 v-if="isSourceOwnedCell(column)" class="size-3.5 shrink-0 opacity-75" />
                </button>

                <div v-if="!columns.length" class="px-2 py-2 text-xs text-muted-foreground">
                  Нет колонок. Нажмите «+» вверху.
                </div>
              </div>
            </Card>

            <Card class="editor-panel gap-0 overflow-hidden py-0">
              <div v-if="!selectedColumn" class="p-5 text-sm text-muted-foreground">
                Выберите колонку выше для настройки.
              </div>

              <template v-else>
                <div class="flex items-start justify-between gap-4 border-b px-5 py-4">
                  <div class="min-w-0">
                    <div class="text-xs font-medium text-muted-foreground">
                      Выбранная колонка
                    </div>
                    <div class="mt-1 truncate text-xl font-semibold tracking-tight">
                      {{ columnTitle(selectedColumn) }}
                    </div>
                    <div class="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                      <div>ID: {{ columnKey(selectedColumn) }}</div>
                      <div>&lt;Column key=&quot;{{ columnKey(selectedColumn) }}&quot;&gt;</div>
                    </div>
                  </div>

                  <Badge
                    v-if="isSourceOwnedCell(selectedColumn)"
                    variant="secondary"
                    class="mt-6 shrink-0 gap-1.5 font-normal"
                  >
                    <FileCode2 class="size-3" /> Source Cell
                  </Badge>
                  <Badge
                    v-else-if="isDirectComponent(selectedColumn)"
                    variant="secondary"
                    class="mt-6 shrink-0 gap-1.5 font-normal"
                  >
                    <Code2 class="size-3" /> Direct component
                  </Badge>
                </div>

                <div class="grid border-b bg-background/20 lg:grid-cols-[0.8fr_1.1fr_1.25fr]">
                  <section class="border-b p-4 lg:border-b-0 lg:border-r">
                    <h3 class="text-sm font-semibold">
                      Интерфейс
                    </h3>
                    <div class="mt-3 space-y-1.5">
                      <div class="text-xs text-muted-foreground">
                        Компонент
                      </div>
                      <div class="editor-control flex h-9 items-center rounded-md border border-input px-3 text-sm">
                        <span class="truncate">{{ selectedComponentLabel }}</span>
                      </div>
                    </div>
                  </section>

                  <section class="border-b p-4 lg:border-b-0 lg:border-r">
                    <h3 class="text-sm font-semibold">
                      Ячейка
                    </h3>
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                      <div class="space-y-1.5">
                        <div class="text-xs text-muted-foreground">
                          Тип
                        </div>
                        <div class="editor-control flex h-9 items-center rounded-md border border-input px-3 text-sm">
                          {{ columnCellType(selectedColumn) }}
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <div class="text-xs text-muted-foreground">
                          Выравнивание
                        </div>
                        <div class="editor-control flex h-9 items-center rounded-md border border-input px-3 text-sm">
                          {{ columnCellAlignment(selectedColumn) }}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section class="p-4">
                    <h3 class="text-sm font-semibold">
                      Размеры
                    </h3>
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                      <div class="space-y-1.5">
                        <div class="text-xs text-muted-foreground">
                          Ширина
                        </div>
                        <div class="editor-control flex h-9 items-center rounded-md border border-input px-3 text-sm">
                          {{ formatSizeValue(sourceValueText(selectedColumn.width)) }}
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <div class="text-xs text-muted-foreground">
                          Мин. ширина
                        </div>
                        <div class="editor-control flex h-9 items-center rounded-md border border-input px-3 text-sm">
                          {{ columnMinWidth(selectedColumn) }}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <section class="border-b px-4 py-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h3 class="text-sm font-semibold">
                      Данные
                    </h3>
                    <Button
                      variant="link"
                      size="sm"
                      class="h-auto gap-1 px-0 text-xs"
                      @click="emit('openSource')"
                    >
                      Редактировать в Source
                      <Code2 class="size-3.5" />
                    </Button>
                  </div>

                  <div class="grid gap-4 lg:grid-cols-4">
                    <div class="space-y-1.5">
                      <Label for="sfc-table-column-title">Заголовок</Label>
                      <Input
                        id="sfc-table-column-title"
                        v-model="titleDraft"
                        class="editor-control"
                        :disabled="!canEdit(selectedColumn.title)"
                        @blur="commitAttribute('title', titleDraft)"
                        @keydown.enter="blurInput"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="sfc-table-column-key">Key</Label>
                      <Input
                        id="sfc-table-column-key"
                        v-model="keyDraft"
                        class="editor-control font-mono"
                        spellcheck="false"
                        :disabled="!canEdit(selectedColumn.key)"
                        @blur="commitAttribute('key', keyDraft)"
                        @keydown.enter="blurInput"
                      />
                    </div>

                    <div class="space-y-1.5 lg:col-span-2">
                      <Label>Компонент ячейки</Label>
                      <SearchableSelect
                        :options="componentSelectOptions"
                        :model-value="selectedComponentValue"
                        :disabled="isSourceOwnedCell(selectedColumn)"
                        placeholder="Выберите компонент"
                        trigger-class="editor-control w-full"
                        @update:model-value="updateComponent"
                      />
                      <p class="text-xs text-muted-foreground">
                        {{ selectedComponentHint }}
                      </p>
                    </div>
                  </div>
                </section>

                <div class="px-4 py-3">
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
              </template>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
.component-sfc-table-visual-editor :deep(.editor-panel) {
  background: var(--editor-panel);
}

.component-sfc-table-visual-editor :deep(.editor-control) {
  background: var(--editor-control);
}
</style>
