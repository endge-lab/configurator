<script setup lang="ts">
import type { StyleBlocksPayload } from '@endge/core'

import { ComponentType, DomainSectionType, Endge } from '@endge/core'
import { Eraser, Loader2, Palette, Paintbrush, Plus, Save, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { TableTreeView, type TableTreeColumn, type TableTreeRow } from '@/components/ui/table-tree'
import DomainEntityDropTarget from '@/features/endge-admin/ui/components/DomainEntityDropTarget.vue'
import OpenEntityButton from '@/features/endge-admin/ui/components/OpenEntityButton.vue'
import { isBusy } from '@/features/endge-admin/model/core/endge-admin-busy.ts'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

/** Локальный сегмент пути для UI */
interface PathSegmentUI {
  // table: id компонента-таблицы, column: identity/id колонки, tag: identity тега
  type: 'table' | 'column' | 'tag'
  refId?: string
}

/** Локальный блок для UI */
interface BlockUI {
  path: PathSegmentUI[]
  properties: Array<{ key: string; value: string }>
}

function segmentKeyFromUI(seg: PathSegmentUI): string {
  if ((seg.type === 'table' || seg.type === 'column') && seg.refId)
    return `${seg.type}:${seg.refId}`
  if (seg.type === 'tag')
    return seg.refId ? `tag:${seg.refId}` : 'tag:'
  return 'tag:'
}

function payloadFromBlocks(blocks: BlockUI[]): StyleBlocksPayload {
  const out: StyleBlocksPayload = []
  for (const b of blocks) {
    if (!b.path.length)
      continue
    let root: any = {}
    let cursor = root
    for (const seg of b.path) {
      const key = segmentKeyFromUI(seg)
      if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key]))
        cursor[key] = {}
      cursor = cursor[key]
    }
    for (const prop of b.properties) {
      if (!prop.key.trim())
        continue
      const num = Number(prop.value)
      cursor[prop.key.trim()] = Number.isNaN(num) ? prop.value : num
    }
    out.push(root)
  }
  return out
}

function payloadToBlocks(payload: StyleBlocksPayload): BlockUI[] {
  const blocks: BlockUI[] = []
  if (!Array.isArray(payload))
    return blocks

  function segmentFromKey(key: string): PathSegmentUI | null {
    const idx = key.indexOf(':')
    if (idx <= 0) return null
    const type = key.slice(0, idx)
    const id = key.slice(idx + 1)
    if (type === 'table' || type === 'column')
      return { type: type as 'table' | 'column', refId: id || undefined }
    if (type === 'tag')
      return { type: 'tag', refId: id || undefined }
    return null
  }

  function walk(node: any, path: PathSegmentUI[]): void {
    if (!node || typeof node !== 'object')
      return
    const props: Array<{ key: string; value: string }> = []
    const nested: Array<{ key: string; value: any }> = []

    for (const [k, v] of Object.entries(node)) {
      const seg = segmentFromKey(k)
      if (seg && v && typeof v === 'object' && !Array.isArray(v)) {
        nested.push({ key: k, value: v })
      }
      else if (typeof v === 'string' || typeof v === 'number') {
        props.push({ key: k, value: String(v) })
      }
    }

    if (props.length && path.length) {
      blocks.push({ path: [...path], properties: props })
    }

    for (const n of nested) {
      const seg = segmentFromKey(n.key)
      if (!seg) continue
      walk(n.value, [...path, seg])
    }
  }

  payload.forEach(block => {
    walk(block, [])
  })

  return blocks
}

const tabs = EndgeAdmin.tabs
const editor = computed(() => tabs.documentEditorModel.value as { id: number | string; identity: string; displayName: string; styles: Record<string, unknown> } | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { isSystem?: boolean } | null ?? null)
const isSystem = computed(() => documentModel.value?.isSystem === true)

const blocks = ref<BlockUI[]>([])

const components = computed(() =>
  Endge.domain.getComponents().map(c => ({ id: c.id, label: (c as { name?: string }).name ?? c.identity ?? c.id })),
)
const tableComponents = computed(() =>
  components.value.filter((c: any) => {
    const comp = Endge.domain.getComponent(c.id)
    return (comp as any)?.type === ComponentType.Table
  }),
)
const tableSelectOptions = computed(() =>
  tableComponents.value.map(c => ({ value: c.id, label: `${c.label} (${c.id})` })),
)

const selectedTableColumnsOptions = computed(() => {
  const tableId = selectedTableId.value
  if (!tableId)
    return []
  const comp = Endge.domain.getComponent(tableId) as any
  if (!comp || comp.type !== ComponentType.Table)
    return []
  const cols = Array.isArray(comp.columns) ? comp.columns : []
  return cols.map((col: any, index: number) => {
    const id = String(col.id ?? index)
    const title = (col.title as string | undefined) ?? id
    return { value: id, label: title }
  })
})

const segmentTypeOptions = [
  { value: 'table', label: 'Таблица' },
  { value: 'column', label: 'Колонка' },
  { value: 'tag', label: 'Тег' },
] as const

const ENDGE_STYLE_PREVIEW_ID = 'endge-style-editor-preview'
const ENDGE_GLOBAL_STYLES_ID = 'endge-styles-injected'
const showCssModal = ref(false)
const compiledCssText = ref('')

const selectedTreeRowId = ref<string | null>(null)
const selectorType = ref<'component' | 'column'>('component')
const selectedTableId = ref<string | null>(null)
const selectedColumnId = ref<string | null>(null)

const mockTreeRows = ref<TableTreeRow[]>([])
const nextTreeId = ref(1)

function findTreeRowById(rows: TableTreeRow[], id: string | null): TableTreeRow | null {
  if (!id) return null
  for (const r of rows) {
    if (r.id === id) return r
    if (r.children) {
      const found = findTreeRowById(r.children, id)
      if (found) return found
    }
  }
  return null
}

const selectedTreeRow = computed(() => findTreeRowById(mockTreeRows.value, selectedTreeRowId.value))

watch(selectedTreeRow, (row) => {
  if (!row) {
    selectorType.value = 'component'
    selectedTableId.value = null
    selectedColumnId.value = null
    return
  }

  selectorType.value = row.selectorType ?? 'component'
  const cells = row.cells ?? {}
  const tableId = (cells.tableId as string | undefined) || null
  const columnId = (cells.columnId as string | undefined) || null
  selectedTableId.value = tableId
  selectedColumnId.value = columnId
})

function handleColumnDrop(rawId: string): void {
  if (!rawId)
    return
  const marker = '::column::'
  const idx = rawId.indexOf(marker)
  if (idx === -1)
    return

  const tableId = rawId.slice(0, idx)
  const columnId = rawId.slice(idx + marker.length)
  if (!tableId || !columnId)
    return

  selectedTableId.value = tableId
  selectedColumnId.value = columnId
  updateSelectedRowPresentation()
}

function updateSelectedRowPresentation(): void {
  const id = selectedTreeRowId.value
  if (!id)
    return

  const rows = mockTreeRows.value
  const update = (items: TableTreeRow[]): void => {
    for (const r of items) {
      if (r.id === id) {
        if (!r.cells)
          r.cells = {}

        if (selectorType.value === 'component') {
          r.selectorType = 'component'
          r.cells.tableId = selectedTableId.value ?? ''
          r.cells.columnId = ''

          if (selectedTableId.value) {
            const comp = Endge.domain.getComponent(selectedTableId.value) as any
            const name = comp?.displayName ?? comp?.name ?? comp?.identity ?? selectedTableId.value
            r.label = String(name)
            r.icon = 'table'
          }
          else {
            r.icon = 'table'
          }
        }
        else if (selectorType.value === 'column') {
          r.selectorType = 'column'
          r.icon = 'column'
          r.cells.tableId = selectedTableId.value ?? ''
          r.cells.columnId = selectedColumnId.value ?? ''

          if (selectedTableId.value && selectedColumnId.value) {
            const comp = Endge.domain.getComponent(selectedTableId.value) as any
            const cols = Array.isArray(comp?.columns) ? comp.columns : []
            const col = cols.find((c: any) => String(c?.id) === String(selectedColumnId.value))
            const title = col?.title ?? selectedColumnId.value
            r.label = String(title)
          }
        }
        return
      }
      if (r.children?.length)
        update(r.children)
    }
  }

  update(rows)
  mockTreeRows.value = [...rows]
}

function applyStyles(): void {
  writeToEditor()
  const payload = payloadFromBlocks(blocks.value)
  const css = Endge.styles.compile(payload)
  const existing = document.getElementById(ENDGE_STYLE_PREVIEW_ID)
  if (existing) existing.remove()
  const styleEl = document.createElement('style')
  styleEl.id = ENDGE_STYLE_PREVIEW_ID
  styleEl.textContent = css
  document.head.appendChild(styleEl)
  compiledCssText.value = css || '/* пусто */'
  showCssModal.value = true
}

function removeAppliedStyles(): void {
  document.getElementById(ENDGE_STYLE_PREVIEW_ID)?.remove()
  document.getElementById(ENDGE_GLOBAL_STYLES_ID)?.remove()
}

function syncFromEditor(): void {
  const raw = editor.value?.styles
  const payload = Array.isArray(raw) ? (raw as StyleBlocksPayload) : []
  blocks.value = payloadToBlocks(payload)
}

function writeToEditor(): void {
  if (!editor.value) return
  editor.value.styles = payloadFromBlocks(blocks.value) as unknown as Record<string, unknown>
}

watch(editor, syncFromEditor, { immediate: true })

function addBlock(): void {
  blocks.value = [...blocks.value, { path: [{ type: 'tag-root' }], properties: [] }]
  writeToEditor()
}

function removeBlock(index: number): void {
  blocks.value = blocks.value.filter((_, i) => i !== index)
  writeToEditor()
}

function addSegment(blockIndex: number): void {
  const b = blocks.value[blockIndex]
  if (!b) return
  b.path = [...b.path, { type: 'tag' }]
  blocks.value = [...blocks.value]
  writeToEditor()
}

function removeSegment(blockIndex: number, segIndex: number): void {
  const b = blocks.value[blockIndex]
  if (!b || b.path.length <= 1) return
  b.path = b.path.filter((_, i) => i !== segIndex)
  blocks.value = [...blocks.value]
  writeToEditor()
}

function setSegmentType(blockIndex: number, segIndex: number, type: PathSegmentUI['type']): void {
  const b = blocks.value[blockIndex]
  const seg = b?.path[segIndex]
  if (!seg) return
  seg.type = type
  if (type === 'component') seg.componentId = components.value[0]?.id
  if (type !== 'component') seg.componentId = undefined
  if (type !== 'tag') seg.tagIdentity = undefined
  blocks.value = [...blocks.value]
  writeToEditor()
}

function setSegmentComponentId(blockIndex: number, segIndex: number, id: string): void {
  const seg = blocks.value[blockIndex]?.path[segIndex]
  if (seg && seg.type === 'component') {
    seg.componentId = id
    blocks.value = [...blocks.value]
    writeToEditor()
  }
}

function setSegmentTagIdentity(blockIndex: number, segIndex: number, value: string): void {
  const seg = blocks.value[blockIndex]?.path[segIndex]
  if (seg && seg.type === 'tag') {
    seg.tagIdentity = value || undefined
    blocks.value = [...blocks.value]
    writeToEditor()
  }
}

function addProperty(blockIndex: number): void {
  const b = blocks.value[blockIndex]
  if (!b) return
  b.properties = [...b.properties, { key: '', value: '' }]
  blocks.value = [...blocks.value]
  writeToEditor()
}

function removeProperty(blockIndex: number, propIndex: number): void {
  const b = blocks.value[blockIndex]
  if (!b) return
  b.properties = b.properties.filter((_, i) => i !== propIndex)
  blocks.value = [...blocks.value]
  writeToEditor()
}

function setProperty(blockIndex: number, propIndex: number, field: 'key' | 'value', value: string): void {
  const p = blocks.value[blockIndex]?.properties[propIndex]
  if (!p) return
  p[field] = value
  blocks.value = [...blocks.value]
  writeToEditor()
}

async function save(): Promise<void> {
  writeToEditor()
  await EndgeAdmin.tabs.save()
}

// ===== MOCK TableTreeView для визуального теста =====

const mockTreeColumns: TableTreeColumn[] = [
  { key: 'label', title: 'Selector', width: '100%', align: 'left' },
]

function treeContainsId(rows: TableTreeRow[], id: string | null): boolean {
  if (!id) return false
  for (const r of rows) {
    if (r.id === id) return true
    if (r.children && treeContainsId(r.children, id)) return true
  }
  return false
}

function addTreeRowAfter(rowId: string): void {
  const rows = mockTreeRows.value
  const newRow: TableTreeRow = {
    id: `row-${nextTreeId.value++}`,
    label: 'Новый селектор',
    icon: 'table',
    selectorType: 'component',
    cells: {},
    children: [],
  }

  const insert = (items: TableTreeRow[]): boolean => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === rowId) {
        items.splice(i + 1, 0, newRow)
        return true
      }
      if (items[i].children && insert(items[i].children!))
        return true
    }
    return false
  }

  if (!rows.length) {
    rows.push(newRow)
  } else {
    insert(rows)
  }

  mockTreeRows.value = [...rows]
  selectedTreeRowId.value = newRow.id
}

function addTreeRowRoot(): void {
  const rows = mockTreeRows.value
  const newRow: TableTreeRow = {
    id: `row-${nextTreeId.value++}`,
    label: 'Новый селектор',
    icon: 'table',
    selectorType: 'component',
    cells: {},
    children: [],
  }
  rows.push(newRow)
  mockTreeRows.value = [...rows]
  selectedTreeRowId.value = newRow.id
}

function addTreeRowChild(rowId: string): void {
  const rows = mockTreeRows.value
  const newRow: TableTreeRow = {
    id: `row-${nextTreeId.value++}`,
    label: 'Новый селектор',
    icon: 'table',
    selectorType: 'component',
    cells: {},
    children: [],
  }

  const attach = (items: TableTreeRow[]): boolean => {
    for (const r of items) {
      if (r.id === rowId) {
        if (!r.children)
          r.children = []
        r.children.push(newRow)
        return true
      }
      if (r.children && attach(r.children))
        return true
    }
    return false
  }

  if (!rows.length) {
    rows.push(newRow)
  } else {
    attach(rows)
  }

  mockTreeRows.value = [...rows]
  selectedTreeRowId.value = newRow.id
}

function removeTreeRow(rowId: string): void {
  const filterOut = (items: TableTreeRow[]): TableTreeRow[] =>
    items
      .filter(r => r.id !== rowId)
      .map(r => ({
        ...r,
        children: r.children ? filterOut(r.children) : [],
      }))

  const rows = filterOut(mockTreeRows.value)
  mockTreeRows.value = rows

  if (!treeContainsId(rows, selectedTreeRowId.value))
    selectedTreeRowId.value = null
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-fuchsia-500/10 flex items-center justify-center shrink-0">
        <Palette class="size-4 text-fuchsia-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Стиль - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600">
          Системный
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          aria-label="Применить стили"
          title="Применить стили (скомпилировать и вставить в DOM, показать CSS)"
          @click="applyStyles"
        >
          <Paintbrush class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          aria-label="Удалить применённые стили"
          title="Удалить применённые стили из DOM"
          @click="removeAppliedStyles"
        >
          <Eraser class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          aria-label="Сохранить"
          title="Сохранить"
          :disabled="isBusy"
          @click="save"
        >
          <Loader2 v-if="isBusy" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
        </Button>
      </div>
    </div>

    <Dialog v-model:open="showCssModal">
      <DialogContent class="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Скомпилированный CSS</DialogTitle>
        </DialogHeader>
        <ScrollArea class="flex-1 min-h-0 rounded-md border bg-muted/30 p-3">
          <pre class="text-xs font-mono whitespace-pre-wrap break-words"><code>{{ compiledCssText }}</code></pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <Label>Идентификатор</Label>
          <input
            :value="editor?.identity ?? ''"
            :disabled="isSystem"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="например: default"
            @input="editor && (editor.identity = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>

        <div class="space-y-2">
          <Label>Название</Label>
          <input
            :value="editor?.displayName ?? ''"
            :disabled="isSystem"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Отображаемое имя"
            @input="editor && (editor.displayName = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Дерево селекторов (TableTreeView)</Label>
            <span class="text-[11px] text-muted-foreground">Добавляйте/удаляйте узлы, выбирайте строку для редактирования в инспекторе</span>
          </div>
          <TableTreeView
            v-model="selectedTreeRowId"
            :columns="mockTreeColumns"
            :rows="mockTreeRows"
            dense
            @add:root="addTreeRowRoot"
            @add:after="addTreeRowAfter"
            @add:child="addTreeRowChild"
            @remove="removeTreeRow"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Инспектор выбранного селектора</Label>
            <span class="text-[11px] text-muted-foreground">Настройка типа и источника данных для узла дерева</span>
          </div>
          <div v-if="!selectedTreeRow" class="text-xs text-muted-foreground">
            Выберите строку в дереве селекторов, чтобы настроить её.
          </div>
          <div v-else class="grid gap-3 md:grid-cols-3">
            <div class="space-y-1">
              <Label class="text-xs">Тип селектора</Label>
              <Select
                :model-value="selectorType"
                @update:model-value="(v: 'component' | 'column') => { selectorType = v; updateSelectedRowPresentation() }"
              >
                <SelectTrigger class="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="component">
                    Компонент (таблица)
                  </SelectItem>
                  <SelectItem value="column">
                    Колонка таблицы
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1">
              <Label class="text-xs">Таблица</Label>
              <DomainEntityDropTarget
                :accept-section-types="[DomainSectionType.Component]"
                :show-hint="false"
                @update:model-value="(id: string | null) => { selectedTableId = id; selectedColumnId = null; updateSelectedRowPresentation() }"
              >
                <SearchableSelect
                  :model-value="selectedTableId ?? ''"
                  :options="tableSelectOptions"
                  placeholder="Компонент-таблица"
                  size="compact"
                  trigger-class="h-8 w-full"
                  content-max-height="min(240px, 50vh)"
                  @update:model-value="(v: string) => { selectedTableId = v || null; selectedColumnId = null; updateSelectedRowPresentation() }"
                />
              </DomainEntityDropTarget>
            </div>

            <div class="space-y-1">
              <Label class="text-xs">Колонка</Label>
              <Select
                :model-value="selectedColumnId ?? ''"
                :disabled="selectorType !== 'column' || !selectedTableId"
                @update:model-value="(v: string) => { selectedColumnId = v || null; updateSelectedRowPresentation() }"
              >
                <SelectTrigger class="h-8">
                  <SelectValue placeholder="Колонка таблицы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in selectedTableColumnsOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Блоки стилей</Label>
            <Button variant="outline" size="sm" @click="addBlock">
              <Plus class="size-4 mr-1" />
              Блок
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Путь: компонент (по id) или тег. Свойства - в camelCase.
          </p>

          <div v-for="(block, bi) in blocks" :key="bi" class="rounded-lg border p-3 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-muted-foreground">Блок {{ bi + 1 }}</span>
              <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" @click="removeBlock(bi)">
                <Trash2 class="size-4" />
              </Button>
            </div>

            <div class="space-y-2">
              <Label class="text-xs">Путь (селектор)</Label>
              <div class="flex flex-wrap items-center gap-2">
                <template v-for="(seg, si) in block.path" :key="si">
                  <div class="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1">
                    <Select
                      :model-value="seg.type"
                      @update:model-value="(v: string) => setSegmentType(bi, si, v as PathSegmentUI['type'])"
                    >
                      <SelectTrigger class="h-8 w-[130px] border-0 bg-transparent shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="opt in segmentTypeOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <DomainEntityDropTarget
                      v-if="seg.type === 'component'"
                      :accept-section-types="[DomainSectionType.Component]"
                      :show-hint="false"
                      @update:model-value="(id: string) => setSegmentComponentId(bi, si, id)"
                    >
                      <SearchableSelect
                        :model-value="seg.componentId ?? ''"
                        :options="componentSelectOptions"
                        placeholder="Компонент"
                        size="compact"
                        trigger-class="h-8 w-[180px] border-0 bg-transparent shadow-none"
                        content-max-height="min(240px, 50vh)"
                        @update:model-value="(v: string) => setSegmentComponentId(bi, si, v ?? '')"
                      />
                    </DomainEntityDropTarget>
                    <Input
                      v-if="seg.type === 'tag'"
                      :model-value="seg.tagIdentity ?? ''"
                      placeholder="identity тега"
                      class="h-8 w-28 text-sm"
                      @update:model-value="(v: string) => setSegmentTagIdentity(bi, si, v)"
                    />
                    <Button
                      v-if="block.path.length > 1"
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 shrink-0"
                      @click="removeSegment(bi, si)"
                    >
                      <Trash2 class="size-3" />
                    </Button>
                  </div>
                  <span v-if="si < block.path.length - 1" class="text-muted-foreground">→</span>
                </template>
                <Button variant="outline" size="sm" class="h-8" @click="addSegment(bi)">
                  <Plus class="size-3 mr-1" />
                  Шаг
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label class="text-xs">Свойства (camelCase)</Label>
                <Button variant="ghost" size="sm" class="h-7 text-xs" @click="addProperty(bi)">
                  <Plus class="size-3 mr-1" />
                  Свойство
                </Button>
              </div>
              <div class="space-y-1">
                <div
                  v-for="(prop, pi) in block.properties"
                  :key="pi"
                  class="flex items-center gap-2"
                >
                  <Input
                    :model-value="prop.key"
                    placeholder="backgroundColor"
                    class="h-8 flex-1 font-mono text-sm"
                    @update:model-value="(v: string) => setProperty(bi, pi, 'key', v)"
                  />
                  <Input
                    :model-value="prop.value"
                    placeholder="red / 12px"
                    class="h-8 flex-1 font-mono text-sm"
                    @update:model-value="(v: string) => setProperty(bi, pi, 'value', v)"
                  />
                  <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" @click="removeProperty(bi, pi)">
                    <Trash2 class="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
