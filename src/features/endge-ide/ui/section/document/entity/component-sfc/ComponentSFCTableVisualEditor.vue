<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { SearchableSelectOption } from '@/components/ui/searchable-select'
import type {
  TableCellBindingValueKind,
  TableCellComponentOption,
} from '@/features/endge-ide/model/component-sfc-editor/table-cell-binding.types'
import type { TableVisualColumnPinSide } from '@/features/endge-ide/model/component-sfc-editor/table-column-pin-state'
import type { TableVisualColumnSortDirection } from '@/features/endge-ide/model/component-sfc-editor/table-column-sort-state'
import type {
  ComponentSFCTableCellBindingProjection,
  ComponentSFCTableColumnProjection,
  ComponentSFCTableSourcePatch,
  ComponentSFCTableVisualCellTag,
  ComponentSFCTableVisualProjection,
  ComponentSFCVisualSourceValue,
  RComponentContractInput,
  RComponentDiagnostic,
} from '@endge/core'

import {
  compileComponentSFCExpression,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  getComponentSFCTagInputContract,
  patchComponentSFCTableSource,
} from '@endge/core'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Blocks,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Columns3,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  GripVertical,
  PanelLeft,
  PanelRight,
  Pin,
  PinOff,
  Plus,
  Settings2,
  Table2,
  Tags,
  Trash2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSmartTabSelection, useSmartTabViewState } from '@/components/ui/smart-tabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  parseTableDefaultPin,
  updateTableDefaultPin,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-pin-state'
import {
  isTableColumnSortPath,
  moveTableDefaultSort,
  parseTableColumnSortPaths,
  parseTableDefaultSort,
  renameTableDefaultSortKey,
  serializeTableColumnSortPaths,
  updateTableDefaultSort,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-sort-state'
import {
  parseTableDefaultHidden,
  updateTableDefaultHidden,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-visibility-state'

const props = defineProps<{
  source: string
  projection: ComponentSFCTableVisualProjection
  componentOptions: TableCellComponentOption[]
  diagnostics?: RComponentDiagnostic[]
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'openSource', offset: number): void
}>()

const PAGING_NOT_SET_VALUE = '__paging_not_set__'
const PAGING_SOURCE_VALUE = '__paging_source__'
const DATA_SPLIT_DEFAULT_RATIO = 30
const DATA_SPLIT_MIN_RATIO = 20
const DATA_SPLIT_MAX_RATIO = 55
const DATA_SPLIT_KEYBOARD_STEP = 2
const SORT_COMPARATOR_OPTIONS = [
  { value: 'natural', label: 'Natural' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'boolean', label: 'Boolean' },
] as const

type EditableTableAttributeName
  = 'paging' | 'page-size' | 'page-sizes' | 'default-pin' | 'default-sort' | 'default-hidden'

const mainTab = useSmartTabSelection(
  'component-sfc.visual.active-tab',
  'table',
  ['table', 'columns'] as const,
)
const tableSection = useSmartTabSelection(
  'component-sfc.visual.table-section',
  'general',
  ['general', 'paging', 'visibility', 'pinning', 'sorting'] as const,
)
const tableSections = [
  { id: 'general', label: 'Основное', icon: Settings2 },
  { id: 'paging', label: 'Paging', icon: Table2 },
  { id: 'visibility', label: 'Видимость', icon: Eye },
  { id: 'pinning', label: 'Закрепления', icon: Pin },
  { id: 'sorting', label: 'Сортировка', icon: ArrowUpDown },
] as const
const dataSplitRatio = useSmartTabViewState<number>(
  'component-sfc.visual.table-data-split-ratio',
  {
    defaultValue: () => DATA_SPLIT_DEFAULT_RATIO,
    validate: value => typeof value === 'number'
      && Number.isFinite(value)
      && value >= DATA_SPLIT_MIN_RATIO
      && value <= DATA_SPLIT_MAX_RATIO,
  },
)
const dataSplitContainer = ref<HTMLElement | null>(null)
const dataSplitRatioDraft = ref(dataSplitRatio.value)
const isDataSplitResizing = ref(false)
const removeAllColumnsDialogOpen = ref(false)
const columnContextMenu = ref<{ columnIndex: number, x: number, y: number } | null>(null)
const selectedColumnIndex = ref<number | null>(null)
const dragColumnIndex = ref<number | null>(null)
const dragOverColumnIndex = ref<number | null>(null)
const titleDraft = ref('')
const keyDraft = ref('')
const widthDraft = ref('')
const pageSizeDraft = ref('')
const pageSizesDraft = ref('')
const cellEditorMode = ref<'component' | 'tag' | 'source'>('tag')
const cellBindingDrafts = ref<Record<string, string>>({})
const cellBindingKinds = ref<Record<string, TableCellBindingValueKind>>({})
const cellBindingErrors = ref<Record<string, string>>({})
const sortPathDrafts = ref<string[]>([])

watch(dataSplitRatio, (ratio) => {
  if (!isDataSplitResizing.value) {
    dataSplitRatioDraft.value = ratio
  }
})

interface TableCellBindingField extends RComponentContractInput {
  sourceOnly?: boolean
}

const columns = computed(() => props.projection.columns)
const defaultPinByKey = computed(() => props.projection.defaultPin?.kind === 'expression'
  ? new Map<string, 'left' | 'right'>()
  : parseTableDefaultPin(sourceValueText(props.projection.defaultPin)))
const defaultPinItems = computed(() => Array.from(
  defaultPinByKey.value,
  ([key, side]) => ({ key, side }),
))
const defaultHiddenKeys = computed(() => props.projection.defaultHidden?.kind === 'expression'
  ? new Set<string>()
  : parseTableDefaultHidden(sourceValueText(props.projection.defaultHidden)))
const defaultSortItems = computed(() => props.projection.defaultSort?.kind === 'expression'
  ? []
  : parseTableDefaultSort(sourceValueText(props.projection.defaultSort)))
const tableColumnOptions = computed<SearchableSelectOption[]>(() => columns.value.flatMap((column) => {
  const key = staticColumnKey(column)
  if (!key) {
    return []
  }
  const title = columnTitle(column)
  return [{
    value: key,
    label: title === key ? key : `${title} · ${key}`,
  }]
}))
const columnsByPinSide = computed(() => {
  const grouped: Record<TableVisualColumnPinSide, ComponentSFCTableColumnProjection[]> = {
    left: [],
    none: [],
    right: [],
  }
  for (const column of columns.value) {
    grouped[columnPinSide(column)].push(column)
  }
  return grouped
})
const orderedColumns = computed(() => [
  ...columnsByPinSide.value.left,
  ...columnsByPinSide.value.none,
  ...columnsByPinSide.value.right,
])
const selectedColumn = computed(() => {
  const index = selectedColumnIndex.value
  return index == null ? null : columns.value[index] ?? null
})
const contextMenuColumn = computed(() => {
  const index = columnContextMenu.value?.columnIndex
  return index == null ? null : columns.value[index] ?? null
})
const relevantDiagnostics = computed(() => (
  props.diagnostics?.filter(item => item.sourcePath?.startsWith('template') || item.code.startsWith('sfc-table')) ?? []
))
const errorCount = computed(() => relevantDiagnostics.value.filter(item => item.severity === 'error').length)
const pagingModeValue = computed(() => {
  const value = props.projection.paging
  if (value?.kind === 'expression') {
    return PAGING_SOURCE_VALUE
  }
  const source = sourceValueText(value).trim()
  return source === 'pages' || source === 'virtual' ? source : PAGING_NOT_SET_VALUE
})
const pagingIsSourceOwned = computed(() => props.projection.paging?.kind === 'expression')
const usesPagePaging = computed(() => pagingModeValue.value === 'pages')
const componentSelectOptions = computed<SearchableSelectOption[]>(() => props.componentOptions.map(option => ({
  value: option.value,
  label: option.label,
})))
const tagSelectOptions = computed<SearchableSelectOption[]>(() => (
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS.map(tag => ({ value: tag, label: tag }))
))
const selectedComponentValue = computed(() => {
  const cell = selectedColumn.value?.cell
  return cell?.kind === 'component' && cell.identity
    ? cell.identity
    : null
})
const selectedTagValue = computed(() => selectedColumn.value?.cell.kind === 'tag'
  ? selectedColumn.value.cell.tag
  : null)
const selectedColumnSortComparator = computed(() => {
  const sort = selectedColumn.value?.sort
  if (!sort || sort.kind === 'expression') {
    return 'natural'
  }
  const value = sourceValueText(sort)
  return SORT_COMPARATOR_OPTIONS.some(option => option.value === value) ? value : 'natural'
})
const selectedComponentOption = computed(() => props.componentOptions.find(
  option => option.value === selectedComponentValue.value,
) ?? null)
const selectedCellBindings = computed<ComponentSFCTableCellBindingProjection[]>(() => {
  const cell = selectedColumn.value?.cell
  if (cellEditorMode.value === 'component' && cell?.kind === 'component') {
    return cell.bindings
  }
  if (cellEditorMode.value === 'tag' && cell?.kind === 'tag') {
    return cell.bindings
  }
  return []
})
const cellBindingFields = computed<TableCellBindingField[]>(() => {
  const cell = selectedColumn.value?.cell
  const contract = cellEditorMode.value === 'component' && cell?.kind === 'component'
    ? selectedComponentOption.value?.inputs ?? []
    : cellEditorMode.value === 'tag' && cell?.kind === 'tag'
      ? getComponentSFCTagInputContract(cell.tag)
      : []
  const knownNames = new Set(contract.map(input => input.name))
  const sourceOnly = selectedCellBindings.value
    .filter(binding => !knownNames.has(binding.name))
    .map(binding => ({
      name: binding.name,
      type: 'Source',
      optional: true,
      sourceOnly: true,
    }))

  return [...contract, ...sourceOnly]
})

function isSourceOwnedCell(column: ComponentSFCTableColumnProjection | null | undefined): boolean {
  return column?.cell.kind === 'source'
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
    cellEditorMode.value = column?.cell.kind === 'component'
      ? 'component'
      : column?.cell.kind === 'tag'
        ? 'tag'
        : 'source'
    sortPathDrafts.value = parseTableColumnSortPaths(sourceValueText(column?.sortBy))
    syncCellBindingDrafts(column)
  },
  { immediate: true },
)

watch(
  () => [
    props.projection.pageSize,
    props.projection.pageSizes,
  ] as const,
  ([pageSize, pageSizes]) => {
    pageSizeDraft.value = sourceValueText(pageSize)
    pageSizesDraft.value = sourceValueText(pageSizes)
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

function tableSectionSummary(sectionId: typeof tableSections[number]['id']): string | null {
  switch (sectionId) {
    case 'general':
      return null
    case 'paging':
      if (pagingIsSourceOwned.value) {
        return 'Source'
      }
      return pagingModeValue.value === 'pages'
        ? 'Pages'
        : pagingModeValue.value === 'virtual'
          ? 'Virtual'
          : null
    case 'visibility': {
      if (props.projection.defaultHidden?.kind === 'expression') {
        return 'Source'
      }
      const visibleCount = columns.value.filter(column => !isColumnHiddenByDefault(column)).length
      return columns.value.length ? `${visibleCount}/${columns.value.length}` : null
    }
    case 'pinning':
      if (props.projection.defaultPin?.kind === 'expression') {
        return 'Source'
      }
      return defaultPinItems.value.length ? String(defaultPinItems.value.length) : null
    case 'sorting':
      if (props.projection.defaultSort?.kind === 'expression') {
        return 'Source'
      }
      return defaultSortItems.value.length ? String(defaultSortItems.value.length) : null
  }
}

function updateTableSection(value: string | null): void {
  if (tableSections.some(section => section.id === value)) {
    tableSection.value = value as typeof tableSection.value
  }
}

function syncCellBindingDrafts(column: ComponentSFCTableColumnProjection | null): void {
  const cell = column?.cell
  const bindings = cell?.kind === 'component' || cell?.kind === 'tag' ? cell.bindings : []
  cellBindingDrafts.value = Object.fromEntries(
    bindings.map(binding => [binding.name, sourceValueText(binding.value)]),
  )
  cellBindingKinds.value = Object.fromEntries(
    bindings.map(binding => [
      binding.name,
      binding.value.kind === 'expression' ? 'expression' : 'literal',
    ]),
  )
  cellBindingErrors.value = {}
}

function currentCellBinding(name: string): ComponentSFCTableCellBindingProjection | null {
  return selectedCellBindings.value.find(binding => binding.name === name) ?? null
}

function cellBindingKind(name: string): TableCellBindingValueKind {
  return cellBindingKinds.value[name]
    ?? (currentCellBinding(name)?.value.kind === 'expression' ? 'expression' : 'literal')
}

function resetCellBinding(name: string): void {
  const binding = currentCellBinding(name)
  cellBindingDrafts.value[name] = binding ? sourceValueText(binding.value) : ''
  cellBindingKinds.value[name] = binding?.value.kind === 'expression' ? 'expression' : 'literal'
  delete cellBindingErrors.value[name]
}

function setCellBindingKind(name: string, valueKind: TableCellBindingValueKind): void {
  if (cellBindingKind(name) === valueKind) {
    return
  }
  cellBindingKinds.value[name] = valueKind
  if (cellBindingDrafts.value[name]?.trim()) {
    commitCellBinding(name)
  }
}

function commitCellBinding(name: string): void {
  const column = selectedColumn.value
  if (!column || isSourceOwnedCell(column)) {
    return
  }

  const rawValue = cellBindingDrafts.value[name] ?? ''
  const value = rawValue.trim() || null
  const valueKind = cellBindingKind(name)
  const current = currentCellBinding(name)
  const currentKind = current?.value.kind === 'expression' ? 'expression' : 'literal'
  const currentValue = current ? sourceValueText(current.value) : ''

  if ((value ?? '') === currentValue && (!current || currentKind === valueKind)) {
    delete cellBindingErrors.value[name]
    return
  }
  if (valueKind === 'expression' && value) {
    const validation = compileComponentSFCExpression(value, {
      sourcePath: `template.Table.Column.${name}`,
    })
    const error = validation.diagnostics.find(item => item.severity === 'error')
    if (error) {
      cellBindingErrors.value[name] = error.message
      return
    }
  }

  if (applyPatch({
    type: 'set-column-cell-attribute',
    columnIndex: column.index,
    name,
    value,
    valueKind,
  })) {
    delete cellBindingErrors.value[name]
  }
}

function handleCellBindingFocusOut(event: FocusEvent, name: string): void {
  const owner = event.currentTarget as HTMLElement | null
  if (owner?.contains(event.relatedTarget as Node | null)) {
    return
  }
  commitCellBinding(name)
}

function columnTitle(column: ComponentSFCTableColumnProjection): string {
  return sourceValueText(column.title) || sourceValueText(column.key) || `Колонка ${column.index + 1}`
}

function staticColumnKey(column: ComponentSFCTableColumnProjection): string | null {
  if (column.key?.kind !== 'literal') {
    return null
  }
  return sourceValueText(column.key).trim() || null
}

function columnPinSide(column: ComponentSFCTableColumnProjection): TableVisualColumnPinSide {
  const key = staticColumnKey(column)
  return key ? defaultPinByKey.value.get(key) ?? 'none' : 'none'
}

function isColumnHiddenByDefault(column: ComponentSFCTableColumnProjection): boolean {
  const key = staticColumnKey(column)
  return key ? defaultHiddenKeys.value.has(key) : false
}

function columnSortDirection(column: ComponentSFCTableColumnProjection): TableVisualColumnSortDirection | null {
  const key = staticColumnKey(column)
  return key ? defaultSortItems.value.find(item => item.key === key)?.direction ?? null : null
}

function columnSortPriority(column: ComponentSFCTableColumnProjection): number | null {
  const key = staticColumnKey(column)
  const index = key ? defaultSortItems.value.findIndex(item => item.key === key) : -1
  return index >= 0 ? index + 1 : null
}

function isColumnSortable(column: ComponentSFCTableColumnProjection): boolean {
  if (column.sortable?.kind === 'boolean') {
    return column.sortable.value
  }
  const value = sourceValueText(column.sortable).trim()
  return Boolean(value && value !== 'false')
}

function columnSortEditingHint(column: ComponentSFCTableColumnProjection): string | null {
  if (!staticColumnKey(column)) {
    return 'Для сортировки колонке нужен статический key.'
  }
  if (!canEdit(props.projection.defaultSort)) {
    return 'Сортировка управляется динамическим выражением в Source.'
  }
  if (!canEdit(props.projection.sortMode)) {
    return 'Режим сортировки управляется динамическим выражением в Source.'
  }
  if (sourceValueText(props.projection.sortMode).trim() === 'disabled') {
    return 'Сортировка отключена атрибутом sort-mode="disabled".'
  }
  return null
}

function canSetColumnSortDirection(column: ComponentSFCTableColumnProjection): boolean {
  return !columnSortDirectionEditingHint(column)
}

function columnSortDetailsEditingHint(column: ComponentSFCTableColumnProjection): string | null {
  if (!canEdit(column.sort) || !canEdit(column.sortBy)) {
    return 'Comparator или sort-by управляется динамическим выражением в Source.'
  }
  if (!isColumnSortable(column) && !canEdit(column.sortable)) {
    return 'Атрибут sortable управляется динамическим выражением в Source.'
  }
  return null
}

function columnSortDirectionEditingHint(column: ComponentSFCTableColumnProjection): string | null {
  const commonHint = columnSortEditingHint(column)
  if (commonHint) {
    return commonHint
  }
  if (!isColumnSortable(column) && !canEdit(column.sortable)) {
    return 'Атрибут sortable управляется динамическим выражением в Source.'
  }
  return null
}

function canEditColumnVisibility(column: ComponentSFCTableColumnProjection): boolean {
  return Boolean(staticColumnKey(column) && canEdit(props.projection.defaultHidden))
}

function columnVisibilityEditingHint(column: ComponentSFCTableColumnProjection): string | null {
  if (!staticColumnKey(column)) {
    return 'Для настройки видимости колонке нужен статический key.'
  }
  if (!canEdit(props.projection.defaultHidden)) {
    return 'Видимость управляется динамическим выражением в Source.'
  }
  return null
}

function canEditColumnPin(column: ComponentSFCTableColumnProjection): boolean {
  return Boolean(
    staticColumnKey(column)
    && canEdit(props.projection.defaultPin)
    && canEdit(props.projection.columnPin)
    && sourceValueText(props.projection.columnPin).trim() !== 'disabled',
  )
}

function columnPinEditingHint(column: ComponentSFCTableColumnProjection): string | null {
  if (!staticColumnKey(column)) {
    return 'Для закрепления колонке нужен статический key.'
  }
  if (!canEdit(props.projection.defaultPin) || !canEdit(props.projection.columnPin)) {
    return 'Закрепление управляется динамическим выражением в Source.'
  }
  if (sourceValueText(props.projection.columnPin).trim() === 'disabled') {
    return 'Закрепление отключено атрибутом column-pin="disabled".'
  }
  return null
}

function columnByStaticKey(key: string): ComponentSFCTableColumnProjection | null {
  return columns.value.find(column => staticColumnKey(column) === key) ?? null
}

function singleSelectValue(value: string | string[] | null): string | null {
  return typeof value === 'string' && value ? value : null
}

function defaultPinColumnOptions(currentKey = ''): SearchableSelectOption[] {
  const occupied = new Set(defaultPinByKey.value.keys())
  return tableColumnOptions.value.filter((option) => {
    if (option.value === currentKey) {
      return true
    }
    const column = columnByStaticKey(option.value)
    return !occupied.has(option.value) && Boolean(column && canEditColumnPin(column))
  })
}

function defaultSortColumnOptions(currentKey = ''): SearchableSelectOption[] {
  const occupied = new Set(defaultSortItems.value.map(item => item.key))
  const sortMode = sourceValueText(props.projection.sortMode).trim()
  if (!currentKey && sortMode === 'single' && occupied.size > 0) {
    return []
  }
  return tableColumnOptions.value.filter((option) => {
    if (option.value === currentKey) {
      return true
    }
    const column = columnByStaticKey(option.value)
    return !occupied.has(option.value) && Boolean(column && !columnSortDirectionEditingHint(column))
  })
}

function canEditDefaultPinRule(key: string): boolean {
  const column = columnByStaticKey(key)
  return Boolean(column && !columnPinEditingHint(column))
}

function canEditDefaultSortRule(key: string): boolean {
  const column = columnByStaticKey(key)
  return Boolean(column && !columnSortDirectionEditingHint(column))
}

function isColumnDraggable(column: ComponentSFCTableColumnProjection): boolean {
  return columnsByPinSide.value[columnPinSide(column)].length > 1
}

function isFirstColumnOnPinSide(column: ComponentSFCTableColumnProjection): boolean {
  return columnsByPinSide.value[columnPinSide(column)][0]?.index === column.index
}

function showDividerBeforeColumn(column: ComponentSFCTableColumnProjection): boolean {
  if (!isFirstColumnOnPinSide(column)) {
    return false
  }
  const side = columnPinSide(column)
  if (side === 'none') {
    return columnsByPinSide.value.left.length > 0
  }
  if (side === 'right') {
    return columnsByPinSide.value.left.length > 0 || columnsByPinSide.value.none.length > 0
  }
  return false
}

function columnPinLabel(column: ComponentSFCTableColumnProjection): string {
  return columnPinSide(column) === 'left' ? 'Закреплена слева' : 'Закреплена справа'
}

function canEdit(value: ComponentSFCVisualSourceValue | null | undefined): boolean {
  return value?.kind !== 'expression'
}

function applyPatch(patch: ComponentSFCTableSourcePatch): boolean {
  return applyPatches([patch])
}

/** Применяет связанные Table-настройки атомарно и публикует только итоговый Source. */
function applyPatches(patches: ComponentSFCTableSourcePatch[]): boolean {
  let nextSource = props.source
  let changed = false

  for (const patch of patches) {
    const result = patchComponentSFCTableSource(nextSource, patch)
    if (!result.ok) {
      toast.error('Не удалось изменить Table Source', {
        description: result.message,
      })
      return false
    }
    nextSource = result.source
    changed ||= result.changed
  }

  if (changed) {
    emit('update:source', nextSource)
  }
  return true
}

function tableProjectionValue(name: EditableTableAttributeName): ComponentSFCVisualSourceValue | null {
  switch (name) {
    case 'paging':
      return props.projection.paging
    case 'page-size':
      return props.projection.pageSize
    case 'page-sizes':
      return props.projection.pageSizes
    case 'default-pin':
      return props.projection.defaultPin
    case 'default-sort':
      return props.projection.defaultSort
    case 'default-hidden':
      return props.projection.defaultHidden
  }
  return null
}

function commitTableAttribute(name: EditableTableAttributeName, rawValue: string): void {
  const currentValue = tableProjectionValue(name)
  if (!canEdit(currentValue)) {
    return
  }
  const value = rawValue.trim() || null
  if ((value ?? '') === sourceValueText(currentValue)) {
    return
  }
  applyPatch({ type: 'set-table-attribute', name, value })
}

function updatePaging(value: string | null): void {
  if (!value || value === PAGING_SOURCE_VALUE || pagingIsSourceOwned.value) {
    return
  }

  const paging = value === PAGING_NOT_SET_VALUE ? null : value
  const patches: ComponentSFCTableSourcePatch[] = [
    { type: 'set-table-attribute', name: 'paging', value: paging },
  ]

  if (paging !== 'pages') {
    patches.push(
      { type: 'set-table-attribute', name: 'page-size', value: null },
      { type: 'set-table-attribute', name: 'page-sizes', value: null },
    )
  }

  applyPatches(patches)
}

function commitPageSize(): void {
  const value = pageSizeDraft.value.trim()
  if (value && (!/^\d+$/.test(value) || Number(value) < 1)) {
    pageSizeDraft.value = sourceValueText(props.projection.pageSize)
    toast.warning('Размер страницы должен быть целым числом больше нуля')
    return
  }
  commitTableAttribute('page-size', value)
}

function commitPageSizes(): void {
  const value = pageSizesDraft.value.trim()
  const parts = value.split(',').map(item => item.trim()).filter(Boolean)
  if (value && (parts.length === 0 || parts.some(item => !/^\d+$/.test(item) || Number(item) < 1))) {
    pageSizesDraft.value = sourceValueText(props.projection.pageSizes)
    toast.warning('Используйте положительные числа через запятую')
    return
  }

  const normalized = value ? [...new Set(parts)].join(',') : ''
  pageSizesDraft.value = normalized
  commitTableAttribute('page-sizes', normalized)
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
  removeColumnAt(index)
}

function removeColumnAt(index: number): void {
  const column = columns.value[index]
  if (!column) {
    return
  }

  const patches: ComponentSFCTableSourcePatch[] = []
  const key = staticColumnKey(column)
  if (key && canEdit(props.projection.defaultPin)) {
    const current = sourceValueText(props.projection.defaultPin)
    const next = updateTableDefaultPin(current, key, null)
    if ((next ?? '') !== current) {
      patches.push({ type: 'set-table-attribute', name: 'default-pin', value: next })
    }
  }
  if (key && canEdit(props.projection.defaultHidden)) {
    const current = sourceValueText(props.projection.defaultHidden)
    const next = updateTableDefaultHidden(current, key, false)
    if ((next ?? '') !== current) {
      patches.push({ type: 'set-table-attribute', name: 'default-hidden', value: next })
    }
  }
  if (key && canEdit(props.projection.defaultSort)) {
    const current = sourceValueText(props.projection.defaultSort)
    const next = updateTableDefaultSort(current, key, null)
    if ((next ?? '') !== current) {
      patches.push({ type: 'set-table-attribute', name: 'default-sort', value: next })
    }
  }
  patches.push({ type: 'remove-column', columnIndex: index })

  if (applyPatches(patches)) {
    selectedColumnIndex.value = columns.value.length <= 1 ? null : Math.min(index, columns.value.length - 2)
  }
}

function removeAllColumns(): void {
  const patches: ComponentSFCTableSourcePatch[] = []
  if (canEdit(props.projection.defaultPin) && sourceValueText(props.projection.defaultPin).trim()) {
    patches.push({ type: 'set-table-attribute', name: 'default-pin', value: null })
  }
  if (canEdit(props.projection.defaultHidden) && sourceValueText(props.projection.defaultHidden).trim()) {
    patches.push({ type: 'set-table-attribute', name: 'default-hidden', value: null })
  }
  if (canEdit(props.projection.defaultSort) && sourceValueText(props.projection.defaultSort).trim()) {
    patches.push({ type: 'set-table-attribute', name: 'default-sort', value: null })
  }
  patches.push(...columns.value.map((_, index) => ({
    type: 'remove-column' as const,
    columnIndex: columns.value.length - index - 1,
  })))

  if (!patches.length) {
    removeAllColumnsDialogOpen.value = false
    return
  }

  if (applyPatches(patches)) {
    selectedColumnIndex.value = null
    removeAllColumnsDialogOpen.value = false
  }
}

function setColumnPin(index: number, side: 'left' | 'right' | null): void {
  const column = columns.value[index]
  if (!column) {
    return
  }
  const unavailableReason = columnPinEditingHint(column)
  const key = staticColumnKey(column)
  if (unavailableReason || !key) {
    toast.warning('Закрепление недоступно', { description: unavailableReason ?? undefined })
    return
  }

  const current = sourceValueText(props.projection.defaultPin)
  const next = updateTableDefaultPin(current, key, side)
  if ((next ?? '') !== current) {
    applyPatch({ type: 'set-table-attribute', name: 'default-pin', value: next })
  }
}

function addDefaultPinRule(value: string | string[] | null): void {
  const key = singleSelectValue(value)
  const column = key ? columnByStaticKey(key) : null
  if (column) {
    setColumnPin(column.index, 'left')
  }
}

function changeDefaultPinRuleKey(currentKey: string, value: string | string[] | null): void {
  const nextKey = singleSelectValue(value)
  const column = nextKey ? columnByStaticKey(nextKey) : null
  const side = defaultPinByKey.value.get(currentKey)
  if (!nextKey || nextKey === currentKey || !column || !side || columnPinEditingHint(column)) {
    return
  }

  const current = sourceValueText(props.projection.defaultPin)
  const withoutCurrent = updateTableDefaultPin(current, currentKey, null) ?? ''
  const next = updateTableDefaultPin(withoutCurrent, nextKey, side)
  applyPatch({ type: 'set-table-attribute', name: 'default-pin', value: next })
}

function setDefaultPinRuleSide(key: string, side: 'left' | 'right'): void {
  const column = columnByStaticKey(key)
  if (column) {
    setColumnPin(column.index, side)
  }
}

function removeDefaultPinRule(key: string): void {
  if (!canEdit(props.projection.defaultPin)) {
    return
  }
  const current = sourceValueText(props.projection.defaultPin)
  const next = updateTableDefaultPin(current, key, null)
  if ((next ?? '') !== current) {
    applyPatch({ type: 'set-table-attribute', name: 'default-pin', value: next })
  }
}

function setColumnHiddenByDefault(index: number, hidden: boolean): void {
  const column = columns.value[index]
  if (!column) {
    return
  }
  const unavailableReason = columnVisibilityEditingHint(column)
  const key = staticColumnKey(column)
  if (unavailableReason || !key) {
    toast.warning('Видимость недоступна', { description: unavailableReason ?? undefined })
    return
  }

  const current = sourceValueText(props.projection.defaultHidden)
  const next = updateTableDefaultHidden(current, key, hidden)
  if ((next ?? '') !== current) {
    applyPatch({ type: 'set-table-attribute', name: 'default-hidden', value: next })
  }
}

function setColumnDefaultSort(
  index: number,
  direction: TableVisualColumnSortDirection | null,
): void {
  const column = columns.value[index]
  if (!column) {
    return
  }
  const unavailableReason = columnSortEditingHint(column)
  const key = staticColumnKey(column)
  if (unavailableReason || !key) {
    toast.warning('Сортировка недоступна', { description: unavailableReason ?? undefined })
    return
  }
  if (direction && !isColumnSortable(column) && !canEdit(column.sortable)) {
    toast.warning('Сортировка недоступна', {
      description: 'Атрибут sortable управляется динамическим выражением в Source.',
    })
    return
  }

  const current = sourceValueText(props.projection.defaultSort)
  const next = updateTableDefaultSort(current, key, direction)
  const sortPathPatches = collectSelectedColumnSortPathPreservationPatches(column)
  if (!sortPathPatches) {
    return
  }
  const patches: ComponentSFCTableSourcePatch[] = [...sortPathPatches]
  if (direction && !isColumnSortable(column)) {
    patches.push({
      type: 'set-column-attribute',
      columnIndex: column.index,
      name: 'sortable',
      value: 'true',
    })
  }
  if ((next ?? '') !== current) {
    patches.push({ type: 'set-table-attribute', name: 'default-sort', value: next })
  }
  if (patches.length) {
    applyPatches(patches)
  }
}

function updateColumnSortComparator(value: string | null): void {
  const column = selectedColumn.value
  if (!column || !value || columnSortDetailsEditingHint(column)) {
    return
  }
  const sortPathPatches = collectSelectedColumnSortPathPreservationPatches(column)
  if (!sortPathPatches) {
    return
  }
  const patches: ComponentSFCTableSourcePatch[] = [...sortPathPatches]
  if (!isColumnSortable(column)) {
    patches.push({
      type: 'set-column-attribute',
      columnIndex: column.index,
      name: 'sortable',
      value: 'true',
    })
  }
  patches.push({
    type: 'set-column-attribute',
    columnIndex: column.index,
    name: 'sort',
    value: value === 'natural' ? null : value,
  })
  applyPatches(patches)
}

/** Сохраняет незакоммиченные chains в той же Source transaction, что и adjacent sort controls. */
function collectSelectedColumnSortPathPreservationPatches(
  column: ComponentSFCTableColumnProjection,
): ComponentSFCTableSourcePatch[] | null {
  if (
    mainTab.value !== 'columns'
    || selectedColumn.value?.index !== column.index
    || !canEdit(column.sortBy)
  ) {
    return []
  }

  const paths = sortPathDrafts.value.map(path => path.trim()).filter(Boolean)
  if (paths.some(path => !isTableColumnSortPath(path))) {
    toast.warning('Некорректная цепочка поля', {
      description: 'Используйте простой dot path без row., пробелов, массивов и selectors.',
    })
    return null
  }

  const value = serializeTableColumnSortPaths(paths)
  if ((value ?? '') === sourceValueText(column.sortBy)) {
    return []
  }

  return [{
    type: 'set-column-attribute',
    columnIndex: column.index,
    name: 'sort-by',
    value,
  }]
}

function applyColumnSortPaths(paths: readonly string[]): void {
  const column = selectedColumn.value
  if (!column || columnSortDetailsEditingHint(column)) {
    return
  }
  const normalizedPaths = paths.map(path => path.trim()).filter(Boolean)
  const patches: ComponentSFCTableSourcePatch[] = []
  if (normalizedPaths.length && !isColumnSortable(column)) {
    patches.push({
      type: 'set-column-attribute',
      columnIndex: column.index,
      name: 'sortable',
      value: 'true',
    })
  }
  patches.push({
    type: 'set-column-attribute',
    columnIndex: column.index,
    name: 'sort-by',
    value: serializeTableColumnSortPaths(normalizedPaths),
  })
  if (applyPatches(patches)) {
    sortPathDrafts.value = normalizedPaths
  }
}

function addColumnSortPath(): void {
  const column = selectedColumn.value
  if (!column || columnSortDetailsEditingHint(column)) {
    return
  }
  sortPathDrafts.value = [...sortPathDrafts.value, '']
}

function resetColumnSortPaths(): void {
  sortPathDrafts.value = parseTableColumnSortPaths(sourceValueText(selectedColumn.value?.sortBy))
}

function commitColumnSortPath(index: number): void {
  const value = sortPathDrafts.value[index]?.trim() ?? ''
  if (!value) {
    removeColumnSortPath(index)
    return
  }
  if (!isTableColumnSortPath(value)) {
    toast.warning('Некорректная цепочка поля', {
      description: 'Используйте простой dot path без row., пробелов, массивов и selectors.',
    })
    resetColumnSortPaths()
    return
  }
  const next = [...sortPathDrafts.value]
  next[index] = value
  applyColumnSortPaths(next)
}

function removeColumnSortPath(index: number): void {
  const next = [...sortPathDrafts.value]
  next.splice(index, 1)
  applyColumnSortPaths(next)
}

function moveColumnSortPath(index: number, offset: -1 | 1): void {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= sortPathDrafts.value.length) {
    return
  }
  const next = [...sortPathDrafts.value]
  ;[next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!]
  applyColumnSortPaths(next)
}

function addDefaultSortRule(value: string | string[] | null): void {
  const key = singleSelectValue(value)
  const column = key ? columnByStaticKey(key) : null
  if (column) {
    setColumnDefaultSort(column.index, 'asc')
  }
}

function changeDefaultSortRuleKey(currentKey: string, value: string | string[] | null): void {
  const nextKey = singleSelectValue(value)
  const column = nextKey ? columnByStaticKey(nextKey) : null
  if (!nextKey || nextKey === currentKey || !column || columnSortDirectionEditingHint(column)) {
    return
  }

  const current = sourceValueText(props.projection.defaultSort)
  const next = renameTableDefaultSortKey(current, currentKey, nextKey)
  const patches: ComponentSFCTableSourcePatch[] = []
  if (!isColumnSortable(column)) {
    patches.push({
      type: 'set-column-attribute',
      columnIndex: column.index,
      name: 'sortable',
      value: 'true',
    })
  }
  if ((next ?? '') !== current) {
    patches.push({ type: 'set-table-attribute', name: 'default-sort', value: next })
  }
  if (patches.length) {
    applyPatches(patches)
  }
}

function setDefaultSortRuleDirection(key: string, direction: TableVisualColumnSortDirection): void {
  const column = columnByStaticKey(key)
  if (column) {
    setColumnDefaultSort(column.index, direction)
  }
}

function removeDefaultSortRule(key: string): void {
  const column = columnByStaticKey(key)
  if (column) {
    setColumnDefaultSort(column.index, null)
    return
  }
  if (!canEdit(props.projection.defaultSort)) {
    return
  }
  const current = sourceValueText(props.projection.defaultSort)
  const next = updateTableDefaultSort(current, key, null)
  if ((next ?? '') !== current) {
    applyPatch({ type: 'set-table-attribute', name: 'default-sort', value: next })
  }
}

function moveDefaultSortRule(key: string, offset: -1 | 1): void {
  const column = columnByStaticKey(key)
  if (column) {
    moveColumnSortPriority(column.index, offset)
  }
}

function moveColumnSortPriority(index: number, offset: -1 | 1): void {
  const column = columns.value[index]
  const key = column ? staticColumnKey(column) : null
  if (!column || !key || columnSortEditingHint(column)) {
    return
  }
  const current = sourceValueText(props.projection.defaultSort)
  const next = moveTableDefaultSort(current, key, offset)
  if ((next ?? '') !== current) {
    applyPatch({ type: 'set-table-attribute', name: 'default-sort', value: next })
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
  const patches: ComponentSFCTableSourcePatch[] = [{
    type: 'set-column-attribute',
    columnIndex: column.index,
    name,
    value: normalized,
  }]

  if (name === 'key' && canEdit(props.projection.defaultPin)) {
    const oldKey = staticColumnKey(column)
    const pinSide = columnPinSide(column)
    const nextKey = value.trim()
    if (oldKey && nextKey && pinSide !== 'none') {
      const withoutOldKey = updateTableDefaultPin(
        sourceValueText(props.projection.defaultPin),
        oldKey,
        null,
      )
      const withNewKey = updateTableDefaultPin(withoutOldKey ?? '', nextKey, pinSide)
      patches.push({ type: 'set-table-attribute', name: 'default-pin', value: withNewKey })
    }
  }

  if (name === 'key' && canEdit(props.projection.defaultHidden)) {
    const oldKey = staticColumnKey(column)
    const nextKey = value.trim()
    if (oldKey && nextKey && isColumnHiddenByDefault(column)) {
      const withoutOldKey = updateTableDefaultHidden(
        sourceValueText(props.projection.defaultHidden),
        oldKey,
        false,
      )
      const withNewKey = updateTableDefaultHidden(withoutOldKey ?? '', nextKey, true)
      patches.push({ type: 'set-table-attribute', name: 'default-hidden', value: withNewKey })
    }
  }

  if (name === 'key' && canEdit(props.projection.defaultSort)) {
    const oldKey = staticColumnKey(column)
    const nextKey = value.trim()
    if (oldKey && nextKey && columnSortDirection(column)) {
      const current = sourceValueText(props.projection.defaultSort)
      const next = renameTableDefaultSortKey(current, oldKey, nextKey)
      if ((next ?? '') !== current) {
        patches.push({ type: 'set-table-attribute', name: 'default-sort', value: next })
      }
    }
  }

  applyPatches(patches)
}

function updateComponent(value: string | string[] | null): void {
  const column = selectedColumn.value
  if (!column || !value || Array.isArray(value) || isSourceOwnedCell(column)) {
    return
  }
  if (column.cell.kind === 'component' && column.cell.identity === value) {
    return
  }
  applyPatch({
    type: 'set-column-component',
    columnIndex: column.index,
    identity: value,
    syntax: column.cell.kind === 'component' || column.cell.kind === 'tag'
      ? column.cell.syntax
      : undefined,
  })
}

function updateTag(value: string | string[] | null): void {
  const column = selectedColumn.value
  if (!column || !value || Array.isArray(value) || isSourceOwnedCell(column)) {
    return
  }
  const tag = value as ComponentSFCTableVisualCellTag
  if (column.cell.kind === 'tag' && column.cell.tag === value) {
    return
  }
  applyPatch({
    type: 'set-column-tag',
    columnIndex: column.index,
    tag,
    syntax: column.cell.kind === 'component' || column.cell.kind === 'tag'
      ? column.cell.syntax
      : undefined,
  })
}

function selectCellEditorMode(mode: 'component' | 'tag' | 'source'): void {
  if (mode === 'source' || !isSourceOwnedCell(selectedColumn.value)) {
    cellEditorMode.value = mode
  }
}

function openSelectedColumnSource(): void {
  if (selectedColumn.value) {
    emit('openSource', selectedColumn.value.sourceRange.start)
  }
}

function openColumnContextMenu(event: MouseEvent, columnIndex: number): void {
  event.preventDefault()
  event.stopPropagation()
  selectedColumnIndex.value = columnIndex
  columnContextMenu.value = {
    columnIndex,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 248)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 272)),
  }
}

function openColumnContextMenuFromKeyboard(event: KeyboardEvent, columnIndex: number): void {
  if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
    return
  }
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  columnContextMenu.value = {
    columnIndex,
    x: Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - 248)),
    y: Math.max(8, Math.min(rect?.bottom ?? 8, window.innerHeight - 272)),
  }
  selectedColumnIndex.value = columnIndex
}

function closeColumnContextMenu(): void {
  columnContextMenu.value = null
}

function removeColumnFromContextMenu(): void {
  const index = columnContextMenu.value?.columnIndex
  closeColumnContextMenu()
  if (index != null) {
    removeColumnAt(index)
  }
}

function setContextMenuColumnPin(side: 'left' | 'right' | null): void {
  const index = columnContextMenu.value?.columnIndex
  closeColumnContextMenu()
  if (index != null) {
    setColumnPin(index, side)
  }
}

function toggleContextMenuColumnVisibility(): void {
  const index = columnContextMenu.value?.columnIndex
  const column = contextMenuColumn.value
  closeColumnContextMenu()
  if (index != null && column) {
    setColumnHiddenByDefault(index, !isColumnHiddenByDefault(column))
  }
}

function onColumnDragStart(event: DragEvent, index: number): void {
  const column = columns.value[index]
  if (!column || !isColumnDraggable(column)) {
    event.preventDefault()
    return
  }
  dragColumnIndex.value = index
  dragOverColumnIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onColumnDragOver(event: DragEvent, index: number): void {
  const fromIndex = dragColumnIndex.value
  const fromColumn = fromIndex == null ? null : columns.value[fromIndex]
  const toColumn = columns.value[index]
  if (!fromColumn || !toColumn || columnPinSide(fromColumn) !== columnPinSide(toColumn)) {
    dragOverColumnIndex.value = null
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none'
    }
    return
  }
  event.preventDefault()
  dragOverColumnIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onColumnDrop(event: DragEvent, toIndex: number): void {
  event.preventDefault()
  const fromIndex = dragColumnIndex.value
  const fromColumn = fromIndex == null ? null : columns.value[fromIndex]
  const toColumn = columns.value[toIndex]
  if (
    fromIndex != null
    && fromIndex !== toIndex
    && fromColumn
    && toColumn
    && columnPinSide(fromColumn) === columnPinSide(toColumn)
  ) {
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

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, button, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"]'))
}

function clampDataSplitRatio(ratio: number): number {
  return Math.min(DATA_SPLIT_MAX_RATIO, Math.max(DATA_SPLIT_MIN_RATIO, ratio))
}

function updateDataSplitRatio(clientX: number): void {
  const container = dataSplitContainer.value
  if (!container) {
    return
  }

  const rect = container.getBoundingClientRect()
  if (rect.width <= 0) {
    return
  }

  dataSplitRatioDraft.value = clampDataSplitRatio(((clientX - rect.left) / rect.width) * 100)
}

function handleDataSplitPointerMove(event: PointerEvent): void {
  if (isDataSplitResizing.value) {
    updateDataSplitRatio(event.clientX)
  }
}

function endDataSplitResize(): void {
  if (!isDataSplitResizing.value) {
    return
  }

  isDataSplitResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', handleDataSplitPointerMove)
  window.removeEventListener('pointerup', endDataSplitResize)
  window.removeEventListener('pointercancel', endDataSplitResize)
  dataSplitRatio.value = dataSplitRatioDraft.value
}

function beginDataSplitResize(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  isDataSplitResizing.value = true
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  updateDataSplitRatio(event.clientX)
  window.addEventListener('pointermove', handleDataSplitPointerMove)
  window.addEventListener('pointerup', endDataSplitResize)
  window.addEventListener('pointercancel', endDataSplitResize)
}

function resizeDataSplitByKeyboard(event: KeyboardEvent): void {
  const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
  if (!direction) {
    return
  }

  event.preventDefault()
  const step = event.shiftKey ? DATA_SPLIT_KEYBOARD_STEP * 5 : DATA_SPLIT_KEYBOARD_STEP
  const ratio = clampDataSplitRatio(dataSplitRatioDraft.value + direction * step)
  dataSplitRatioDraft.value = ratio
  dataSplitRatio.value = ratio
}

function resetDataSplitRatio(): void {
  dataSplitRatioDraft.value = DATA_SPLIT_DEFAULT_RATIO
  dataSplitRatio.value = DATA_SPLIT_DEFAULT_RATIO
}

function handleEditorShortcut(event: KeyboardEvent): void {
  if (mainTab.value !== 'columns' || event.repeat) {
    return
  }

  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    event.stopPropagation()
    closeColumnContextMenu()
    addColumn()
    return
  }

  if (
    event.key === 'Backspace'
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
    && !isTextEditingTarget(event.target)
    && !columnContextMenu.value
    && !removeAllColumnsDialogOpen.value
    && selectedColumn.value
  ) {
    event.preventDefault()
    closeColumnContextMenu()
    removeSelectedColumn()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorShortcut, { capture: true })
})

onBeforeUnmount(() => {
  endDataSplitResize()
  window.removeEventListener('keydown', handleEditorShortcut, { capture: true })
})
</script>

<template>
  <div
    data-editor-shortcut-scope="component-sfc-table"
    :data-shortcuts-active="mainTab === 'columns' ? 'true' : undefined"
    class="component-sfc-table-visual-editor flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
    @keydown.esc="closeColumnContextMenu"
  >
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

      <TabsContent value="table" class="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <Tabs
          v-model="tableSection"
          orientation="vertical"
          class="editor-panel grid h-full min-h-0 overflow-hidden rounded-xl border border-border/80 lg:grid-cols-[12rem_minmax(0,1fr)]"
        >
          <aside class="hidden min-h-0 overflow-hidden border-r border-border/70 bg-muted/20 lg:flex lg:flex-col">
            <TabsList class="flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-none bg-transparent p-2">
              <TabsTrigger
                v-for="section in tableSections"
                :key="section.id"
                :value="section.id"
                class="group h-9 w-full justify-start gap-2 rounded-md border-0 border-l-2 border-l-transparent px-2.5 text-left text-sm font-medium shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                <component :is="section.icon" class="size-3.5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
                <span class="truncate">{{ section.label }}</span>
                <Badge
                  v-if="tableSectionSummary(section.id)"
                  variant="secondary"
                  class="ml-auto h-5 min-w-5 justify-center px-1.5 text-[9px] font-normal"
                >
                  {{ tableSectionSummary(section.id) }}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </aside>

          <main class="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background/35">
            <div class="border-b border-border/70 p-3 lg:hidden">
              <Select :model-value="tableSection" @update:model-value="value => updateTableSection(value == null ? null : String(value))">
                <SelectTrigger class="editor-control w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="section in tableSections" :key="section.id" :value="section.id">
                    {{ section.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea class="min-h-0 flex-1">
              <TooltipProvider :delay-duration="120">
                <div class="p-5">
                  <section v-show="tableSection === 'general'">
                    <slot name="general" />
                  </section>

                  <section v-show="tableSection === 'paging'" class="space-y-3">
                    <p class="max-w-[720px] text-[11px] leading-relaxed text-muted-foreground">
                      Способ отображения больших наборов строк.
                    </p>

                    <div class="max-w-[720px] min-w-0 space-y-3">
                      <div class="max-w-sm space-y-1.5">
                        <Label for="sfc-table-paging">Режим</Label>
                        <Select
                          :model-value="pagingModeValue"
                          :disabled="pagingIsSourceOwned"
                          @update:model-value="(value) => updatePaging(value == null ? null : String(value))"
                        >
                          <SelectTrigger id="sfc-table-paging" class="editor-control w-full">
                            <SelectValue placeholder="Выберите режим" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem :value="PAGING_NOT_SET_VALUE">
                              Не задано
                            </SelectItem>
                            <SelectItem value="pages">
                              Страницы
                            </SelectItem>
                            <SelectItem value="virtual">
                              Виртуальный скролл
                            </SelectItem>
                            <SelectItem v-if="pagingIsSourceOwned" :value="PAGING_SOURCE_VALUE">
                              Настроено в Source
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p v-if="pagingIsSourceOwned" class="text-xs text-muted-foreground">
                          Dynamic paging expression можно изменить только в Source.
                        </p>
                      </div>

                      <Transition name="table-settings-reveal">
                        <div v-if="usesPagePaging" class="grid gap-3 rounded-lg border border-border/70 bg-background/10 p-3 sm:grid-cols-2">
                          <div class="space-y-1.5">
                            <Label for="sfc-table-page-size">Строк на странице</Label>
                            <Input
                              id="sfc-table-page-size"
                              v-model="pageSizeDraft"
                              type="number"
                              min="1"
                              step="1"
                              class="editor-control"
                              placeholder="10"
                              :disabled="!canEdit(projection.pageSize)"
                              @blur="commitPageSize"
                              @keydown.enter="blurInput"
                            />
                            <p class="text-[11px] text-muted-foreground">
                              Атрибут <code>page-size</code>
                            </p>
                          </div>

                          <div class="space-y-1.5">
                            <Label for="sfc-table-page-sizes">Доступные размеры</Label>
                            <Input
                              id="sfc-table-page-sizes"
                              v-model="pageSizesDraft"
                              class="editor-control font-mono"
                              spellcheck="false"
                              placeholder="10,25,50,100"
                              :disabled="!canEdit(projection.pageSizes)"
                              @blur="commitPageSizes"
                              @keydown.enter="blurInput"
                            />
                            <p class="text-[11px] text-muted-foreground">
                              Положительные числа через запятую
                            </p>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </section>

                  <section v-show="tableSection === 'visibility'" class="space-y-3">
                    <p class="max-w-[720px] text-[11px] leading-relaxed text-muted-foreground">
                      Отмеченные колонки видны при первом открытии. Эту же настройку можно менять для каждой колонки на вкладке «Колонки».
                    </p>

                    <div class="max-w-[720px] min-w-0">
                      <div
                        v-if="columns.length"
                        class="editor-control grid gap-1 rounded-lg border border-border/70 p-2 sm:grid-cols-2"
                      >
                        <button
                          v-for="column in columns"
                          :key="`visibility-${column.id}`"
                          type="button"
                          role="checkbox"
                          :aria-checked="!isColumnHiddenByDefault(column)"
                          :disabled="!canEditColumnVisibility(column)"
                          class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
                          :title="columnVisibilityEditingHint(column) ?? undefined"
                          @click="setColumnHiddenByDefault(column.index, !isColumnHiddenByDefault(column))"
                        >
                          <span
                            class="inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors"
                            :class="isColumnHiddenByDefault(column) ? 'border-border bg-background/40' : 'border-primary bg-primary text-primary-foreground'"
                          >
                            <Check v-if="!isColumnHiddenByDefault(column)" class="size-3" :stroke-width="3" />
                          </span>
                          <span class="truncate">{{ columnTitle(column) }}</span>
                        </button>
                      </div>
                      <div v-else class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        Добавьте колонки, чтобы настроить их начальную видимость.
                      </div>
                      <p v-if="projection.defaultHidden?.kind === 'expression'" class="mt-2 text-xs text-muted-foreground">
                        Dynamic default-hidden expression можно изменить только в Source.
                      </p>
                    </div>
                  </section>

                  <section v-show="tableSection === 'pinning'" class="space-y-3">
                    <p class="max-w-[720px] text-[11px] leading-relaxed text-muted-foreground">
                      Порядок закреплённых колонок определяется их порядком на вкладке «Колонки». Там же можно настроить каждую колонку отдельно.
                    </p>

                    <div class="max-w-[720px] min-w-0 overflow-hidden rounded-lg border border-border/70">
                      <div
                        v-if="projection.defaultPin?.kind === 'expression'"
                        class="editor-control flex min-h-10 items-center gap-2 px-3 text-xs text-muted-foreground"
                      >
                        <FileCode2 class="size-3.5 shrink-0" />
                        Dynamic default-pin настраивается в Source.
                      </div>
                      <table v-else class="w-full table-fixed text-xs">
                        <thead class="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th scope="col" class="px-2 py-1 text-left font-medium">
                              Колонка
                            </th>
                            <th scope="col" class="w-24 px-1 py-1 text-left font-medium">
                              Сторона
                            </th>
                            <th scope="col" class="w-8" />
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border/60">
                          <tr v-for="item in defaultPinItems" :key="`default-pin-${item.key}`" class="bg-background/15">
                            <td class="p-1">
                              <SearchableSelect
                                :model-value="item.key"
                                :options="defaultPinColumnOptions(item.key)"
                                size="compact"
                                trigger-class="editor-control h-7 border-0 px-2 text-xs shadow-none focus-visible:ring-1"
                                :disabled="!canEditDefaultPinRule(item.key)"
                                @update:model-value="value => changeDefaultPinRuleKey(item.key, value)"
                              />
                            </td>
                            <td class="p-1">
                              <div class="editor-control grid h-7 grid-cols-2 rounded-md border border-border/70 p-0.5">
                                <Tooltip>
                                  <TooltipTrigger as-child>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      class="h-6 min-w-0 rounded px-1"
                                      :class="item.side === 'left' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                      :disabled="!canEditDefaultPinRule(item.key)"
                                      aria-label="Закрепить слева"
                                      @click="setDefaultPinRuleSide(item.key, 'left')"
                                    >
                                      <PanelLeft class="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Слева</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger as-child>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      class="h-6 min-w-0 rounded px-1"
                                      :class="item.side === 'right' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                      :disabled="!canEditDefaultPinRule(item.key)"
                                      aria-label="Закрепить справа"
                                      @click="setDefaultPinRuleSide(item.key, 'right')"
                                    >
                                      <PanelRight class="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Справа</TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                            <td class="p-1 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                class="size-7 text-muted-foreground hover:text-destructive"
                                :disabled="!canEdit(projection.defaultPin)"
                                aria-label="Убрать закрепление"
                                @click="removeDefaultPinRule(item.key)"
                              >
                                <Trash2 class="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                          <tr v-if="defaultPinColumnOptions().length">
                            <td colspan="3" class="p-1">
                              <SearchableSelect
                                :model-value="null"
                                :options="defaultPinColumnOptions()"
                                placeholder="Добавить колонку…"
                                size="compact"
                                trigger-class="h-7 border-0 px-2 text-xs shadow-none focus-visible:ring-1"
                                @update:model-value="addDefaultPinRule"
                              />
                            </td>
                          </tr>
                          <tr v-else-if="!defaultPinItems.length">
                            <td colspan="3" class="px-3 py-2 text-center text-[11px] text-muted-foreground">
                              Нет доступных колонок.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section v-show="tableSection === 'sorting'" class="space-y-3">
                    <p class="max-w-[720px] text-[11px] leading-relaxed text-muted-foreground">
                      Строки идут в порядке приоритета. Поля и comparator каждой колонки настраиваются на вкладке «Колонки».
                    </p>

                    <div class="max-w-[720px] min-w-0 overflow-hidden rounded-lg border border-border/70">
                      <div
                        v-if="projection.defaultSort?.kind === 'expression'"
                        class="editor-control flex min-h-10 items-center gap-2 px-3 text-xs text-muted-foreground"
                      >
                        <FileCode2 class="size-3.5 shrink-0" />
                        Dynamic default-sort настраивается в Source.
                      </div>
                      <table v-else class="w-full table-fixed text-xs">
                        <thead class="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th scope="col" class="px-2 py-1 text-left font-medium">
                              Колонка
                            </th>
                            <th scope="col" class="w-28 px-1 py-1 text-left font-medium">
                              Направление
                            </th>
                            <th scope="col" class="w-24 px-1 py-1 text-left font-medium">
                              Приоритет
                            </th>
                            <th scope="col" class="w-8" />
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border/60">
                          <tr v-for="(item, index) in defaultSortItems" :key="`default-sort-${item.key}`" class="bg-background/15">
                            <td class="p-1">
                              <SearchableSelect
                                :model-value="item.key"
                                :options="defaultSortColumnOptions(item.key)"
                                size="compact"
                                trigger-class="editor-control h-7 border-0 px-2 text-xs shadow-none focus-visible:ring-1"
                                :disabled="!canEditDefaultSortRule(item.key)"
                                @update:model-value="value => changeDefaultSortRuleKey(item.key, value)"
                              />
                            </td>
                            <td class="p-1">
                              <div class="editor-control grid h-7 grid-cols-2 rounded-md border border-border/70 p-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 min-w-0 rounded px-1 text-[10px] font-semibold"
                                  :class="item.direction === 'asc' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                  :disabled="!canEditDefaultSortRule(item.key)"
                                  @click="setDefaultSortRuleDirection(item.key, 'asc')"
                                >
                                  ASC
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 min-w-0 rounded px-1 text-[10px] font-semibold"
                                  :class="item.direction === 'desc' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                  :disabled="!canEditDefaultSortRule(item.key)"
                                  @click="setDefaultSortRuleDirection(item.key, 'desc')"
                                >
                                  DESC
                                </Button>
                              </div>
                            </td>
                            <td class="p-1">
                              <div class="flex h-7 items-center justify-center gap-0.5">
                                <span class="min-w-5 text-center font-mono text-[10px] text-muted-foreground">#{{ index + 1 }}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  class="size-6 text-muted-foreground"
                                  :disabled="index === 0 || !canEditDefaultSortRule(item.key)"
                                  aria-label="Повысить приоритет"
                                  @click="moveDefaultSortRule(item.key, -1)"
                                >
                                  <ArrowUp class="size-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  class="size-6 text-muted-foreground"
                                  :disabled="index === defaultSortItems.length - 1 || !canEditDefaultSortRule(item.key)"
                                  aria-label="Понизить приоритет"
                                  @click="moveDefaultSortRule(item.key, 1)"
                                >
                                  <ArrowDown class="size-3" />
                                </Button>
                              </div>
                            </td>
                            <td class="p-1 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                class="size-7 text-muted-foreground hover:text-destructive"
                                :disabled="!canEdit(projection.defaultSort)"
                                aria-label="Удалить сортировку"
                                @click="removeDefaultSortRule(item.key)"
                              >
                                <Trash2 class="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                          <tr v-if="defaultSortColumnOptions().length">
                            <td colspan="4" class="p-1">
                              <SearchableSelect
                                :model-value="null"
                                :options="defaultSortColumnOptions()"
                                placeholder="Добавить колонку…"
                                size="compact"
                                trigger-class="h-7 border-0 px-2 text-xs shadow-none focus-visible:ring-1"
                                @update:model-value="addDefaultSortRule"
                              />
                            </td>
                          </tr>
                          <tr v-else-if="!defaultSortItems.length">
                            <td colspan="4" class="px-3 py-2 text-center text-[11px] text-muted-foreground">
                              Нет доступных колонок.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </TooltipProvider>
            </ScrollArea>
          </main>
        </Tabs>
      </TabsContent>

      <TabsContent value="columns" class="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <div class="space-y-3 pb-3 pr-2">
            <Card class="editor-panel gap-0 overflow-hidden py-0">
              <div class="flex min-h-16 items-start gap-2 p-3">
                <div class="flex flex-1 flex-wrap items-center gap-2">
                  <template
                    v-for="column in orderedColumns"
                    :key="column.id"
                  >
                    <div
                      v-if="showDividerBeforeColumn(column)"
                      aria-hidden="true"
                      class="h-7 w-px shrink-0 rounded-full bg-border/80"
                    />
                    <div
                      role="button"
                      tabindex="0"
                      :draggable="isColumnDraggable(column)"
                      class="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-[border-color,background-color,box-shadow,opacity]"
                      :class="[
                        selectedColumnIndex === column.index
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : columnPinSide(column) === 'none'
                            ? 'editor-control border-border/70 hover:border-border hover:brightness-110'
                            : 'editor-control border-primary/40 bg-primary/5 hover:border-primary/60 hover:brightness-110',
                        isColumnDraggable(column) ? 'cursor-move' : 'cursor-default',
                        isColumnHiddenByDefault(column) ? 'opacity-60' : '',
                        dragColumnIndex === column.index ? 'opacity-40' : '',
                        dragOverColumnIndex === column.index && dragColumnIndex !== column.index
                          ? 'ring-1 ring-primary'
                          : '',
                      ]"
                      :title="columnTitle(column)"
                      @click="selectedColumnIndex = column.index"
                      @keydown.enter.prevent="selectedColumnIndex = column.index"
                      @keydown.space.prevent="selectedColumnIndex = column.index"
                      @contextmenu="(event: MouseEvent) => openColumnContextMenu(event, column.index)"
                      @keydown="(event: KeyboardEvent) => openColumnContextMenuFromKeyboard(event, column.index)"
                      @dragstart="(event: DragEvent) => onColumnDragStart(event, column.index)"
                      @dragover="(event: DragEvent) => onColumnDragOver(event, column.index)"
                      @dragleave="dragOverColumnIndex = null"
                      @drop="(event: DragEvent) => onColumnDrop(event, column.index)"
                      @dragend="resetDragState"
                    >
                      <GripVertical class="size-3.5 shrink-0 opacity-60" />
                      <span class="max-w-52 truncate">{{ columnTitle(column) }}</span>
                      <FileCode2 v-if="isSourceOwnedCell(column)" class="size-3.5 shrink-0 opacity-75" />
                      <span
                        v-if="isColumnHiddenByDefault(column)"
                        class="inline-flex size-5 shrink-0 items-center justify-center"
                        title="Скрыта по умолчанию"
                      >
                        <EyeOff class="size-3.5" />
                      </span>
                      <span
                        v-if="columnPinSide(column) !== 'none'"
                        class="inline-flex shrink-0 items-center"
                        :title="columnPinLabel(column)"
                      >
                        <Pin class="size-3.5" />
                      </span>
                    </div>
                  </template>

                  <div v-if="!columns.length" class="px-2 py-2 text-xs text-muted-foreground">
                    Нет колонок. Нажмите «+», чтобы создать первую.
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
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

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="outline"
                          class="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Удалить все колонки"
                          :disabled="!columns.length"
                          @click="removeAllColumnsDialogOpen = true"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Удалить все колонки</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </Card>

            <Teleport to="body">
              <template v-if="columnContextMenu && contextMenuColumn">
                <div
                  class="fixed inset-0 z-[199]"
                  aria-hidden="true"
                  @pointerdown="closeColumnContextMenu"
                  @contextmenu.prevent="closeColumnContextMenu"
                />
                <div
                  role="menu"
                  class="fixed z-[200] min-w-60 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  :style="{ left: `${columnContextMenu.x}px`, top: `${columnContextMenu.y}px` }"
                  @click.stop
                >
                  <div class="truncate px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {{ columnTitle(contextMenuColumn) }}
                  </div>
                  <div class="my-1 h-px bg-border" />
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-45"
                    :disabled="!canEditColumnPin(contextMenuColumn) || columnPinSide(contextMenuColumn) === 'left'"
                    @click="setContextMenuColumnPin('left')"
                  >
                    <PanelLeft class="size-4 shrink-0" />
                    Закрепить слева
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-45"
                    :disabled="!canEditColumnPin(contextMenuColumn) || columnPinSide(contextMenuColumn) === 'right'"
                    @click="setContextMenuColumnPin('right')"
                  >
                    <PanelRight class="size-4 shrink-0" />
                    Закрепить справа
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-45"
                    :disabled="!canEditColumnPin(contextMenuColumn) || columnPinSide(contextMenuColumn) === 'none'"
                    @click="setContextMenuColumnPin(null)"
                  >
                    <PinOff class="size-4 shrink-0" />
                    Убрать закрепление
                  </button>
                  <div
                    v-if="columnPinEditingHint(contextMenuColumn)"
                    class="mt-1 border-t px-2 pt-2 pb-1 text-[11px] leading-4 text-muted-foreground"
                  >
                    {{ columnPinEditingHint(contextMenuColumn) }}
                  </div>
                  <div class="my-1 h-px bg-border" />
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    :aria-checked="!isColumnHiddenByDefault(contextMenuColumn)"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-45"
                    :disabled="!canEditColumnVisibility(contextMenuColumn)"
                    @click="toggleContextMenuColumnVisibility"
                  >
                    <Eye v-if="isColumnHiddenByDefault(contextMenuColumn)" class="size-4 shrink-0" />
                    <EyeOff v-else class="size-4 shrink-0" />
                    {{ isColumnHiddenByDefault(contextMenuColumn) ? 'Показывать по умолчанию' : 'Скрыть по умолчанию' }}
                  </button>
                  <div
                    v-if="columnVisibilityEditingHint(contextMenuColumn)"
                    class="px-2 py-1 text-[11px] leading-4 text-muted-foreground"
                  >
                    {{ columnVisibilityEditingHint(contextMenuColumn) }}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10"
                    @click="removeColumnFromContextMenu"
                  >
                    <Trash2 class="size-4 shrink-0" />
                    Удалить
                  </button>
                </div>
              </template>
            </Teleport>

            <AlertDialog v-model:open="removeAllColumnsDialogOpen">
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить все колонки?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Из Table будут удалены все колонки. Количество: {{ columns.length }}. Source изменится сразу, а изменение станет постоянным после сохранения компонента.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    @click="removeAllColumns"
                  >
                    Удалить все
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Card class="editor-panel gap-0 overflow-hidden py-0">
              <div v-if="!selectedColumn" class="p-5 text-sm text-muted-foreground">
                Выберите колонку выше для настройки.
              </div>

              <template v-else>
                <section class="border-b px-5 py-5">
                  <div class="mb-3 text-xs font-medium text-muted-foreground">
                    Выбранная колонка
                  </div>
                  <div class="grid gap-3 md:grid-cols-[minmax(180px,0.72fr)_minmax(260px,1.28fr)_minmax(120px,0.48fr)]">
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
                    <div class="space-y-1.5">
                      <Label for="sfc-table-column-title">Отображаемое имя</Label>
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
                      <Label for="sfc-table-column-width">Ширина</Label>
                      <Input
                        id="sfc-table-column-width"
                        v-model="widthDraft"
                        class="editor-control"
                        placeholder="auto"
                        :disabled="!canEdit(selectedColumn.width)"
                        @blur="commitAttribute('width', widthDraft)"
                        @keydown.enter="blurInput"
                      />
                    </div>
                  </div>
                </section>

                <section class="border-b px-5 py-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h3 class="text-sm font-semibold">
                      Данные
                    </h3>
                    <TooltipProvider :delay-duration="120">
                      <div
                        class="editor-control inline-flex items-center rounded-md border border-border/70 p-0.5"
                        role="group"
                        aria-label="Способ отображения данных"
                      >
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              class="size-7"
                              :class="cellEditorMode === 'component' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                              :disabled="isSourceOwnedCell(selectedColumn)"
                              aria-label="Компонент"
                              @click="selectCellEditorMode('component')"
                            >
                              <Blocks class="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Существующий компонент</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              class="size-7"
                              :class="cellEditorMode === 'tag' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                              :disabled="isSourceOwnedCell(selectedColumn)"
                              aria-label="Tag"
                              @click="selectCellEditorMode('tag')"
                            >
                              <Tags class="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Встроенный SFC tag</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              class="size-7"
                              :class="cellEditorMode === 'source' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                              aria-label="Source"
                              @click="selectCellEditorMode('source')"
                            >
                              <FileCode2 class="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Произвольная Source-разметка</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>

                  <div
                    v-if="cellEditorMode === 'component' || cellEditorMode === 'tag'"
                    ref="dataSplitContainer"
                    class="table-data-split flex overflow-hidden rounded-lg border border-border/70"
                  >
                    <div
                      class="editor-control min-w-0 flex-none p-4"
                      :style="{ flexBasis: `calc((100% - 7px) * ${dataSplitRatioDraft / 100})` }"
                    >
                      <div v-if="cellEditorMode === 'component'" class="space-y-2">
                        <Label>Компонент</Label>
                        <SearchableSelect
                          :options="componentSelectOptions"
                          :model-value="selectedComponentValue"
                          placeholder="Найти компонент..."
                          trigger-class="editor-control w-full"
                          @update:model-value="updateComponent"
                        />
                        <p class="text-xs text-muted-foreground">
                          {{ selectedComponentOption ? `${selectedComponentOption.inputs.length} входных параметров` : 'Выберите компонент' }}
                        </p>
                      </div>

                      <div v-else class="space-y-2">
                        <Label>Tag</Label>
                        <SearchableSelect
                          :options="tagSelectOptions"
                          :model-value="selectedTagValue"
                          placeholder="Найти SFC tag..."
                          trigger-class="editor-control w-full font-mono"
                          @update:model-value="updateTag"
                        />
                        <p class="text-xs text-muted-foreground">
                          Встроенный renderer-neutral элемент.
                        </p>
                      </div>
                    </div>

                    <div
                      class="table-data-split__separator"
                      :data-resizing="isDataSplitResizing"
                      role="separator"
                      aria-label="Изменить ширину панелей выбора элемента и входных параметров"
                      aria-orientation="vertical"
                      :aria-valuenow="Math.round(dataSplitRatioDraft)"
                      :aria-valuemin="DATA_SPLIT_MIN_RATIO"
                      :aria-valuemax="DATA_SPLIT_MAX_RATIO"
                      tabindex="0"
                      @dblclick="resetDataSplitRatio"
                      @pointerdown="beginDataSplitResize"
                      @keydown.stop="resizeDataSplitByKeyboard"
                    >
                      <span />
                    </div>

                    <div class="min-w-0 flex-1 bg-editor-panel">
                      <div class="grid grid-cols-[minmax(120px,0.42fr)_minmax(0,0.58fr)] border-b bg-muted/25 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <div>Входной параметр</div>
                        <div>Значение</div>
                      </div>

                      <div v-if="cellBindingFields.length" class="divide-y divide-border/60">
                        <div
                          v-for="field in cellBindingFields"
                          :key="field.name"
                          class="grid grid-cols-[minmax(120px,0.42fr)_minmax(0,0.58fr)] items-start gap-3 px-3 py-2.5"
                          :class="!field.optional && !cellBindingDrafts[field.name]?.trim() ? 'bg-amber-500/5' : ''"
                        >
                          <div class="min-w-0 pt-1">
                            <div class="flex min-w-0 items-center gap-1.5">
                              <code class="truncate text-xs font-medium text-foreground">{{ field.name }}</code>
                              <span v-if="!field.optional" class="text-xs text-amber-500">*</span>
                              <Badge v-if="field.sourceOnly" variant="outline" class="h-4 px-1 text-[9px] font-normal">
                                Source
                              </Badge>
                            </div>
                            <div class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" :title="field.type">
                              {{ field.type }}
                            </div>
                          </div>

                          <div class="min-w-0">
                            <div
                              class="editor-control flex min-w-0 items-center rounded-md border border-border/70 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30"
                              :class="cellBindingErrors[field.name] ? 'border-destructive/70' : ''"
                              @focusout="handleCellBindingFocusOut($event, field.name)"
                            >
                              <TooltipProvider :delay-duration="120">
                                <Tooltip>
                                  <TooltipTrigger as-child>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      class="h-7 min-w-7 rounded-r-none border-r px-1.5 font-mono text-[10px]"
                                      :class="cellBindingKind(field.name) === 'expression' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'"
                                      aria-label="Динамическое выражение"
                                      @click="setCellBindingKind(field.name, 'expression')"
                                    >
                                      fx
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Dynamic expression: :{{ field.name }}=&quot;row...&quot;</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger as-child>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      class="h-7 min-w-7 rounded-none border-r px-1.5 font-mono text-[10px]"
                                      :class="cellBindingKind(field.name) === 'literal' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'"
                                      aria-label="Статическое значение"
                                      @click="setCellBindingKind(field.name, 'literal')"
                                    >
                                      Aa
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Static literal: {{ field.name }}=&quot;value&quot;</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Input
                                v-model="cellBindingDrafts[field.name]"
                                class="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
                                :placeholder="cellBindingKind(field.name) === 'expression' ? 'row.path.to.value' : 'Значение'"
                                spellcheck="false"
                                @keydown.enter.prevent="commitCellBinding(field.name)"
                                @keydown.esc.prevent="resetCellBinding(field.name)"
                              />
                            </div>
                            <p v-if="cellBindingErrors[field.name]" class="mt-1 text-[10px] leading-tight text-destructive">
                              {{ cellBindingErrors[field.name] }}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div v-else class="flex min-h-24 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        {{ selectedComponentValue || selectedTagValue ? 'У выбранного элемента нет параметров данных.' : 'Выберите элемент слева.' }}
                      </div>
                    </div>
                  </div>

                  <div
                    v-else
                    class="editor-control flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3"
                  >
                    <div class="min-w-0">
                      <div class="text-sm font-medium">
                        Source
                      </div>
                      <div class="mt-0.5 text-xs text-muted-foreground">
                        Содержимое колонки можно изменить вручную без преобразования Visual editor.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      class="shrink-0 gap-1.5"
                      @click="openSelectedColumnSource"
                    >
                      Редактировать в Source
                      <ExternalLink class="size-3.5" />
                    </Button>
                  </div>
                </section>

                <section class="border-b bg-background/15 px-5 py-4">
                  <div class="mb-3 flex items-center gap-1.5">
                    <h3 class="text-sm font-semibold">
                      Сортировка
                    </h3>
                    <TooltipProvider :delay-duration="120">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <button
                            type="button"
                            class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="О сортировке колонки"
                          >
                            <CircleHelp class="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" class="max-w-80 leading-relaxed">
                          Цепочки сравниваются последовательно. Используйте dot paths без префикса row. Если список пуст, сортировка использует key колонки.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div class="grid max-w-[980px] gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                    <div class="overflow-hidden rounded-lg border border-border/70">
                      <div
                        v-if="selectedColumn.sortBy?.kind === 'expression'"
                        class="editor-control flex min-h-10 items-center gap-2 px-3 text-xs text-muted-foreground"
                      >
                        <FileCode2 class="size-3.5 shrink-0" />
                        Dynamic sort-by настраивается в Source.
                      </div>
                      <table v-else class="w-full table-fixed text-xs">
                        <thead class="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th scope="col" class="w-9 px-1 py-1 text-center font-medium">
                              #
                            </th>
                            <th scope="col" class="px-2 py-1 text-left font-medium">
                              Цепочка поля
                            </th>
                            <th scope="col" class="w-[76px] px-1 py-1 text-center font-medium">
                              Порядок
                            </th>
                            <th scope="col" class="w-8" />
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border/60">
                          <tr v-for="(path, index) in sortPathDrafts" :key="`sort-path-${index}`" class="bg-background/15">
                            <td class="px-1 text-center font-mono text-[10px] text-muted-foreground">
                              {{ index + 1 }}
                            </td>
                            <td class="p-1">
                              <Input
                                v-model="sortPathDrafts[index]"
                                class="editor-control h-7 border-0 px-2 font-mono text-xs shadow-none focus-visible:ring-1"
                                placeholder="departureLeg.aircraft.tail"
                                spellcheck="false"
                                :disabled="Boolean(columnSortDetailsEditingHint(selectedColumn))"
                                @blur="commitColumnSortPath(index)"
                                @keydown.enter.prevent="commitColumnSortPath(index)"
                                @keydown.esc.prevent="resetColumnSortPaths"
                              />
                            </td>
                            <td class="p-1">
                              <div class="flex items-center justify-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  class="size-6 text-muted-foreground"
                                  :disabled="index === 0 || Boolean(columnSortDetailsEditingHint(selectedColumn))"
                                  aria-label="Переместить поле выше"
                                  @click="moveColumnSortPath(index, -1)"
                                >
                                  <ArrowUp class="size-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  class="size-6 text-muted-foreground"
                                  :disabled="index === sortPathDrafts.length - 1 || Boolean(columnSortDetailsEditingHint(selectedColumn))"
                                  aria-label="Переместить поле ниже"
                                  @click="moveColumnSortPath(index, 1)"
                                >
                                  <ArrowDown class="size-3" />
                                </Button>
                              </div>
                            </td>
                            <td class="p-1 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                class="size-7 text-muted-foreground hover:text-destructive"
                                :disabled="Boolean(columnSortDetailsEditingHint(selectedColumn))"
                                aria-label="Удалить цепочку"
                                @click="removeColumnSortPath(index)"
                              >
                                <Trash2 class="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                          <tr v-if="!sortPathDrafts.length">
                            <td colspan="4" class="px-3 py-2 text-center text-[11px] text-muted-foreground">
                              Используется key колонки: <code>{{ sourceValueText(selectedColumn.key) || '—' }}</code>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div v-if="selectedColumn.sortBy?.kind !== 'expression'" class="border-t border-border/60 p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="h-7 w-full justify-start gap-1.5 text-xs text-muted-foreground"
                          :disabled="Boolean(columnSortDetailsEditingHint(selectedColumn))"
                          @click="addColumnSortPath"
                        >
                          <Plus class="size-3.5" />
                          Добавить цепочку
                        </Button>
                      </div>
                    </div>

                    <aside class="overflow-hidden rounded-lg border border-border/70 bg-muted/10">
                      <div class="p-3">
                        <Label class="text-xs">Направление</Label>
                        <TooltipProvider :delay-duration="120">
                          <div class="mt-2 space-y-2">
                            <div
                              class="editor-control inline-flex h-8 items-center rounded-md border border-border/70 p-0.5"
                              role="group"
                              aria-label="Сортировка колонки по умолчанию"
                            >
                              <Tooltip>
                                <TooltipTrigger as-child>
                                  <span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      class="h-7 min-w-9 px-2"
                                      :class="columnSortDirection(selectedColumn) == null ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                      :disabled="Boolean(columnSortEditingHint(selectedColumn))"
                                      aria-label="Без сортировки по умолчанию"
                                      @click="setColumnDefaultSort(selectedColumn.index, null)"
                                    >
                                      —
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{{ columnSortEditingHint(selectedColumn) ?? 'Без сортировки по умолчанию' }}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger as-child>
                                  <span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      class="h-7 min-w-11 px-2 text-[10px] font-semibold"
                                      :class="columnSortDirection(selectedColumn) === 'asc' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                      :disabled="!canSetColumnSortDirection(selectedColumn)"
                                      @click="setColumnDefaultSort(selectedColumn.index, 'asc')"
                                    >
                                      ASC
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{{ columnSortDirectionEditingHint(selectedColumn) ?? 'По возрастанию' }}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger as-child>
                                  <span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      class="h-7 min-w-11 px-2 text-[10px] font-semibold"
                                      :class="columnSortDirection(selectedColumn) === 'desc' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground'"
                                      :disabled="!canSetColumnSortDirection(selectedColumn)"
                                      @click="setColumnDefaultSort(selectedColumn.index, 'desc')"
                                    >
                                      DESC
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{{ columnSortDirectionEditingHint(selectedColumn) ?? 'По убыванию' }}</TooltipContent>
                              </Tooltip>
                            </div>

                            <div v-if="columnSortPriority(selectedColumn) != null" class="flex items-center gap-1">
                              <span class="mr-auto text-[10px] text-muted-foreground">Приоритет</span>
                              <Badge variant="outline" class="h-7 min-w-7 justify-center px-1 font-mono text-[10px]">
                                #{{ columnSortPriority(selectedColumn) }}
                              </Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                class="size-7 text-muted-foreground"
                                :disabled="columnSortPriority(selectedColumn) === 1"
                                aria-label="Повысить приоритет сортировки"
                                @click="moveColumnSortPriority(selectedColumn.index, -1)"
                              >
                                <ChevronLeft class="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                class="size-7 text-muted-foreground"
                                :disabled="columnSortPriority(selectedColumn) === defaultSortItems.length"
                                aria-label="Понизить приоритет сортировки"
                                @click="moveColumnSortPriority(selectedColumn.index, 1)"
                              >
                                <ChevronRight class="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </TooltipProvider>
                      </div>

                      <div class="border-t border-border/70 p-3">
                        <Label for="sfc-table-column-sort-comparator" class="text-xs">Сравнение</Label>
                        <Select
                          :model-value="selectedColumnSortComparator"
                          :disabled="Boolean(columnSortDetailsEditingHint(selectedColumn))"
                          @update:model-value="value => updateColumnSortComparator(value == null ? null : String(value))"
                        >
                          <SelectTrigger id="sfc-table-column-sort-comparator" class="editor-control mt-2 h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="option in SORT_COMPARATOR_OPTIONS" :key="option.value" :value="option.value">
                              {{ option.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </aside>
                  </div>
                </section>
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

.table-data-split__separator {
  position: relative;
  z-index: 2;
  display: flex;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  border-right: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  cursor: ew-resize;
  outline: none;
  touch-action: none;
}

.table-data-split__separator span {
  width: 2px;
  height: 30px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted-foreground) 34%, transparent);
  transition: height 120ms ease, background-color 120ms ease;
}

.table-data-split__separator:hover span,
.table-data-split__separator:focus-visible span,
.table-data-split__separator[data-resizing='true'] span {
  height: 46px;
  background: var(--primary);
}

.table-settings-reveal-enter-active,
.table-settings-reveal-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.table-settings-reveal-enter-from,
.table-settings-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
