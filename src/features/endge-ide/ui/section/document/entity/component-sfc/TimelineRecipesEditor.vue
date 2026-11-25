<script setup lang="ts">
import type {
  ComponentSFCTimelineRecipeSource,
  ComponentSFCTimelineRecipeVisualNode,
  TimelineRecipeBoundary,
  TimelineRecipeBounds,
  TimelineRecipeContent,
  TimelineRecipeGeometry,
  TimelineRecipeLayout,
  TimelineRecipeNode,
  TimelineRecipeOverlay,
  TimelineRecipeRect,
  TimelineRecipeSplit,
} from '@endge/core'
import type { TimelineRecipeChartPreview } from '@endge/ui-vue'
import type { WidgetInstanceComponent } from '@/components/layouts/grid/types'
import { createTimelineRecipeLayout, measureTimelineRecipe, timelineRecipeField, timelineRecipeRects, validateTimelineRecipeLayout } from '@endge/core'
import { useElementSize } from '@vueuse/core'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Columns2, ExternalLink, FileJson, Plus, Rows2, Scan, Smile, Trash2, Type } from 'lucide-vue-next'
import { computed, markRaw, onScopeDispose, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createWidgetInstance, destroyWidgetInstance, getWidget, getWidgetInstance, getWidgetInstances, registerWidget, setWidgetInstanceTitle, showWidget, unregisterWidget } from '@/components/layouts/grid/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/features/endge-ide/ui/components/searchable-select'
import { collectTimelineRecipeFields } from './timeline-recipe-sample'
import TimelineRecipeBoundaryEditor from './TimelineRecipeBoundaryEditor.vue'
import TimelineRecipeConditionInput from './TimelineRecipeConditionInput.vue'
import TimelineSampleTaskWidget from './TimelineSampleTaskWidget.vue'

const props = defineProps<{
  configurationHost: HTMLElement | null
  jsonHost: HTMLElement | null
  propNames: string[]
  recipes: readonly ComponentSFCTimelineRecipeVisualNode[]
  previews: readonly TimelineRecipeChartPreview[]
  presetName: string
  previewError?: string
  patch: (start: number | undefined, value: ComponentSFCTimelineRecipeSource | null) => string | null
}>()
const emit = defineEmits<{ openSource: [offset: number] }>()
const { t } = useI18n()
const idPrefix = useId()
const blockPalette = ['#478acf', '#297e6f', '#a3652e', '#7254a1']
const sides = [
  { id: 'left', axis: 'x', before: true, icon: ArrowLeft },
  { id: 'right', axis: 'x', before: false, icon: ArrowRight },
  { id: 'top', axis: 'y', before: true, icon: ArrowUp },
  { id: 'bottom', axis: 'y', before: false, icon: ArrowDown },
] as const
type Side = typeof sides[number]
interface BlockDrop {
  id: string
  side?: Side
}
const sideLabels = computed(() => ({
  left: t('timelineEditor.recipes.addLeft'),
  right: t('timelineEditor.recipes.addRight'),
  top: t('timelineEditor.recipes.addTop'),
  bottom: t('timelineEditor.recipes.addBottom'),
}))
const iconChoices = ['✓', '!', '●', '◆', '→', '★']
const alignments = computed(() => [
  { value: 'left', label: t('timelineEditor.recipes.left') },
  { value: 'center', label: t('timelineEditor.recipes.center') },
  { value: 'right', label: t('timelineEditor.recipes.right') },
])
const selectedRecipe = ref(0)
const selection = ref<string | null>('')
const chartKey = ref('')
const taskId = ref('')
const canvas = ref<HTMLElement>()
const { width: canvasWidth } = useElementSize(canvas)
const error = ref('')
const jsonDirty = ref(false)
const json = ref('')
const layout = ref<TimelineRecipeLayout>()
const fields = ref({ id: '', name: '', kind: '', when: '' })
const recipeChoices = computed(() => props.recipes.map((recipe, index) => ({
  value: String(index),
  label: recipe.name || recipe.id || t('timelineEditor.recipes.unnamed'),
})))
const current = computed(() => props.recipes[selectedRecipe.value])
const chart = computed(() => props.previews.find(item => item.chartKey === chartKey.value) ?? props.previews[0])
const selectedPreset = computed(() => props.presetName || chart.value?.presetName)
const tasks = computed(() => chart.value?.data.tasks ?? [])
const kinds = computed(() => [...new Set(tasks.value.flatMap(task => task.kind ? [task.kind] : []))])
const matchingTasks = computed(() => {
  const sameKind = fields.value.kind ? tasks.value.filter(task => task.kind === fields.value.kind) : []
  return sameKind.length ? sameKind : tasks.value
})
const sample = computed(() => matchingTasks.value.find(task => task.id === taskId.value) ?? matchingTasks.value[0])
const taskChoices = computed(() => matchingTasks.value.map(task => ({ value: task.id, label: taskLabel(task) })))
const sampleWidgetId = 'timeline-sample-task-json'
const sampleWidgetInstanceId = ref<string>()
const sampleWidgetTitle = computed(() => {
  const title = t('timelineEditor.recipes.sampleTaskJson')
  return sample.value ? `${title} · ${taskLabel(sample.value)}` : title
})
const conditionBindings = computed(() => {
  const runtime = chart.value?.expressionBindings ?? {}
  const declared = Object.fromEntries(props.propNames.map(name => [name, undefined]))
  const provided = runtime.props && typeof runtime.props === 'object' ? runtime.props : {}
  return {
    ...declared,
    ...runtime,
    props: { ...declared, ...provided },
    $task: sample.value,
    $group: chart.value?.data.groups?.find(group => group.id === sample.value?.groupId),
  }
})
const acceptedFields = computed(() => collectTimelineRecipeFields(tasks.value))
const textFields = computed(() => Object.values(acceptedFields.value).flat())
const taskHeight = computed(() => chart.value?.taskHeight ?? 24)
const start = computed(() => sample.value?.startTime ?? 0)
const end = computed(() => sample.value?.endTime ?? 3_600_000)
const domain = computed(() => Math.max(1, end.value - start.value))
const sampleTask = computed(() => sample.value ?? { startTime: start.value, endTime: end.value })
const geometry = computed(() => layout.value ? measureLayout(layout.value) : undefined)
const rectangles = computed(() => layout.value ? timelineRecipeRects(layout.value) : [])
const overlay = computed(() => layout.value?.overlays?.find(item => item.id === selection.value))
const selectedNode = computed(() => overlay.value ?? (layout.value && selection.value ? findNode(layout.value.layout, selection.value) : undefined))
const selectedRect = computed(() => selectedNode.value?.type === 'rect' ? selectedNode.value : undefined)
const insertTarget = computed(() => selection.value === null ? layout.value?.layout : !overlay.value ? selectedNode.value : undefined)
const removableBlock = computed(() => Boolean(overlay.value || (layout.value && selection.value && parentSplit(layout.value.layout, selection.value))))
const movableIds = computed(() => new Set(layout.value?.layout.type === 'split'
  ? rectangles.value.filter(rect => !layout.value?.overlays?.some(item => item.id === rect.id)).map(rect => rect.id)
  : []))
const movingBlock = ref('')
const dropTarget = ref<BlockDrop>()
const dropBounds = computed(() => dropTarget.value && nodeBounds(dropTarget.value.id, geometry.value))
let blockPointer: { id: string, pointer: number, x: number, y: number } | undefined
let drag: { pointer: number, id: string } | undefined

watch(sampleWidgetTitle, (title) => {
  if (sampleWidgetInstanceId.value) {
    setWidgetInstanceTitle(sampleWidgetInstanceId.value, title)
  }
})
watch(() => sampleWidgetInstanceId.value && getWidgetInstance(sampleWidgetInstanceId.value), (instance) => {
  if (!instance) {
    closeSampleTaskWidget()
  }
})
onScopeDispose(closeSampleTaskWidget)

function closeSampleTaskWidget() {
  const id = sampleWidgetInstanceId.value
  if (!id) {
    return
  }
  sampleWidgetInstanceId.value = undefined
  destroyWidgetInstance(id)
  if (!getWidgetInstances(sampleWidgetId).length) {
    unregisterWidget(sampleWidgetId)
  }
}

function showSampleTaskJson() {
  if (!sample.value) {
    return
  }
  if (sampleWidgetInstanceId.value && getWidgetInstance(sampleWidgetInstanceId.value)) {
    showWidget(sampleWidgetId)
    return
  }
  if (!getWidget(sampleWidgetId)) {
    registerWidget({
      id: sampleWidgetId,
      title: t('timelineEditor.recipes.sampleTaskJson'),
      icon: 'FileJson',
      content: 'component',
      defaultComponent: markRaw(TimelineSampleTaskWidget),
      singleton: true,
      defaultPosition: 'floating',
      allowedPositions: ['floating'],
      floatingConstraints: { minWidth: 280, minHeight: 180, defaultWidth: 440, defaultHeight: 340 },
    })
  }
  const instance: Omit<WidgetInstanceComponent, 'id' | 'definitionId'> = {
    title: sampleWidgetTitle.value,
    props: reactive({
      get task() {
        return sample.value
      },
    }),
    headerActions: {
      header: [{ id: 'close', icon: 'X', title: t('grid.widget.close'), onClick: closeSampleTaskWidget }],
      options: [],
    },
  }
  sampleWidgetInstanceId.value = createWidgetInstance(sampleWidgetId, instance)
}

watch(current, (recipe, previous) => {
  error.value = ''
  if (!recipe) {
    layout.value = undefined
    return
  }
  fields.value = { id: recipe.id, name: recipe.name, kind: recipe.kind, when: recipe.when }
  const keepJson = jsonDirty.value && recipe.id === previous?.id
  jsonDirty.value = keepJson
  try {
    layout.value = parseLayout(recipe.json)
    if (!keepJson) {
      json.value = JSON.stringify(layout.value, null, 2)
    }
    if (selection.value && !findNode(layout.value.layout, selection.value) && !layout.value.overlays?.some(item => item.id === selection.value)) {
      selection.value = ''
    }
  }
  catch (cause) {
    layout.value = undefined
    if (!keepJson) {
      json.value = recipe.json
    }
    error.value = message(cause)
  }
}, { immediate: true })

function read(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function parseLayout(source: string): TimelineRecipeLayout {
  const value: unknown = JSON.parse(source)
  validateTimelineRecipeLayout(value)
  return value
}

function nextId(prefix: string, existing: ReadonlySet<string>): string {
  let index = 1
  while (existing.has(`${prefix}-${index}`)) {
    index++
  }
  return `${prefix}-${index}`
}

function addRecipe(profile?: string) {
  const inherited = profile ? chart.value?.editableRecipes?.[profile] : undefined
  const matched = profile && tasks.value.find(task => chart.value?.profileByTask.get(task.id) === profile)
  const kind = inherited
    ? inherited.kind ?? ''
    : (matched ? matched.kind : profile ?? sample.value?.kind ?? kinds.value[0]) ?? ''
  const when = inherited?.when ?? (kind ? '' : 'true')
  if (inherited) {
    const existing = props.recipes.findIndex(item => item.kind === kind && item.when === when)
    if (existing >= 0) {
      selectedRecipe.value = existing
      if (matched) {
        taskId.value = matched.id
      }
      return
    }
  }
  const ids = new Set(props.recipes.map(item => item.id))
  const id = nextId('recipe', ids)
  const name = inherited?.name || profile || t('timelineEditor.recipes.newName', { index: props.recipes.length + 1 })
  const recipe = inherited?.recipe ?? createTimelineRecipeLayout()
  const result = props.patch(undefined, { id, name, kind, when, recipe })
  if (!result) {
    selectedRecipe.value = props.recipes.length
    if (matched) {
      taskId.value = matched.id
    }
  }
  error.value = result ?? ''
}

function removeRecipe() {
  if (!current.value) {
    return
  }
  const result = props.patch(current.value.sourceRange.start, null)
  if (!result) {
    selectedRecipe.value = Math.max(0, selectedRecipe.value - 1)
  }
  error.value = result ?? ''
}

function apply(next: TimelineRecipeLayout | undefined = layout.value): boolean {
  if (!next || !current.value) {
    return false
  }
  try {
    validateTimelineRecipeLayout(next)
    const data = Object.fromEntries(Object.entries(fields.value).map(([key, value]) => [key, value.trim()])) as typeof fields.value
    const result = props.patch(current.value.sourceRange.start, { ...data, recipe: next })
    error.value = result ?? ''
    return !result
  }
  catch (cause) {
    error.value = message(cause)
    return false
  }
}

function applyJson() {
  try {
    const next = parseLayout(json.value)
    if (apply(next)) {
      layout.value = next
      json.value = JSON.stringify(next, null, 2)
      jsonDirty.value = false
    }
  }
  catch (cause) {
    error.value = message(cause)
  }
}

function findNode(node: TimelineRecipeNode, id: string): TimelineRecipeNode | undefined {
  if (node.id === id) {
    return node
  }
  if (node.type === 'split') {
    return findNode(node.first, id) ?? findNode(node.second, id)
  }
}

function replaceNodes(node: TimelineRecipeNode, replacements: ReadonlyMap<string, TimelineRecipeNode>): TimelineRecipeNode {
  const replacement = replacements.get(node.id)
  if (replacement) {
    return replacement
  }
  if (node.type === 'rect') {
    return node
  }
  return { ...node, first: replaceNodes(node.first, replacements), second: replaceNodes(node.second, replacements) }
}

function replaceNode(node: TimelineRecipeNode, id: string, replacement: TimelineRecipeNode): TimelineRecipeNode {
  return replaceNodes(node, new Map([[id, replacement]]))
}

function blockIds(): Set<string> {
  const ids = new Set<string>()
  const visit = (node: TimelineRecipeNode) => {
    ids.add(node.id)
    if (node.type === 'split') {
      visit(node.first)
      visit(node.second)
    }
  }
  if (layout.value) {
    visit(layout.value.layout)
  }
  for (const item of layout.value?.overlays ?? []) {
    ids.add(item.id)
  }
  return ids
}

function replaceBlock(id: string, node: TimelineRecipeNode, commit = true) {
  if (!layout.value || jsonDirty.value) {
    return
  }
  const previousOverlays = layout.value.overlays
  const overlays = previousOverlays?.map(item => item.id === id ? { ...item, ...node } as TimelineRecipeOverlay : item)
  layout.value = {
    layout: replaceNode(layout.value.layout, id, node),
    ...(overlays ? { overlays } : {}),
  }
  json.value = JSON.stringify(layout.value, null, 2)
  if (commit) {
    apply()
  }
}

function split(rect: TimelineRecipeRect, axis: 'x' | 'y') {
  const bounds = geometry.value?.rectangles[rect.id]
  if (!bounds || !layout.value || jsonDirty.value) {
    return
  }
  const ids = blockIds()
  const id = nextId('split', ids)
  const second = { id: nextId('block', ids), type: 'rect' as const, fill: blockPalette[rectangles.value.length % blockPalette.length] ?? '#297e6f' }
  const at: TimelineRecipeBoundary = axis === 'x'
    ? { mode: 'ratio', offset: 0.5 }
    : { mode: 'px', edge: 'start', offset: Math.round(bounds.height / 2) }
  replaceBlock(rect.id, { id, type: 'split', axis, at, first: rect, second })
  selection.value = id
}

function measureLayout(recipe: TimelineRecipeLayout): TimelineRecipeGeometry {
  return measureTimelineRecipe(recipe, {
    bounds: { x: 0, y: 0, width: canvasWidth.value, height: taskHeight.value },
    task: sampleTask.value,
    timeToPx: time => (time - start.value) / domain.value * canvasWidth.value,
  })
}

function nodeBounds(id: string, measured?: TimelineRecipeGeometry): TimelineRecipeBounds | undefined {
  return measured?.rectangles[id] ?? measured?.dividers[id]?.bounds
}

function withAdjacentBlock(
  target: TimelineRecipeNode,
  block: TimelineRecipeRect,
  side: Side,
  bounds: TimelineRecipeBounds,
): TimelineRecipeSplit {
  const rowHeight = Math.min(bounds.height / 2, Math.max(1, Math.round(bounds.height / 4)))
  return {
    id: nextId('split', blockIds()),
    type: 'split',
    axis: side.axis,
    at: side.axis === 'x'
      ? { mode: 'ratio', offset: side.before ? 0.25 : 0.75 }
      : { mode: 'px', edge: side.before ? 'start' : 'end', offset: rowHeight },
    first: side.before ? block : target,
    second: side.before ? target : block,
  }
}

function commitTree(root: TimelineRecipeNode, blockId: string) {
  if (!layout.value || jsonDirty.value) {
    return
  }
  const next = { ...layout.value, layout: root }
  if (apply(next)) {
    layout.value = next
    json.value = JSON.stringify(next, null, 2)
    selection.value = blockId
  }
}

function insertAdjacent(side: Side) {
  const recipe = layout.value
  const target = insertTarget.value
  const bounds = target && nodeBounds(target.id, geometry.value)
  if (!recipe || !target || !bounds) {
    return
  }
  const block: TimelineRecipeRect = {
    id: nextId('block', blockIds()),
    type: 'rect',
    fill: blockPalette[rectangles.value.length % blockPalette.length] ?? '#297e6f',
  }
  commitTree(replaceNode(recipe.layout, target.id, withAdjacentBlock(target, block, side, bounds)), block.id)
}

function moveBlock(id: string, drop: BlockDrop) {
  const recipe = layout.value
  if (!recipe || id === drop.id) {
    return
  }
  const root = recipe.layout
  const block = findNode(root, id)
  const parent = parentSplit(root, id)
  const destination = findNode(root, drop.id)
  if (block?.type !== 'rect' || !parent || !destination) {
    return
  }
  if (!drop.side) {
    if (destination.type === 'rect') {
      commitTree(replaceNodes(root, new Map([[id, destination], [drop.id, block]])), id)
    }
    return
  }

  const sourceIsFirst = parent.first.id === id
  const sibling = sourceIsFirst ? parent.second : parent.first
  if ((destination === sibling || (destination === root && parent === root))
    && drop.side.axis === parent.axis && drop.side.before === sourceIsFirst) {
    return
  }
  const rest = replaceNode(root, parent.id, sibling)
  const target = destination === root ? rest : findNode(rest, drop.id)
  const bounds = target && nodeBounds(target.id, measureLayout({ ...recipe, layout: rest }))
  if (target && bounds) {
    commitTree(replaceNode(rest, target.id, withAdjacentBlock(target, block, drop.side, bounds)), id)
  }
}

function parentSplit(node: TimelineRecipeNode, id: string): TimelineRecipeSplit | undefined {
  if (node.type === 'split') {
    if (node.first.id === id || node.second.id === id) {
      return node
    }
    return parentSplit(node.first, id) ?? parentSplit(node.second, id)
  }
}

function chooseRecipe(index: number) {
  if (Number.isInteger(index) && index !== selectedRecipe.value) {
    selection.value = ''
    selectedRecipe.value = index
  }
}

function removeBlock(rect: TimelineRecipeRect) {
  if (!layout.value) {
    return
  }
  if (overlay.value?.id === rect.id) {
    removeOverlay(rect.id)
    return
  }
  const parent = parentSplit(layout.value.layout, rect.id)
  if (parent) {
    const remaining = parent.first.id === rect.id ? parent.second : parent.first
    replaceBlock(parent.id, remaining)
    selection.value = remaining.id
  }
}

function toggleContent(rect: TimelineRecipeRect, type: TimelineRecipeContent['type']) {
  setContent(rect, rect.content?.type === type
    ? undefined
    : {
        type,
        value: type === 'icon' ? iconChoices[0] : '',
        field: undefined,
      })
}

function colorValue(fill: string) {
  return /^#[0-9a-f]{6}$/i.test(fill) ? fill : '#478acf'
}

function removeOverlay(id: string) {
  if (!layout.value || jsonDirty.value) {
    return
  }
  layout.value = { ...layout.value, overlays: layout.value.overlays?.filter(item => item.id !== id) }
  selection.value = ''
  json.value = JSON.stringify(layout.value, null, 2)
  apply()
}

function setContent(node: TimelineRecipeRect, update?: Partial<TimelineRecipeContent>) {
  replaceBlock(node.id, {
    ...node,
    content: update
      ? {
          type: 'text',
          align: 'center',
          value: '',
          ...node.content,
          ...update,
        }
      : undefined,
  })
}

function updateLayer(item: TimelineRecipeOverlay, key: 'top' | 'height', event: Event) {
  const value = Number(read(event))
  if (Number.isFinite(value)) {
    replaceBlock(item.id, { ...item, [key]: Math.max(key === 'height' ? 1 : 0, value) })
  }
}

function setLayerBoundary(item: TimelineRecipeOverlay, key: 'from' | 'to', value?: TimelineRecipeBoundary) {
  replaceBlock(item.id, { ...item, [key]: value })
}

function style(bounds: TimelineRecipeBounds) {
  const scaleY = 100 / taskHeight.value
  return {
    left: `${bounds.x}px`,
    top: `${bounds.y * scaleY}%`,
    width: `${bounds.width}px`,
    height: `${bounds.height * scaleY}%`,
  }
}

function dividerStyle(item: NonNullable<typeof geometry.value>['dividers'][string]) {
  if (item.axis === 'x') {
    return style({ ...item.bounds, x: item.position, width: 0 })
  }
  return style({ ...item.bounds, y: item.position, height: 0 })
}

function locateBlockDrop(event: PointerEvent): BlockDrop | undefined {
  const area = canvas.value?.getBoundingClientRect()
  const root = layout.value?.layout
  if (!area?.height || !area.width || !root || !geometry.value) {
    return
  }
  const x = event.clientX - area.left
  const y = event.clientY - area.top
  const outside = [-x, x - area.width, -y, y - area.height]
  const overflow = Math.max(...outside)
  if (overflow > 0) {
    const side = sides[outside.indexOf(overflow)]
    return overflow <= 10 && side ? { id: root.id, side } : undefined
  }

  const rowY = y / area.height * taskHeight.value
  const id = [...movableIds.value].find((id) => {
    const box = geometry.value?.rectangles[id]
    return box && box.width > 0 && box.height > 0
      && x >= box.x && x < box.x + box.width && rowY >= box.y && rowY < box.y + box.height
  })
  if (!id || id === movingBlock.value) {
    return
  }
  const bounds = geometry.value.rectangles[id]!
  const column = (x - bounds.x) / bounds.width
  const row = (rowY - bounds.y) / bounds.height
  const edges = [column, 1 - column, row, 1 - row]
  const nearest = Math.min(...edges)
  return { id, side: nearest <= 0.23 ? sides[edges.indexOf(nearest)] : undefined }
}

function startBlockDrag(event: PointerEvent, id: string) {
  if (!event.isPrimary || event.button !== 0 || jsonDirty.value || !movableIds.value.has(id)) {
    return
  }
  blockPointer = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY }
  const button = event.currentTarget as HTMLButtonElement
  button.setPointerCapture(event.pointerId)
}

function dragBlock(event: PointerEvent) {
  const pointer = blockPointer
  if (!pointer || event.pointerId !== pointer.pointer) {
    return
  }
  if (!movingBlock.value && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5) {
    return
  }
  movingBlock.value = pointer.id
  dropTarget.value = locateBlockDrop(event)
}

function clearBlockDrag() {
  blockPointer = undefined
  movingBlock.value = ''
  dropTarget.value = undefined
}

function finishBlockDrag(event: PointerEvent) {
  if (blockPointer?.pointer !== event.pointerId) {
    return
  }
  const id = movingBlock.value
  const drop = id ? locateBlockDrop(event) : undefined
  clearBlockDrag()
  if (drop) {
    moveBlock(id, drop)
  }
}

function startDrag(event: PointerEvent, id: string) {
  if (event.button !== 0 || jsonDirty.value) {
    return
  }
  selection.value = id
  drag = { pointer: event.pointerId, id }
  const boundary = event.currentTarget as HTMLElement
  boundary.setPointerCapture(event.pointerId)
}

function moveDivider(id: string, point: number, commit: boolean) {
  if (!layout.value) {
    return
  }
  const divider = geometry.value?.dividers[id]
  const node = findNode(layout.value.layout, id)
  if (!divider || node?.type !== 'split') {
    return
  }
  const { bounds } = divider
  const origin = node.axis === 'x' ? bounds.x : bounds.y
  const extent = node.axis === 'x' ? bounds.width : bounds.height
  const position = Math.min(origin + extent, Math.max(origin, point))
  const at = node.at
  if (extent <= 0 || canvasWidth.value <= 0) {
    return
  }
  const offset = at.mode === 'ratio'
    ? Math.round((position - origin) / extent * 1_000) / 1_000
    : Math.round(at.mode === 'time'
        ? at.offset + (position - divider.position) / canvasWidth.value * domain.value
        : at.edge === 'start' ? position - origin : origin + extent - position)
  replaceBlock(id, { ...node, at: { ...at, offset } }, commit)
}

function dragDivider(event: PointerEvent) {
  if (drag?.pointer !== event.pointerId || !canvas.value) {
    return
  }
  const divider = geometry.value?.dividers[drag.id]
  if (!divider) {
    return
  }
  const area = canvas.value.getBoundingClientRect()
  const point = divider.axis === 'x'
    ? event.clientX - area.left
    : (event.clientY - area.top) / area.height * taskHeight.value
  moveDivider(drag.id, point, false)
}

function stopDrag(event: PointerEvent) {
  if (drag?.pointer !== event.pointerId) {
    return
  }
  drag = undefined
  apply()
}

function moveWithKey(event: KeyboardEvent, id: string) {
  const divider = geometry.value?.dividers[id]
  if (!divider || jsonDirty.value) {
    return
  }
  const decrease = divider.axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
  const increase = divider.axis === 'x' ? 'ArrowRight' : 'ArrowDown'
  if (event.key !== decrease && event.key !== increase) {
    return
  }
  event.preventDefault()
  moveDivider(id, divider.position + (event.key === decrease ? -1 : 1) * (event.shiftKey ? 10 : 1), true)
}

function previewContent(item: TimelineRecipeRect): string {
  const content = item.content
  if (!content) {
    return ''
  }
  return String((content.type === 'text' && content.field ? timelineRecipeField(sampleTask.value, content.field) : null) ?? content.value)
}

function taskLabel(task: typeof tasks.value[number]): string {
  const title = timelineRecipeField(task, 'title') ?? timelineRecipeField(task, 'name')
  return [title || task.id, task.kind].filter(Boolean).join(' · ')
}
</script>

<template>
  <Teleport v-if="configurationHost" :to="configurationHost">
    <div class="grid min-w-0 gap-4">
      <section v-if="selectedPreset" class="grid gap-2 rounded-md border bg-muted/20 p-3">
        <h3 class="text-xs font-medium">
          {{ $t('timelineEditor.recipes.fromPreset', { preset: selectedPreset }) }}
        </h3>
        <div v-for="profile in chart?.profiles" :key="profile" class="flex min-w-0 items-center justify-between gap-2 text-xs">
          <div class="min-w-0">
            <span v-if="chart?.editableRecipes?.[profile]?.name" class="mr-2 font-medium">{{ chart.editableRecipes[profile]?.name }}</span>
            <code class="break-all">{{ profile }}</code>
            <span v-if="chart?.defaultProfile === profile" class="ml-2 text-muted-foreground">{{ $t('timelineEditor.default') }}</span>
            <span
              v-if="kinds.some(kind => tasks.some(task => task.kind === kind && chart?.profileByTask.get(task.id) === profile))"
              class="ml-2 text-muted-foreground"
            >
              {{ kinds.filter(kind => tasks.some(task => task.kind === kind && chart?.profileByTask.get(task.id) === profile)).join(', ') }}
            </span>
          </div>
          <Button size="sm" variant="ghost" class="h-7" @click="addRecipe(profile)">
            {{ $t('timelineEditor.recipes.override') }}
          </Button>
        </div>
        <p v-if="!chart?.profiles.length" class="text-xs text-muted-foreground">
          {{ chart?.presetResolved ? $t('timelineEditor.recipes.emptyPreset') : $t('timelineEditor.recipes.noInherited') }}
        </p>
      </section>

      <div class="grid gap-1.5">
        <button
          v-for="(recipe, index) in recipes" :key="recipe.sourceRange.start" type="button"
          class="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
          :class="{ 'border-primary bg-primary/5': selectedRecipe === index }"
          :aria-pressed="selectedRecipe === index" @click="chooseRecipe(index)"
        >
          <span class="flex-1 truncate font-medium">{{ recipe.name || recipe.id || $t('timelineEditor.recipes.unnamed') }}</span>
          <code v-if="recipe.kind" class="text-xs text-muted-foreground">{{ recipe.kind }}</code>
        </button>
        <Button size="sm" variant="outline" class="justify-self-start" @click="addRecipe()">
          <Plus class="size-4" /> {{ $t('timelineEditor.recipes.add') }}
        </Button>
      </div>

      <p v-if="previewError" class="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" role="status">
        {{ previewError }}
      </p>
      <section v-if="current" class="@container/recipe grid min-w-0 gap-4 rounded-lg border bg-card p-3 sm:p-4">
        <div class="grid grid-cols-2 gap-2 @md/recipe:grid-cols-3">
          <label class="col-span-2 grid min-w-0 gap-1 text-xs @md/recipe:col-span-1">
            {{ $t('timelineEditor.recipes.name') }}
            <Input v-model="fields.name" @change="apply()" />
          </label>
          <label class="grid min-w-0 gap-1 text-xs">
            {{ $t('timelineEditor.id') }}
            <Input v-model="fields.id" @change="apply()" />
          </label>
          <label class="grid min-w-0 gap-1 text-xs">
            {{ $t('timelineEditor.recipes.kind') }}
            <Input v-model="fields.kind" :list="`${idPrefix}-kinds`" @change="apply()" />
            <datalist :id="`${idPrefix}-kinds`"><option v-for="kind in kinds" :key="kind" :value="kind" /></datalist>
          </label>
        </div>
        <details class="group/condition min-w-0 border-t border-border/70 pt-2">
          <summary class="flex min-h-7 cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight class="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/condition:rotate-90" aria-hidden="true" />
            {{ $t('timelineEditor.recipes.condition') }}
          </summary>
          <div class="mt-1 grid min-w-0 gap-1.5">
            <TimelineRecipeConditionInput v-model="fields.when" :bindings="conditionBindings" @commit="apply()" />
            <p class="text-xs leading-5 text-muted-foreground">
              {{ $t('timelineEditor.recipes.whenHint') }}
            </p>
          </div>
        </details>

        <p v-if="jsonDirty" class="text-xs text-muted-foreground">
          {{ $t('timelineEditor.recipes.pendingJson') }}
        </p>

        <fieldset v-if="layout" :disabled="jsonDirty" class="grid min-w-0 gap-3">
          <div class="flex flex-wrap items-end gap-3">
            <label v-if="previews.length > 1" class="grid min-w-0 gap-1 text-xs">
              {{ $t('timelineEditor.chart') }}
              <select v-model="chartKey" class="recipe-select">
                <option v-for="preview in previews" :key="preview.chartKey" :value="preview.chartKey">{{ preview.chartKey }}</option>
              </select>
            </label>
            <div v-if="sample" class="grid min-w-0 flex-1 gap-1 text-xs">
              <span>{{ $t('timelineEditor.recipes.sampleTask') }}</span>
              <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                <SearchableSelect :aria-label="$t('timelineEditor.recipes.sampleTask')" :model-value="sample.id" :options="taskChoices" @update:model-value="value => { if (typeof value === 'string') taskId = value }" />
                <Button
                  type="button" size="icon" variant="outline" class="text-muted-foreground"
                  :aria-label="$t('timelineEditor.recipes.showSampleTaskJson')"
                  :title="$t('timelineEditor.recipes.showSampleTaskJson')"
                  @click="showSampleTaskJson"
                >
                  <FileJson class="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <span v-else class="flex-1 text-xs text-muted-foreground">{{ $t('timelineEditor.recipes.noExamples') }}</span>
          </div>
          <div class="recipe-stage" @click.self="selection = ''">
            <div class="recipe-stage-header">
              <Button
                type="button" size="sm" :variant="selection === null ? 'secondary' : 'ghost'"
                class="gap-1.5 px-2 text-xs" :aria-pressed="selection === null"
                @click="selection = selection === null ? '' : null"
              >
                <Scan class="size-3.5" aria-hidden="true" />
                {{ $t('timelineEditor.recipes.selectLayout') }}
              </Button>
              <div v-if="selectedRect || insertTarget" class="recipe-tools" role="group" :aria-label="$t('timelineEditor.recipes.blockActions')">
                <template v-if="selectedRect">
                  <label class="recipe-fill" :style="{ backgroundColor: selectedRect.fill }" :title="$t('timelineEditor.recipes.fill')">
                    <input type="color" :aria-label="$t('timelineEditor.recipes.fill')" :value="colorValue(selectedRect.fill)" @change="replaceBlock(selectedRect.id, { ...selectedRect, fill: read($event) })">
                  </label>
                  <template v-if="!overlay">
                    <button type="button" :title="$t('timelineEditor.recipes.splitX')" :aria-label="$t('timelineEditor.recipes.splitX')" @click="split(selectedRect, 'x')">
                      <Columns2 class="size-4" />
                    </button>
                    <button type="button" :title="$t('timelineEditor.recipes.splitY')" :aria-label="$t('timelineEditor.recipes.splitY')" @click="split(selectedRect, 'y')">
                      <Rows2 class="size-4" />
                    </button>
                  </template>
                  <button type="button" :title="$t('timelineEditor.recipes.text')" :aria-label="$t('timelineEditor.recipes.text')" :aria-pressed="selectedRect.content?.type === 'text'" @click="toggleContent(selectedRect, 'text')">
                    <Type class="size-4" />
                  </button>
                  <button type="button" :title="$t('timelineEditor.recipes.icon')" :aria-label="$t('timelineEditor.recipes.icon')" :aria-pressed="selectedRect.content?.type === 'icon'" @click="toggleContent(selectedRect, 'icon')">
                    <Smile class="size-4" />
                  </button>
                  <button v-if="removableBlock" type="button" :title="$t('timelineEditor.recipes.removeBlock')" :aria-label="$t('timelineEditor.recipes.removeBlock')" @click="removeBlock(selectedRect)">
                    <Trash2 class="size-4" />
                  </button>
                </template>
                <div v-if="insertTarget" class="recipe-add-tools" :class="{ 'recipe-add-tools-bordered': selectedRect }">
                  <button v-for="side in sides" :key="side.id" type="button" :title="sideLabels[side.id]" :aria-label="sideLabels[side.id]" @click="insertAdjacent(side)">
                    <component :is="side.icon" class="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div
              ref="canvas" class="recipe-canvas"
              :class="{ 'recipe-layout-selected': selection === null, 'recipe-canvas-moving': movingBlock }"
              @click.self="selection = ''"
              @keydown.esc.stop="clearBlockDrag"
            >
              <template v-for="rect in rectangles" :key="rect.id">
                <div
                  v-if="geometry?.rectangles[rect.id]?.width && geometry.rectangles[rect.id]?.height"
                  class="recipe-rect" :class="{ 'recipe-selected': selection === rect.id, 'recipe-moving': movingBlock === rect.id }"
                  :style="{ ...style(geometry.rectangles[rect.id]!), backgroundColor: rect.fill }"
                >
                  <button
                    type="button" class="recipe-face" :style="{ textAlign: rect.content?.align ?? 'left' }"
                    :class="{ 'recipe-movable': movableIds.has(rect.id) }"
                    :aria-label="$t('timelineEditor.recipes.selectBlock', { id: rect.id })"
                    :aria-pressed="selection === rect.id"
                    :title="movableIds.has(rect.id) ? $t('timelineEditor.recipes.dragBlockHint') : undefined"
                    @click="selection = rect.id"
                    @pointerdown="startBlockDrag($event, rect.id)"
                    @pointermove="dragBlock"
                    @pointerup="finishBlockDrag"
                    @pointercancel="clearBlockDrag"
                    @lostpointercapture="clearBlockDrag"
                  >
                    {{ previewContent(rect) }}
                  </button>
                </div>
              </template>
              <button
                v-for="(divider, id) in geometry?.dividers" :key="id" type="button"
                class="recipe-divider" :class="[`recipe-divider-${divider.axis}`, { 'recipe-divider-active': id === selection, 'recipe-divider-invalid': divider.invalid }]"
                :style="dividerStyle(divider)" :aria-label="$t('timelineEditor.recipes.selectDivider', { id })"
                @click="selection = id" @pointerdown="startDrag($event, id)" @pointermove="dragDivider"
                @lostpointercapture="stopDrag" @keydown="moveWithKey($event, id)"
              >
                <span />
              </button>
              <div
                v-if="dropTarget && dropBounds"
                class="recipe-drop" :class="`recipe-drop-${dropTarget.side?.id ?? 'center'}`"
                :style="style(dropBounds)" aria-hidden="true"
              />
            </div>
          </div>
          <p v-if="Object.values(geometry?.dividers ?? {}).some(item => item.invalid)" class="text-xs text-muted-foreground">
            {{ $t('timelineEditor.recipes.unresolvedBoundary') }}
          </p>
          <div v-if="selectedNode?.type === 'split'" class="grid gap-3 rounded-md border p-3">
            <TimelineRecipeBoundaryEditor
              :boundary="selectedNode.at" :time="selectedNode.axis === 'x'" :instants="acceptedFields.instant" :durations="acceptedFields.duration"
              @update:boundary="value => { if (value && selectedNode?.type === 'split') replaceBlock(selectedNode.id, { ...selectedNode, at: value }) }"
            />
            <Button size="sm" variant="ghost" class="justify-self-start" @click="replaceBlock(selectedNode.id, selectedNode.first); selection = selectedNode.first.id">
              {{ $t('timelineEditor.recipes.collapseSplit') }}
            </Button>
          </div>

          <div v-if="selectedNode?.type === 'rect' && (selectedNode.content || overlay)" class="grid gap-3 rounded-md border bg-muted/15 p-3">
            <div v-if="selectedNode.content" class="grid gap-2 sm:grid-cols-2">
              <h3 class="col-span-full text-xs font-semibold">
                {{ $t('timelineEditor.recipes.content') }}
              </h3>
              <template v-if="selectedNode.content">
                <label class="grid min-w-0 gap-1 text-xs">
                  {{ $t('timelineEditor.recipes.align') }}
                  <select class="recipe-select" :value="selectedNode.content.align" @change="setContent(selectedNode, { align: read($event) as TimelineRecipeContent['align'] })">
                    <option v-for="align in alignments" :key="align.value" :value="align.value">{{ align.label }}</option>
                  </select>
                </label>
                <label v-if="selectedNode.content.type === 'icon'" class="grid min-w-0 gap-1 text-xs">
                  {{ $t('timelineEditor.recipes.icon') }}
                  <select class="recipe-select" :value="selectedNode.content.value" @change="setContent(selectedNode, { value: read($event) })">
                    <option v-if="!iconChoices.includes(selectedNode.content.value)" :value="selectedNode.content.value">{{ selectedNode.content.value }}</option>
                    <option v-for="icon in iconChoices" :key="icon" :value="icon">{{ icon }}</option>
                  </select>
                </label>
                <template v-else>
                  <label class="grid min-w-0 gap-1 text-xs">
                    {{ $t('timelineEditor.recipes.textField') }}
                    <select class="recipe-select" :value="selectedNode.content.field ?? ''" @change="setContent(selectedNode, { field: read($event) || undefined })">
                      <option value="">{{ $t('timelineEditor.recipes.staticText') }}</option>
                      <option v-if="selectedNode.content.field && !textFields.includes(selectedNode.content.field)" :value="selectedNode.content.field">{{ selectedNode.content.field }}</option>
                      <option v-for="field in textFields" :key="field" :value="field">{{ field }}</option>
                    </select>
                  </label>
                  <label class="col-span-full grid gap-1 text-xs">
                    {{ selectedNode.content.field ? $t('timelineEditor.recipes.fallbackText') : $t('timelineEditor.recipes.text') }}
                    <Input :model-value="selectedNode.content.value" @change="setContent(selectedNode, { value: read($event) })" />
                  </label>
                </template>
              </template>
            </div>

            <template v-if="overlay">
              <div class="grid gap-2 sm:grid-cols-2">
                <label class="grid min-w-0 gap-1 text-xs">{{ $t('timelineEditor.recipes.layerTop') }}
                  <Input type="number" min="0" :model-value="overlay.top" @change="updateLayer(overlay, 'top', $event)" />
                </label>
                <label class="grid min-w-0 gap-1 text-xs">{{ $t('timelineEditor.recipes.layerHeight') }}
                  <Input type="number" min="1" :model-value="overlay.height" @change="updateLayer(overlay, 'height', $event)" />
                </label>
              </div>
              <fieldset class="min-w-0 rounded border p-2">
                <legend class="px-1 text-xs">
                  {{ $t('timelineEditor.recipes.layerStart') }}
                </legend>
                <TimelineRecipeBoundaryEditor :boundary="overlay.from" :instants="acceptedFields.instant" :durations="acceptedFields.duration" optional time @update:boundary="setLayerBoundary(overlay, 'from', $event)" />
              </fieldset>
              <fieldset class="min-w-0 rounded border p-2">
                <legend class="px-1 text-xs">
                  {{ $t('timelineEditor.recipes.layerEnd') }}
                </legend>
                <TimelineRecipeBoundaryEditor :boundary="overlay.to" :instants="acceptedFields.instant" :durations="acceptedFields.duration" optional time default-edge="end" @update:boundary="setLayerBoundary(overlay, 'to', $event)" />
              </fieldset>
            </template>
          </div>
        </fieldset>

        <div class="flex flex-wrap justify-between gap-2 border-t pt-3">
          <Button size="sm" variant="ghost" @click="emit('openSource', current.sourceRange.start)">
            <ExternalLink class="size-4" /> {{ $t('uiText.sourceda13add2') }}
          </Button>
          <Button size="sm" variant="ghost" class="text-destructive" @click="removeRecipe">
            <Trash2 class="size-4" /> {{ $t('timelineEditor.recipes.remove') }}
          </Button>
        </div>
      </section>
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
    </div>
  </Teleport>

  <Teleport v-if="jsonHost" :to="jsonHost">
    <section class="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">
          {{ $t('timelineEditor.recipes.jsonPanel') }}
        </h2>
        <div v-if="current" class="min-w-0 flex-1">
          <SearchableSelect size="compact" :options="recipeChoices" :model-value="String(selectedRecipe)" :aria-label="$t('timelineEditor.recipes.title')" @update:model-value="value => chooseRecipe(Number(value))" />
        </div>
        <Button v-else size="sm" variant="outline" @click="addRecipe()">
          <Plus class="size-4" /> {{ $t('timelineEditor.recipes.add') }}
        </Button>
      </header>
      <template v-if="current">
        <textarea
          :aria-label="$t('timelineEditor.recipes.recipeJson')"
          :value="json"
          spellcheck="false"
          class="min-h-48 w-full flex-1 resize-none rounded-md border bg-background p-2.5 font-mono text-xs leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @input="json = read($event); jsonDirty = true"
        />
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :disabled="!jsonDirty && Boolean(layout)" @click="applyJson">
            {{ $t('timelineEditor.recipes.applyJson') }}
          </Button>
          <Button v-if="jsonDirty && layout" size="sm" variant="ghost" @click="json = JSON.stringify(layout, null, 2); jsonDirty = false; error = ''">
            {{ $t('timelineEditor.recipes.discardJson') }}
          </Button>
        </div>
        <p v-if="error" role="alert" class="text-xs text-destructive">
          {{ error }}
        </p>
      </template>
    </section>
  </Teleport>
</template>

<style scoped>
.recipe-select {
  min-width: 0;
  height: 2.25rem;
  padding-inline: .5rem;
  border: 1px solid var(--border);
  border-radius: .375rem;
  background: var(--background);
  color: inherit;
}

.recipe-stage {
  position: relative;
  min-width: 0;
  padding: .5rem 12px 12px;
  border: 1px solid var(--border);
  border-radius: .5rem;
  background: var(--muted);
}

.recipe-canvas {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 6rem;
  background: var(--background);
}

.recipe-rect { position: absolute; }
.recipe-face {
  width: 100%;
  height: 100%;
  padding-inline: 3px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: white;
  font-size: .6875rem;
  cursor: pointer;
}

.recipe-face:hover,
.recipe-face:focus-visible,
.recipe-selected .recipe-face {
  outline: 2px solid white;
  outline-offset: -3px;
  box-shadow: inset 0 0 0 1px var(--foreground);
}

.recipe-stage-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .375rem;
  min-height: 2rem;
  margin-bottom: .625rem;
}

.recipe-tools {
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  align-items: center;
  padding: 2px;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: .5rem;
  background: var(--background);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--foreground) 8%, transparent);
}

.recipe-add-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 100%;
}

.recipe-add-tools-bordered {
  border-inline-start: 1px solid var(--border);
  padding-inline-start: 3px;
}

.recipe-tools button,
.recipe-fill {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: .3rem;
}

.recipe-movable {
  cursor: grab;
  touch-action: none;
}
.recipe-canvas-moving .recipe-face { cursor: grabbing; }
.recipe-moving { opacity: .55; }
.recipe-layout-selected { outline: 2px solid var(--ring); }

.recipe-drop {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}
.recipe-drop-center {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}
.recipe-drop:not(.recipe-drop-center)::after {
  position: absolute;
  inset: var(--drop-inset);
  border-radius: 2px;
  background: var(--primary);
  box-shadow: 0 0 0 1px var(--background);
  content: '';
}
.recipe-drop-left { --drop-inset: 0 auto 0 0; }
.recipe-drop-right { --drop-inset: 0 0 0 auto; }
.recipe-drop-left::after, .recipe-drop-right::after { width: 3px; }
.recipe-drop-top { --drop-inset: 0 0 auto; }
.recipe-drop-bottom { --drop-inset: auto 0 0; }
.recipe-drop-top::after, .recipe-drop-bottom::after { height: 3px; }

.recipe-tools button:hover,
.recipe-tools button[aria-pressed='true'] { background: var(--accent); }
.recipe-fill {
  position: relative;
  border: 2px solid var(--background);
  outline: 1px solid var(--border);
  outline-offset: -1px;
}
.recipe-fill:focus-within { outline: 2px solid var(--ring); }
.recipe-fill input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}

.recipe-divider {
  position: absolute;
  z-index: 1;
  touch-action: none;
}
.recipe-divider-x { padding: 0 5px; transform: translateX(-5px); cursor: col-resize; }
.recipe-divider-y { padding: 5px 0; transform: translateY(-5px); cursor: row-resize; }
.recipe-divider span { display: block; background: white; opacity: .65; }
.recipe-divider-x span { width: 1px; height: 100%; }
.recipe-divider-y span { width: 100%; height: 1px; }
.recipe-divider:hover span, .recipe-divider-active span { opacity: 1; box-shadow: 0 0 0 1px var(--foreground); }
.recipe-divider-invalid span { background: #facc15; opacity: 1; }
</style>
