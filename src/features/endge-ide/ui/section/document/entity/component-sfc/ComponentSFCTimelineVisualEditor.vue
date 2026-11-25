<script setup lang="ts">
import type { ComponentSFCTimelineColumnSource, ComponentSFCTimelineRecipeSource, ComponentSFCTimelineVisualNode, ComponentSFCVisualAttribute } from '@endge/core'
import type { TimelineRecipeChartPreview } from '@endge/ui-vue'
import { compileComponentSFC, createTimelineRecipeLayout, Endge, parseComponentSFC, patchComponentSFCTimelineColumns, patchComponentSFCTimelineRecipe, patchComponentSFCTimelineSource, readComponentSFCTranslationFallback } from '@endge/core'
import { listTimelinePresets, timelinePreviewGroupsHiddenKey, timelineRecipePreviewKey } from '@endge/ui-vue'
import { useElementSize } from '@vueuse/core'
import { ChevronRight, Clock3, CodeXml, Columns3, Eye, Globe2, GripVertical, List, MoveHorizontal, PanelBottom, PanelLeft, Plus, SlidersHorizontal, X } from 'lucide-vue-next'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { computed, nextTick, onScopeDispose, provide, ref, shallowReactive, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { componentPreviewTranslation } from '@/features/endge-ide/services/preview-runtime/component-preview-translation'
import { useTimelineVisualPreview } from '@/features/endge-ide/services/preview-runtime/timeline-visual-preview'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/services/types/type-definition-resolver'
import SettingsNavigationPanel from '@/features/endge-ide/ui/components/settings/SettingsNavigationPanel.vue'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'
import { useConfiguratorState } from '@/shared/tools/use-configurator-state'
import TimelineBindingInput from './TimelineBindingInput.vue'
import TimelineRecipesEditor from './TimelineRecipesEditor.vue'

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'color'
  values?: readonly string[]
  fallback?: string | number | boolean
}

interface Column {
  id: string
  field: string
  title?: string
  width?: number
  sortable?: boolean
  valueExpression?: string
  titleExpression?: string
  authored?: ComponentSFCTimelineColumnSource['attributes']
}

const props = defineProps<{
  source: string
  identity: string
  projection: ComponentSFCTimelineVisualNode
  recipeToolbarHost?: HTMLElement | null
}>()
const emit = defineEmits<{ 'update:source': [source: string], 'openSource': [offset: number] }>()
const { t } = useI18n()
const activeSection = ref('general')
const recipesExpanded = ref(false)
const sidebarWidth = ref(216)
const previewOpen = ref(false)
const previewGroupsHidden = ref(false)
provide(timelinePreviewGroupsHiddenKey, previewGroupsHidden)
const constructorOpen = ref(true)
let recipesVisited = false
const jsonOpen = ref(false)
const settingsBody = ref<HTMLElement>()
const recipeHost = ref<HTMLElement | null>(null)
const jsonHost = ref<HTMLElement | null>(null)
const previewHost = ref<HTMLElement | null>(null)
const { width: settingsWidth } = useElementSize(settingsBody)
const storedLayout = useConfiguratorState<Record<string, string>>('configurator.timeline.settings-layout', {})
const splitterStorage = {
  getItem: (key: string) => storedLayout.value[key] ?? null,
  setItem: (key: string, value: string) => { storedLayout.value = { ...storedLayout.value, [key]: value } },
}
const previewId = useId()
const recipesNavId = useId()
const chartIndex = ref<number>()
const error = ref('')
const selected = computed(() => props.projection.charts[chartIndex.value ?? -1] ?? props.projection)
const groupSelected = computed(() => selected.value.tag === 'TimelineGroup')
const chartSelection = computed({
  get: () => groupSelected.value ? 'group' : chartIndex.value,
  set: (value) => {
    chartIndex.value = typeof value === 'number' ? value : undefined
  },
})
const moduleRevision = ref(0)
onScopeDispose(Endge.runtime.modules.subscribe(() => moduleRevision.value++))
onScopeDispose(Endge.configuration.subscribe(() => moduleRevision.value++))
const moduleScope = computed(() => EndgeIDE.runtimePreview.selectedEntry.value?.selectedModuleScope(props.identity))
const presets = computed(() => {
  void moduleRevision.value
  return listTimelinePresets(moduleScope.value)
})
const preset = computed(() => presets.value.find(item => item.name === literal('preset')))
const compileOptions = {
  resolveComponentTag: (tag: string) => Endge.program.resolveComponentTag(tag),
  resolveTypeDefinition: resolveEndgeTypeDefinition,
}
const compilation = computed(() => compileComponentSFC(props.source, compileOptions))
const previewErrors = computed(() => compilation.value.diagnostics.filter(item => item.severity === 'error'))
const recipeSections = computed(() => selected.value.recipes.map((recipe, index) => ({
  id: `recipe-${index}`,
  label: recipe.name || recipe.id || t('timelineEditor.recipes.unnamed'),
  kind: recipe.kind,
})))
const recipeIndex = computed(() => recipeSections.value.findIndex(section => section.id === activeSection.value))
const recipeOpen = computed(() => !groupSelected.value && recipeIndex.value !== -1)
const recipeSectionOpen = computed(() => recipeOpen.value || (!groupSelected.value && activeSection.value === 'recipes'))
const settingsOpen = computed(() => !recipeOpen.value || constructorOpen.value)
const showJson = computed(() => recipeOpen.value && jsonOpen.value)
const panelCount = computed(() => Number(settingsOpen.value) + Number(showJson.value) + Number(previewOpen.value))
const splitDirection = computed(() => settingsWidth.value >= (panelCount.value === 3 ? 1_030 : 740) ? 'horizontal' : 'vertical')
const freezePane = computed(() => recipeOpen.value && panelCount.value === 1)
const previewEnabled = computed(() => previewOpen.value || recipeSectionOpen.value || activeSection.value === 'columns')
const {
  data: previewData,
  status: previewStatus,
  error: previewError,
} = useTimelineVisualPreview(
  () => props.identity,
  computed(() => ({ props: compilation.value.previewProps ?? {}, options: compilation.value.previewOptions })),
  previewEnabled,
  previewId,
)
const previewCharts = shallowReactive(new Map<string, TimelineRecipeChartPreview>())
const chartPreviews = computed(() => [...previewCharts.values()].filter(chart => chart.sourceStart === selected.value.sourceRange.start))
const recipePresetName = computed(() => preset.value?.label ?? preset.value?.name ?? (String(literal('preset') ?? '') || chartPreviews.value[0]?.presetName || ''))
const programRevision = ref(0)
onScopeDispose(Endge.program.subscribe(() => programRevision.value++))
const previewTranslate = computed(() => {
  if (!previewEnabled.value) {
    return undefined
  }
  void programRevision.value
  const instance = EndgeIDE.runtimePreview.selectedEntry.value?.renderables.value
    .find(item => item.kind === 'component-sfc' && item.runtime.entityIdentity === props.identity)
  if (instance?.kind === 'component-sfc') {
    return (key: string, fallback?: string) => instance.runtime.translate(key, fallback)
  }
  return componentPreviewTranslation(props.identity)
})
const previewPresetErrors = computed(() => [...new Set([...previewCharts.values()].flatMap(chart =>
  chart.presetError ? [chart.presetError] : [],
))])
provide(timelineRecipePreviewKey, (preview) => {
  const key = JSON.stringify([preview.sourceStart, preview.chartKey])
  previewCharts.set(key, preview)
  return () => {
    if (previewCharts.get(key) === preview) {
      previewCharts.delete(key)
    }
  }
})

function patchRecipe(start: number | undefined, value: ComponentSFCTimelineRecipeSource | null): string | null {
  try {
    const next = patchComponentSFCTimelineRecipe(props.source, selected.value.sourceRange.start, start, value)
    if (value) {
      const diagnostic = compileComponentSFC(next, compileOptions).diagnostics.find(item => item.severity === 'error')
      if (diagnostic) {
        return diagnostic.message
      }
    }
    if (props.source !== next) {
      emit('update:source', next)
    }
    return null
  }
  catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
}

function openRecipe(index: number): void {
  recipesExpanded.value = true
  activeSection.value = recipeSections.value[index]?.id ?? 'recipes'
}

function toggleRecipes(): void {
  recipesExpanded.value = !recipesExpanded.value
  if (recipesExpanded.value && !recipeSectionOpen.value) {
    openRecipe(0)
  }
}

function createRecipe(inherited?: Omit<ComponentSFCTimelineRecipeSource, 'id'>): string | null {
  const recipes = selected.value.recipes
  const ids = new Set(recipes.map(recipe => recipe.id))
  const names = new Set(recipes.map(recipe => recipe.name))
  let index = 1
  while (ids.has(`recipe-${index}`) || names.has(t('timelineEditor.recipes.newName', { index }))) {
    index++
  }
  const tasks = chartPreviews.value[0]?.data.tasks ?? []
  const kind = tasks.find(task => task.kind === recipes[recipeIndex.value]?.kind)?.kind ?? tasks[0]?.kind ?? ''
  const result = patchRecipe(undefined, {
    id: `recipe-${index}`,
    ...(inherited ?? {
      name: t('timelineEditor.recipes.newName', { index }),
      kind,
      when: kind ? '' : 'true',
      recipe: createTimelineRecipeLayout(),
    }),
  })
  if (!result) {
    recipesExpanded.value = true
    constructorOpen.value = true
    activeSection.value = `recipe-${recipes.length}`
  }
  return result
}

function removeActiveRecipe(): string | null {
  const index = recipeIndex.value
  const recipe = selected.value.recipes[index]
  if (!recipe) {
    return null
  }
  const result = patchRecipe(recipe.sourceRange.start, null)
  if (!result) {
    openRecipe(selected.value.recipes.length > 1 ? Math.max(0, index - 1) : -1)
  }
  return result
}

const useContextTimezone = computed(() => binding('timezone')?.trim() === '$context.timezone')
const inputs = computed(() => compilation.value.contract.inputs.map(input => input.name))
const expressionBindings = computed(() => chartPreviews.value[0]?.expressionBindings ?? {
  ...previewData.value,
  props: { ...Object.fromEntries(inputs.value.map(name => [name, undefined])), ...previewData.value },
})
const columnBindings = computed(() => ({
  ...expressionBindings.value,
  $group: chartPreviews.value[0]?.data.groups?.[0],
}))
const columns = computed<Column[]>(() => {
  if (!selected.value.columns.length) {
    const value = literal('columns')
    return Array.isArray(value) ? value as Column[] : []
  }
  return selected.value.columns.map(({ attributes }) => {
    const authored: NonNullable<Column['authored']> = Object.fromEntries(attributes.map(({ name, value }) => [
      name,
      value.kind === 'expression'
        ? { value: value.source, binding: true }
        : { value: typeof value.value === 'boolean' ? value.value : String(value.value ?? '') },
    ]))
    const title = authored.title
    const width = Number(authored.width?.value)
    return {
      id: String(authored.key?.value ?? authored.id?.value ?? ''),
      field: String(authored.field?.value ?? ''),
      title: title?.binding ? undefined : typeof title?.value === 'string' ? title.value : undefined,
      width: Number.isFinite(width) ? width : undefined,
      sortable: authored.sortable?.value === true || authored.sortable?.value === 'true',
      valueExpression: authored.value?.binding ? String(authored.value.value) : undefined,
      titleExpression: title?.binding ? String(title.value) : undefined,
      authored,
    }
  })
})
const draggedColumnIndex = ref<number>()
const columnDropIndex = ref<number>()
const options = computed(() => record(literal('options')))
const settings = computed(() => record(literal('settings')))

const chartFields: Field[] = [
  { key: 'height', label: 'Начальная высота, px', type: 'number', fallback: 320 },
  { key: 'min-height', label: 'Минимальная высота, px', type: 'number', fallback: 80 },
  { key: 'max-height', label: 'Максимальная высота, px', type: 'number' },
  { key: 'hidden', label: 'Скрыть график', type: 'boolean' },
  { key: 'collapsed', label: 'Свернуть график', type: 'boolean' },
]
const groupFields: Field[] = [
  { key: 'sync', label: 'Синхронизация', type: 'select', values: ['none', 'time'], fallback: 'none' },
  { key: 'leader', label: 'Ключ ведущего графика', type: 'text' },
  { key: 'label-width', label: 'Ширина слева от шкалы, px', type: 'number', fallback: 160 },
  { key: 'splitter', label: 'Сплиттеры между графиками', type: 'boolean' },
]
const optionSections = computed<{ id: string, label: string, path?: string, icon: typeof Clock3, fields: Field[] }[]>(() => [
  { id: 'timeScale', label: t('timelineEditor.sections.timeScale'), path: 'timeScale', icon: Clock3, fields: [
    { key: 'enabled', label: 'Показывать шкалу', type: 'boolean', fallback: true },
    { key: 'height', label: 'Высота шкалы, px', type: 'number' },
    { key: 'preset', label: 'Вид шкалы', type: 'select', values: ['calendar', 'ticks', 'bands'] },
    { key: 'minTickWidthPx', label: 'Минимальный шаг делений, px', type: 'number' },
  ] },
  { id: 'scroll', label: t('timelineEditor.sections.scroll'), path: 'scroll', icon: MoveHorizontal, fields: [
    { key: 'horizontalBarEnabled', label: 'Горизонтальная', type: 'boolean', fallback: true },
    { key: 'mainVerticalBarEnabled', label: 'Вертикальная основная', type: 'boolean', fallback: true },
    { key: 'ungroupedVerticalBarEnabled', label: 'Вертикальная нижней панели', type: 'boolean', fallback: true },
  ] },
  { id: 'ungroupedPanel', label: t('timelineEditor.sections.ungroupedPanel'), path: 'ungroupedPanel', icon: PanelBottom, fields: [
    { key: 'enabled', label: 'Показывать несгруппированные задачи', type: 'boolean', fallback: true },
    { key: 'height', label: 'Высота панели, px', type: 'number' },
    { key: 'title', label: 'Заголовок панели', type: 'text' },
  ] },
  { id: 'tasks', label: t('timelineEditor.sections.tasks'), path: 'tasks', icon: List, fields: [
    { key: 'height', label: 'Высота балки, px', type: 'number' },
    { key: 'rowGap', label: 'Промежуток между балками, px', type: 'number' },
  ] },
])
const availableSections = computed(() => {
  const general = { id: 'general', label: t('documentMetadata.general'), icon: SlidersHorizontal }
  if (groupSelected.value) {
    return [general]
  }
  const diagramSections = binding('options') ? [] : optionSections.value
  return [general, { id: 'columns', label: t('timelineEditor.columns'), icon: Columns3 }, { id: 'recipes', label: t('timelineEditor.recipes.title'), icon: ChevronRight }, ...diagramSections, { id: 'regional', label: t('timelineEditor.sections.regional'), icon: Globe2 }]
})
const sectionLabel = computed(() => recipeSections.value[recipeIndex.value]?.label
  ?? availableSections.value.find(section => section.id === activeSection.value)?.label
  ?? t('documentMetadata.general'))
const presetFields = computed<Field[]>(() => Object.entries(preset.value?.fields ?? {}).map(([key, field]) => ({
  key,
  label: field.label,
  type: field.type === 'string' ? (field.values ? 'select' : 'text') : field.type,
  values: 'values' in field ? field.values : undefined,
  fallback: field.default,
})))

watch([availableSections, recipeSections], ([sections, recipes]) => {
  if (!sections.some(section => section.id === activeSection.value) && !recipes.some(section => section.id === activeSection.value)) {
    if (!groupSelected.value && activeSection.value.startsWith('recipe-')) {
      openRecipe(0)
    }
    else {
      activeSection.value = 'general'
    }
  }
})
watch([activeSection, chartIndex], resetColumnDrag)
watch(recipeSectionOpen, (open) => {
  if (open) {
    recipesExpanded.value = true
  }
  if (open && !recipesVisited) {
    recipesVisited = true
    previewOpen.value = true
  }
  if (open && !panelCount.value) {
    constructorOpen.value = true
  }
})

function attribute(name: string): ComponentSFCVisualAttribute | undefined {
  return selected.value.attributes.find(item => item.name === name)
}

function literal(name: string): unknown {
  const value = attribute(name)?.value
  return value?.kind === 'expression' ? undefined : value?.value
}

function binding(name: string): string | undefined {
  const value = attribute(name)?.value
  return value?.kind === 'expression' ? value.source : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function openBinding(name: string): void {
  const input = binding(name)?.match(/^props\.([\w$]+)$/)?.[1]
  const declaration = input ? parseComponentSFC(props.source).ast?.script?.props?.range : undefined
  emit('openSource', declaration?.start ?? attribute(name)?.sourceRange?.start ?? selected.value.sourceRange.start)
}

function set(name: string, value: unknown, bound = false): void {
  try {
    const index = groupSelected.value || selected.value === props.projection ? undefined : chartIndex.value
    const source = patchComponentSFCTimelineSource(props.source, { chartIndex: index, name, value, binding: bound }, compileOptions)
    if (source !== props.source) {
      emit('update:source', source)
    }
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function setOption(path: string | undefined, key: string, value: unknown): void {
  const next = { ...optionValues(path) }
  if (value == null) {
    delete next[key]
  }
  else {
    next[key] = value
  }
  set('options', path ? { ...options.value, [path]: next } : next)
}

function optionValues(path: string | undefined): Record<string, unknown> {
  return path ? record(options.value[path]) : options.value
}

function changePreset(value: unknown): void {
  if (value === literal('preset')) {
    return
  }
  try {
    const chartIndexValue = selected.value === props.projection ? undefined : chartIndex.value
    const next = patchComponentSFCTimelineSource(props.source, { chartIndex: chartIndexValue, name: 'preset', value }, compileOptions)
    const cleared = patchComponentSFCTimelineSource(next, { chartIndex: chartIndexValue, name: 'settings', value: null }, compileOptions)
    emit('update:source', cleared)
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function setSetting(key: string, value: unknown): void {
  const next = { ...settings.value }
  if (value == null) {
    delete next[key]
  }
  else {
    next[key] = value
  }
  set('settings', next)
}

function inputValue(event: Event, type: Field['type']): string | number | null {
  const target = event.target as HTMLInputElement
  if (target.value === '') {
    return null
  }
  return type === 'number' ? Number(target.value) : target.value
}

function scalar(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function columnAttributes(column: Column): ComponentSFCTimelineColumnSource['attributes'] {
  const { id, field, title, width, sortable, valueExpression, titleExpression, authored, ...extra } = column
  return {
    ...Object.fromEntries(Object.entries(extra).flatMap(([key, value]) => value === undefined
      ? []
      : [[key, typeof value === 'string' ? { value } : { value: JSON.stringify(value), binding: true }]])),
    key: { value: id },
    field: field ? { value: field } : undefined,
    title: titleExpression !== undefined
      ? { value: titleExpression, binding: true }
      : title === undefined ? undefined : { value: title },
    value: valueExpression === undefined ? undefined : { value: valueExpression, binding: true },
    width: width === undefined ? undefined : { value: String(width), binding: true },
    sortable: sortable ? { value: true } : undefined,
  }
}

function setColumns(next: Column[]): void {
  if (!selected.value.columns.length && !next.some(column => column.valueExpression !== undefined || column.titleExpression !== undefined)) {
    set('columns', next)
    return
  }
  try {
    const source = patchComponentSFCTimelineColumns(props.source, selected.value.sourceRange.start, next.map(column => ({
      attributes: column.authored ?? columnAttributes(column),
    })))
    const diagnostic = compileComponentSFC(source, compileOptions).diagnostics.find(item => item.severity === 'error')
    if (diagnostic) {
      error.value = diagnostic.message
      return
    }
    emit('update:source', source)
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function changeColumn(index: number, patch: Partial<Column>): void {
  setColumns(columns.value.map((column, i) => {
    if (i !== index) {
      return column
    }
    const next = { ...column, ...patch }
    if (column.authored) {
      const authored = { ...column.authored }
      const attributes = columnAttributes(next)
      const names = { id: 'key', field: 'field', title: 'title', width: 'width', sortable: 'sortable', titleExpression: 'title', valueExpression: 'value' } as const
      for (const name of Object.keys(names) as (keyof typeof names)[]) {
        if (Object.hasOwn(patch, name)) {
          authored[names[name]] = attributes[names[name]]
        }
      }
      next.authored = authored
    }
    return next
  }))
}

function toggleColumnValue(index: number, column: Column): void {
  const field = column.field || 'title'
  const expression = /^[a-z_$][\w$]*(?:\.[a-z_$][\w$]*|\[\s*\d+\s*\])*$/i.test(field) ? `$group.${field}` : `$group[${JSON.stringify(field)}]`
  changeColumn(index, { valueExpression: column.valueExpression === undefined ? expression : undefined })
}

function toggleColumnTitle(index: number, column: Column): void {
  const expression = column.titleExpression
  changeColumn(index, expression === undefined
    ? { titleExpression: JSON.stringify(column.title ?? column.id) }
    : { titleExpression: undefined, title: readComponentSFCTranslationFallback(expression) ?? readTextLiteral(expression) ?? column.title ?? '' })
}

function readTextLiteral(source: string): string | undefined {
  try {
    const value: unknown = JSON.parse(source)
    return typeof value === 'string' ? value : undefined
  }
  catch {
    return undefined
  }
}

function addColumn(): void {
  const ids = new Set(columns.value.map(column => column.id))
  let index = 1
  while (ids.has(`column-${index}`)) {
    index++
  }
  setColumns([...columns.value, { id: `column-${index}`, field: 'title', title: 'Группа', width: 160, sortable: false }])
}

function moveColumn(index: number, next: number): boolean {
  const column = columns.value[index]
  if (index === next || !column || !columns.value[next]) {
    return false
  }
  const columnsNext = [...columns.value]
  columnsNext.splice(index, 1)
  columnsNext.splice(next, 0, column)
  setColumns(columnsNext)
  return !error.value
}

function startColumnDrag(event: DragEvent, index: number): void {
  draggedColumnIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    const row = (event.currentTarget as HTMLElement).closest('tr')
    if (row) {
      event.dataTransfer.setDragImage(row, event.offsetX, event.offsetY)
    }
  }
}

function updateColumnDropTarget(event: DragEvent, index: number): void {
  if (draggedColumnIndex.value === undefined) {
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  const { top, height } = (event.currentTarget as HTMLElement).getBoundingClientRect()
  columnDropIndex.value = index + Number(event.clientY >= top + height / 2)
}

function dropColumn(event: DragEvent, index: number): void {
  updateColumnDropTarget(event, index)
  const from = draggedColumnIndex.value
  const target = columnDropIndex.value
  if (from !== undefined && target !== undefined) {
    moveColumn(from, target > from ? target - 1 : target)
  }
  resetColumnDrag()
}

function resetColumnDrag(): void {
  draggedColumnIndex.value = undefined
  columnDropIndex.value = undefined
}

function moveColumnWithKey(event: KeyboardEvent, index: number, step: number): void {
  const row = (event.currentTarget as HTMLElement).closest('tr')
  const nextRow = step < 0 ? row?.previousElementSibling : row?.nextElementSibling
  if (moveColumn(index, index + step)) {
    void nextTick(() => nextRow?.querySelector<HTMLButtonElement>('[data-column-handle]')?.focus())
  }
}

function chartLabel(chart: ComponentSFCTimelineVisualNode, index: number): string {
  const title = chart.attributes.find(item => item.name === 'title')?.value
  const label = title?.kind === 'literal' && typeof title.value === 'string' ? title.value : t('timelineEditor.chartTitle', { index: index + 1 })
  return chart.attributes.some(item => item.name === 'for') ? [label, t('timelineEditor.templateSuffix')].join(' ') : label
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
    <SettingsNavigationPanel
      v-model="activeSection"
      v-model:sidebar-width="sidebarWidth"
      :default-sidebar-width="216"
      class="h-full"
      navigation-class="bg-muted/20"
      :separator-label="$t('documentMetadata.resizeNavigation')"
    >
      <template #navigation>
        <TabsList class="flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-none bg-transparent p-2">
          <template v-for="section in availableSections" :key="section.id">
            <div v-if="section.id === 'recipes'">
              <div class="flex min-w-0 items-center gap-0.5 rounded-md" :class="{ 'bg-background/70 text-foreground': recipeSectionOpen }">
                <Button
                  type="button" size="sm" variant="ghost" class="h-9 min-w-0 flex-1 justify-start gap-1.5 px-2.5 text-sm"
                  :aria-expanded="recipesExpanded" :aria-controls="recipesNavId" @click="toggleRecipes"
                >
                  <component :is="section.icon" class="size-3.5 shrink-0 text-muted-foreground transition-transform" :class="{ 'rotate-90': recipesExpanded }" aria-hidden="true" />
                  <span class="truncate">{{ section.label }}</span>
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" class="mr-1 size-7 shrink-0"
                  :aria-label="$t('timelineEditor.recipes.add')" :title="$t('timelineEditor.recipes.add')"
                  @click="error = createRecipe() ?? ''"
                >
                  <Plus class="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div :id="recipesNavId">
                <div v-if="recipesExpanded && (recipeSections.length || recipePresetName)" class="ml-4 mt-1 space-y-0.5 border-l border-border/70 pl-1.5">
                  <TabsTrigger
                    v-for="recipe in recipeSections" :key="recipe.id" :value="recipe.id"
                    class="h-8 w-full min-w-0 justify-start gap-1.5 rounded-md border-0 border-l-2 border-l-transparent px-2 text-left text-xs shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                    :title="recipe.label"
                  >
                    <span class="min-w-0 flex-1 truncate">{{ recipe.label }}</span>
                    <code v-if="recipe.kind" class="max-w-16 shrink-0 truncate text-[10px] text-muted-foreground">{{ recipe.kind }}</code>
                  </TabsTrigger>
                  <TabsTrigger
                    v-if="recipePresetName" value="recipes"
                    class="h-8 w-full justify-start rounded-md border-0 border-l-2 border-l-transparent px-2 text-left text-xs shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground"
                  >
                    <span class="truncate">{{ $t('timelineEditor.recipes.presetNavigation') }}</span>
                  </TabsTrigger>
                </div>
              </div>
            </div>
            <TabsTrigger
              v-else :value="section.id"
              class="group h-9 w-full justify-start gap-2 rounded-md border-0 border-l-2 border-l-transparent px-2.5 text-left text-sm font-medium shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <component :is="section.icon" class="size-3.5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
              <span class="truncate">{{ section.label }}</span>
            </TabsTrigger>
          </template>
        </TabsList>
      </template>

      <header
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-2.5 sm:px-5"
        :class="{ 'lg:hidden': recipeOpen && recipeToolbarHost && projection.tag !== 'TimelineGroup' }"
      >
        <h2 v-if="!recipeOpen" class="hidden text-sm font-semibold lg:block">
          {{ sectionLabel }}
        </h2>
        <div class="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <select
            v-if="projection.tag === 'TimelineGroup'"
            v-model="chartSelection"
            class="timeline-select min-w-0 max-w-64 flex-1 lg:flex-initial"
            :aria-label="$t('timelineEditor.chart')"
          >
            <option value="group">
              {{ $t('timelineEditor.group') }}
            </option>
            <option v-for="(chart, index) in projection.charts" :key="index" :value="index">
              {{ chartLabel(chart, index) }}
            </option>
          </select>
          <select v-model="activeSection" class="timeline-select min-w-0 max-w-48 flex-1 lg:hidden" :aria-label="$t('timelineEditor.settings')">
            <template v-for="section in availableSections" :key="section.id">
              <optgroup v-if="section.id === 'recipes' && recipeSections.length" :label="section.label">
                <option v-for="recipe in recipeSections" :key="recipe.id" :value="recipe.id">
                  {{ recipe.label }}
                </option>
                <option v-if="recipePresetName" value="recipes">
                  {{ $t('timelineEditor.recipes.presetNavigation') }}
                </option>
              </optgroup>
              <option v-else :value="section.id">
                {{ section.label }}
              </option>
            </template>
          </select>
          <Button
            v-if="recipeSectionOpen" type="button" size="icon" variant="ghost" class="size-8 lg:hidden"
            :aria-label="$t('timelineEditor.recipes.add')" :title="$t('timelineEditor.recipes.add')" @click="error = createRecipe() ?? ''"
          >
            <Plus class="size-4" aria-hidden="true" />
          </Button>
          <Teleport :to="recipeToolbarHost ?? undefined" :disabled="!recipeOpen || !recipeToolbarHost">
            <TooltipProvider :delay-duration="350">
              <div class="flex items-center gap-1" :class="{ 'shrink-0 rounded-md border bg-muted/40 p-0.5': recipeOpen && recipeToolbarHost }">
                <Tooltip v-if="recipeOpen">
                  <TooltipTrigger as-child>
                    <Button size="icon" class="size-8" :variant="constructorOpen ? 'secondary' : 'ghost'" :aria-label="$t('timelineEditor.recipes.constructor')" :aria-pressed="constructorOpen" :aria-disabled="freezePane && constructorOpen" @click="!(freezePane && constructorOpen) && (constructorOpen = !constructorOpen)">
                      <PanelLeft class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ $t('timelineEditor.recipes.constructor') }}</TooltipContent>
                </Tooltip>
                <Tooltip v-if="recipeOpen">
                  <TooltipTrigger as-child>
                    <Button size="icon" class="size-8" :variant="jsonOpen ? 'secondary' : 'ghost'" :aria-label="$t('timelineEditor.recipes.jsonPanel')" :aria-pressed="jsonOpen" :aria-disabled="freezePane && jsonOpen" @click="!(freezePane && jsonOpen) && (jsonOpen = !jsonOpen)">
                      <CodeXml class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ $t('timelineEditor.recipes.jsonPanel') }}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="icon" class="size-8" :variant="previewOpen ? 'secondary' : 'ghost'" :aria-label="$t('runtimeWorkflow.preview')" :aria-pressed="previewOpen" :aria-controls="previewOpen ? previewId : undefined" :aria-disabled="freezePane && previewOpen" @click="!(freezePane && previewOpen) && (previewOpen = !previewOpen)">
                      <Eye class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ $t('runtimeWorkflow.preview') }}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </Teleport>
        </div>
      </header>

      <p v-if="error" role="alert" class="shrink-0 border-b border-destructive/20 px-5 py-2 text-sm text-destructive">
        {{ error }}
      </p>

      <div ref="settingsBody" class="flex min-h-0 flex-1 flex-col">
        <SplitterGroup :direction="splitDirection" :auto-save-id="`timeline-workspace-${splitDirection}`" :storage="splitterStorage" class="min-h-0 min-w-0 flex-1">
          <SplitterPanel v-if="settingsOpen" :order="1" :min-size="panelCount > 1 ? 18 : 0" :default-size="panelCount === 3 ? 42 : panelCount === 2 ? 50 : 100" class="flex min-h-0 min-w-0 flex-col">
            <TabsContent value="general" class="timeline-settings-tab">
              <div class="max-w-xl space-y-4">
                <div v-if="!groupSelected" class="grid gap-2">
                  <label class="text-sm font-medium" for="timeline-data">{{ $t('timelineEditor.data') }}</label>
                  <Button v-if="binding('data')" variant="outline" class="min-w-0 justify-start font-mono" @click="openBinding('data')">
                    <span class="truncate">{{ binding('data') }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                  </Button>
                  <select v-else-if="inputs.length" id="timeline-data" class="timeline-select" value="" @change="set('data', `props.${inputValue($event, 'text')}`, true)">
                    <option value="" disabled>
                      {{ literal('data') ? $t('timelineEditor.localData') : $t('timelineEditor.chooseInput') }}
                    </option>
                    <option v-for="name in inputs" :key="name" :value="name">
                      {{ name }}
                    </option>
                  </select>
                  <Button v-else variant="outline" @click="openBinding('data')">
                    {{ literal('data') ? $t('timelineEditor.localData') : $t('timelineEditor.setData') }} {{ $t('timelineEditor.sourceSuffix') }}
                  </Button>
                </div>

                <div v-if="groupSelected && attribute('range')" class="grid gap-2">
                  <span class="text-sm font-medium">{{ $t('timelineEditor.groupRange') }}</span>
                  <Button variant="outline" class="justify-start" @click="openBinding('range')">
                    {{ binding('range') ?? $t('timelineEditor.initialRange') }} {{ $t('timelineEditor.sourceSuffix') }}
                  </Button>
                </div>

                <div v-if="!groupSelected && binding('options')" class="grid gap-1">
                  <label :for="`${previewId}-options`" class="text-sm font-medium">{{ $t('timelineEditor.options') }}</label>
                  <Button :id="`${previewId}-options`" variant="outline" class="min-w-0 justify-start font-mono" @click="openBinding('options')">
                    <span class="truncate">{{ binding('options') }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                  </Button>
                </div>

                <div
                  v-for="field in groupSelected ? groupFields : chartFields"
                  :key="field.key"
                  :class="field.type === 'boolean' && !binding(field.key) ? 'flex items-center gap-2' : 'grid gap-1'"
                >
                  <Checkbox v-if="field.type === 'boolean' && !binding(field.key)" :id="`${previewId}-${field.key}`" :model-value="literal(field.key) === true" @update:model-value="set(field.key, $event === true)" />
                  <label :for="`${previewId}-${field.key}`" class="text-sm font-medium">{{ field.label }}</label>
                  <Button v-if="binding(field.key)" :id="`${previewId}-${field.key}`" variant="outline" class="min-w-0 justify-start font-mono" @click="openBinding(field.key)">
                    <span class="truncate">{{ binding(field.key) }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                  </Button>
                  <select v-else-if="field.type === 'select'" :id="`${previewId}-${field.key}`" class="timeline-select" :value="literal(field.key) ?? field.fallback" @change="set(field.key, inputValue($event, field.type))">
                    <option v-for="value in field.values" :key="value" :value="value">
                      {{ value }}
                    </option>
                  </select>
                  <Input v-else-if="field.type !== 'boolean'" :id="`${previewId}-${field.key}`" :type="field.type" :model-value="scalar(literal(field.key) ?? field.fallback)" @change="set(field.key, inputValue($event, field.type))" />
                </div>

                <div v-if="!groupSelected" class="space-y-3 border-t pt-4">
                  <div class="grid gap-1">
                    <label :for="`${previewId}-preset`" class="text-sm font-medium">{{ $t('timelineEditor.preset') }}</label>
                    <Button v-if="binding('preset')" :id="`${previewId}-preset`" variant="outline" class="w-full min-w-0 justify-start font-mono" @click="openBinding('preset')">
                      <span class="truncate">{{ binding('preset') }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                    </Button>
                    <select v-else :id="`${previewId}-preset`" class="timeline-select" :value="literal('preset') ?? ''" @change="changePreset(inputValue($event, 'text'))">
                      <option value="">
                        {{ $t('timelineEditor.standard') }}
                      </option>
                      <option v-if="literal('preset') && !preset" :value="literal('preset')">
                        {{ literal('preset') }}{{ ' (' }}{{ $t('timelineEditor.unavailable') }}{{ ')' }}
                      </option>
                      <option v-for="entry in presets" :key="entry.name" :value="entry.name">
                        {{ entry.label ?? entry.name }}
                      </option>
                    </select>
                  </div>
                  <Button v-if="binding('settings')" variant="outline" class="w-full min-w-0 justify-start font-mono" @click="openBinding('settings')">
                    <span class="truncate">{{ binding('settings') }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                  </Button>
                  <template v-else>
                    <div v-for="field in presetFields" :key="field.key" :class="field.type === 'boolean' ? 'flex items-center gap-2' : 'grid gap-1'">
                      <Checkbox v-if="field.type === 'boolean'" :id="`${previewId}-setting-${field.key}`" :model-value="Boolean(settings[field.key] ?? field.fallback)" @update:model-value="setSetting(field.key, $event === true)" />
                      <label :for="`${previewId}-setting-${field.key}`" class="text-sm">{{ field.label }}</label>
                      <select v-if="field.type === 'select'" :id="`${previewId}-setting-${field.key}`" class="timeline-select" :value="settings[field.key] ?? field.fallback" @change="setSetting(field.key, inputValue($event, field.type))">
                        <option v-for="value in field.values" :key="value" :value="value">
                          {{ value }}
                        </option>
                      </select>
                      <Input v-else-if="field.type !== 'boolean'" :id="`${previewId}-setting-${field.key}`" :type="field.type" :model-value="scalar(settings[field.key] ?? field.fallback)" @change="setSetting(field.key, inputValue($event, field.type))" />
                    </div>
                  </template>
                </div>
              </div>
            </TabsContent>

            <TabsContent v-if="!groupSelected" value="columns" class="timeline-settings-tab">
              <div class="max-w-4xl space-y-3">
                <Button v-if="binding('columns')" variant="outline" class="w-full min-w-0 justify-start font-mono" @click="openBinding('columns')">
                  <span class="truncate">{{ binding('columns') }} {{ $t('timelineEditor.sourceSuffix') }}</span>
                </Button>
                <template v-else>
                  <div v-if="columns.length" class="overflow-x-auto rounded-md border">
                    <table class="timeline-columns w-full min-w-[34rem] table-fixed text-xs" :aria-label="$t('timelineEditor.columns')">
                      <thead class="bg-muted/40 text-left">
                        <tr>
                          <th scope="col" class="w-9">
                            <span class="sr-only">{{ $t('timelineEditor.columnOrder') }}</span>
                          </th>
                          <th scope="col">
                            {{ $t('timelineEditor.id') }}
                          </th>
                          <th scope="col">
                            {{ $t('timelineEditor.field') }}
                          </th>
                          <th scope="col">
                            {{ $t('timelineEditor.title') }}
                          </th>
                          <th scope="col" class="w-24">
                            {{ $t('timelineEditor.width') }}
                          </th>
                          <th scope="col" class="w-24 text-center">
                            {{ $t('timelineEditor.sort') }}
                          </th>
                          <th scope="col" class="w-9">
                            <span class="sr-only">{{ $t('timelineEditor.removeColumn') }}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(column, index) in columns"
                          :key="index"
                          class="border-t border-border/70"
                          :class="{
                            'timeline-column-dragged': draggedColumnIndex === index,
                            'timeline-column-drop-before': columnDropIndex === index && draggedColumnIndex !== index && draggedColumnIndex !== index - 1,
                            'timeline-column-drop-after': index === columns.length - 1 && columnDropIndex === columns.length && draggedColumnIndex !== index,
                          }"
                          @dragover="updateColumnDropTarget($event, index)"
                          @drop="dropColumn($event, index)"
                        >
                          <td>
                            <Button
                              v-if="columns.length > 1"
                              type="button"
                              size="icon"
                              variant="ghost"
                              class="size-7 cursor-grab text-muted-foreground active:cursor-grabbing"
                              data-column-handle
                              draggable="true"
                              :aria-label="$t('timelineEditor.moveColumn', { column: column.id || index + 1 })"
                              aria-keyshortcuts="ArrowUp ArrowDown"
                              @dragstart="startColumnDrag($event, index)"
                              @dragend="resetColumnDrag"
                              @keydown.up.prevent.stop="moveColumnWithKey($event, index, -1)"
                              @keydown.down.prevent.stop="moveColumnWithKey($event, index, 1)"
                            >
                              <GripVertical class="pointer-events-none size-4" />
                            </Button>
                          </td>
                          <td><Input class="h-7 px-2 text-xs md:text-xs" :aria-label="$t('timelineEditor.id')" :model-value="column.id" @change="changeColumn(index, { id: String(inputValue($event, 'text') ?? '') })" /></td>
                          <td>
                            <TimelineBindingInput
                              :value="column.valueExpression ?? column.field"
                              :binding="column.valueExpression !== undefined"
                              :label="$t('timelineEditor.field')"
                              :bindings="columnBindings"
                              expression-example="$group.resource.name"
                              scope="timeline-column"
                              @change="(value, bound) => changeColumn(index, bound ? { valueExpression: value } : { field: value })"
                              @toggle="toggleColumnValue(index, column)"
                            />
                          </td>
                          <td>
                            <TimelineBindingInput
                              :value="column.titleExpression ?? column.title ?? ''"
                              :binding="column.titleExpression !== undefined"
                              :label="$t('timelineEditor.title')"
                              :bindings="expressionBindings"
                              expression-example="t('timeline:columns.name', 'Имя')"
                              scope="timeline-title"
                              @change="(value, bound) => changeColumn(index, bound ? { titleExpression: value } : { title: value })"
                              @toggle="toggleColumnTitle(index, column)"
                            />
                          </td>
                          <td><Input class="h-7 px-2 text-xs md:text-xs" type="number" :aria-label="$t('timelineEditor.width')" :model-value="column.width" @change="changeColumn(index, { width: Number(inputValue($event, 'number')) })" /></td>
                          <td class="text-center">
                            <Checkbox class="align-middle" :aria-label="$t('timelineEditor.sort')" :model-value="column.sortable ?? false" @update:model-value="changeColumn(index, { sortable: $event === true })" />
                          </td>
                          <td>
                            <Button type="button" size="icon" variant="ghost" class="size-7 text-muted-foreground hover:text-destructive" :aria-label="$t('timelineEditor.removeColumn')" @click="setColumns(columns.filter((_, i) => i !== index))">
                              <X class="size-4" />
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Button size="sm" variant="outline" @click="addColumn">
                    {{ $t('timelineEditor.addColumn') }}
                  </Button>
                </template>
              </div>
            </TabsContent>

            <TabsContent v-if="recipeSectionOpen" :value="activeSection" :aria-label="sectionLabel" class="timeline-settings-tab">
              <div ref="recipeHost" />
            </TabsContent>

            <TabsContent v-if="!groupSelected" value="regional" class="timeline-settings-tab">
              <div class="grid max-w-xl gap-4">
                <div v-if="!binding('timezone') || useContextTimezone" class="flex items-center gap-2">
                  <Checkbox :id="`${previewId}-context-timezone`" :model-value="useContextTimezone" @update:model-value="set('timezone', $event === true ? '$context.timezone' : null, true)" />
                  <label :for="`${previewId}-context-timezone`" class="text-sm font-medium">{{ $t('timelineEditor.useContextTimezone') }}</label>
                </div>
                <div v-if="!useContextTimezone" class="grid gap-1">
                  <label :for="`${previewId}-timezone`" class="text-sm">{{ $t('timelineEditor.timezone') }}</label>
                  <Button v-if="binding('timezone') || binding('options')" :id="`${previewId}-timezone`" variant="outline" class="justify-start font-mono" @click="openBinding(binding('timezone') ? 'timezone' : 'options')">
                    {{ binding('timezone') ?? binding('options') }} {{ $t('timelineEditor.sourceSuffix') }}
                  </Button>
                  <Input v-else :id="`${previewId}-timezone`" :model-value="scalar(literal('timezone') ?? options.timezone)" @change="literal('timezone') === undefined ? setOption(undefined, 'timezone', inputValue($event, 'text')) : set('timezone', inputValue($event, 'text'))" />
                </div>
              </div>
            </TabsContent>

            <template v-if="!groupSelected && !binding('options')">
              <TabsContent v-for="section in optionSections" :key="section.id" :value="section.id" class="timeline-settings-tab">
                <div class="max-w-xl space-y-3">
                  <div v-for="field in section.fields" :key="field.key" :class="field.type === 'boolean' ? 'flex items-center gap-2' : 'grid gap-1'">
                    <Checkbox v-if="field.type === 'boolean'" :id="`${previewId}-${section.id}-${field.key}`" :model-value="Boolean(optionValues(section.path)[field.key] ?? field.fallback)" @update:model-value="setOption(section.path, field.key, $event === true)" />
                    <label :for="`${previewId}-${section.id}-${field.key}`" class="text-sm">{{ field.label }}</label>
                    <select v-if="field.type === 'select'" :id="`${previewId}-${section.id}-${field.key}`" class="timeline-select" :value="optionValues(section.path)[field.key] ?? ''" @change="setOption(section.path, field.key, inputValue($event, field.type))">
                      <option value="">
                        {{ $t('timelineEditor.default') }}
                      </option>
                      <option v-for="value in field.values" :key="value" :value="value">
                        {{ value }}
                      </option>
                    </select>
                    <Input v-else-if="field.type !== 'boolean'" :id="`${previewId}-${section.id}-${field.key}`" :type="field.type" :model-value="scalar(optionValues(section.path)[field.key])" @change="setOption(section.path, field.key, inputValue($event, field.type))" />
                  </div>
                </div>
              </TabsContent>
            </template>
          </SplitterPanel>
          <SplitterResizeHandle v-if="settingsOpen && showJson" class="timeline-splitter" :aria-label="$t('timelineEditor.resizePanels')" />
          <SplitterPanel v-if="showJson" :order="2" :min-size="panelCount > 1 ? 16 : 0" :default-size="panelCount === 3 ? 26 : panelCount === 2 ? 50 : 100" class="flex min-h-0 min-w-0 flex-col overflow-auto">
            <div ref="jsonHost" class="flex min-h-0 flex-1 flex-col" />
          </SplitterPanel>
          <SplitterResizeHandle v-if="previewOpen && (settingsOpen || showJson)" class="timeline-splitter" :aria-label="$t('timelineEditor.resizePreview')" />
          <SplitterPanel v-if="previewOpen" :order="3" :min-size="panelCount > 1 ? 18 : 0" :default-size="panelCount === 3 ? 32 : panelCount === 2 ? 50 : 100" class="flex min-h-0 min-w-0 flex-col bg-card/60">
            <aside :id="previewId" class="flex min-h-0 flex-1 flex-col" :aria-label="$t('runtimeWorkflow.preview')">
              <div class="flex shrink-0 justify-end border-b px-3 py-1">
                <TooltipProvider :delay-duration="350">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button" size="sm" class="h-7 gap-1.5 px-2 text-xs"
                        :variant="previewGroupsHidden ? 'ghost' : 'secondary'"
                        :aria-pressed="!previewGroupsHidden"
                        @click="previewGroupsHidden = !previewGroupsHidden"
                      >
                        <PanelLeft class="size-3.5" aria-hidden="true" />
                        {{ $t('timelineEditor.previewGroups') }}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{{ previewGroupsHidden ? $t('timelineEditor.showPreviewGroups') : $t('timelineEditor.hidePreviewGroups') }}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div ref="previewHost" class="flex min-h-0 min-w-0 flex-1 flex-col" />
            </aside>
          </SplitterPanel>
        </SplitterGroup>

        <TimelineRecipesEditor
          v-if="recipeSectionOpen"
          :key="chartSelection"
          :configuration-host="recipeHost"
          :json-host="jsonHost"
          :recipes="selected.recipes"
          :recipe-index="recipeIndex"
          :previews="chartPreviews"
          :preset-name="recipePresetName"
          :preview-error="previewError || previewErrors[0]?.message"
          :prop-names="inputs"
          :patch="patchRecipe"
          :create-recipe="createRecipe"
          :remove-recipe="removeActiveRecipe"
          @select-recipe="openRecipe"
          @open-source="emit('openSource', $event)"
        />

        <Teleport v-if="previewEnabled" :to="previewHost ?? undefined" :disabled="!previewHost">
          <div v-show="previewHost" class="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
            <p v-if="previewErrors.length" role="alert" class="text-sm text-destructive">
              {{ previewErrors[0]?.message }}
            </p>
            <p v-else-if="previewError" role="alert" class="text-sm text-destructive">
              {{ previewError }}
            </p>
            <p v-else-if="previewStatus === 'loading'" role="status" class="text-sm text-muted-foreground">
              {{ $t('timelineEditor.recipes.loading') }}
            </p>
            <template v-else-if="compilation.ir && previewStatus === 'ready'">
              <p v-if="previewPresetErrors.length" role="status" class="mb-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {{ previewPresetErrors.join(' ') }} {{ $t('timelineEditor.presetPreviewFallback') }}
              </p>
              <div :class="previewGroupsHidden ? 'min-w-0' : 'min-w-[34rem]'">
                <EndgeAdapterRoot root-key="sfc" :ir="compilation.ir" :props="previewData" :translate="previewTranslate" :runtime-scope-id="moduleScope?.id" />
              </div>
            </template>
          </div>
        </Teleport>
      </div>
    </SettingsNavigationPanel>
  </div>
</template>

<style scoped>
.timeline-splitter {
  flex: 0 0 7px;
  background: var(--muted);
  border-inline: 1px solid var(--border);
  outline: none;
  touch-action: none;
}

.timeline-splitter[data-state='hover'],
.timeline-splitter[data-state='drag'],
.timeline-splitter:focus-visible {
  background: color-mix(in srgb, var(--primary) 35%, var(--muted));
}

.timeline-splitter[data-orientation='vertical'] {
  border-inline: 0;
  border-block: 1px solid var(--border);
}

.timeline-settings-tab {
  min-width: 0;
  min-height: 0;
  flex: 1;
  margin: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 1rem 1.25rem;
}

.timeline-settings-tab[data-state='inactive'] {
  display: none;
}

.timeline-select {
  width: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: .375rem;
  padding-inline: .625rem;
  background: var(--background);
  font-size: .875rem;
}

.timeline-columns :is(th, td) {
  padding: .25rem;
}

.timeline-columns th {
  font-weight: 600;
}

.timeline-column-dragged {
  opacity: .5;
}

.timeline-column-drop-before > td {
  box-shadow: inset 0 2px var(--primary);
}

.timeline-column-drop-after > td {
  box-shadow: inset 0 -2px var(--primary);
}
</style>
