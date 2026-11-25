<script setup lang="ts">
import type {
  ComponentSFCTimelineRecipeSource,
  ComponentSFCTimelineRecipeVisualNode,
  TimelineRecipeBoundary,
  TimelineRecipeBounds,
  TimelineRecipeContent,
  TimelineRecipeElement,
  TimelineRecipeGeometry,
  TimelineRecipeLayout,
  TimelineRecipeNode,
  TimelineRecipeOverlay,
  TimelineRecipeRect,
  TimelineRecipeShape,
  TimelineRecipeSplit,
  TimelineRecipeStyle,
} from '@endge/core'
import type { TimelineRecipeChartPreview } from '@endge/ui-vue'
import type { Component, CSSProperties } from 'vue'
import type { WidgetInstanceComponent } from '@/components/layouts/grid/types'
import { applyTimelineRecipeStyle, compileComponentSFCExpression, createTimelineRecipeLayout, Endge, evaluateComponentSFCExpression, isTimelineRecipeContentVisible, measureTimelineRecipe, readTimelineRecipeText, resolveTimelineRecipeStyle, timelineRecipeExpressions, timelineRecipeField, timelineRecipeIconSvg, timelineRecipeRects, validateTimelineRecipeLayout } from '@endge/core'
import { timelineRecipeElementAsset } from '@endge/ui-vue'
import { useElementSize } from '@vueuse/core'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, Columns2, ExternalLink, FileJson, Image, Rows2, Scan, Smile, Trash2, Type, X } from 'lucide-vue-next'
import { computed, markRaw, onScopeDispose, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createWidgetInstance, destroyWidgetInstance, getWidget, getWidgetInstance, getWidgetInstances, registerWidget, setWidgetInstanceTitle, showWidget, unregisterWidget } from '@/components/layouts/grid/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import LucideAppearancePicker from '@/features/endge-ide/ui/components/LucideAppearancePicker.vue'
import { SearchableSelect } from '@/features/endge-ide/ui/components/searchable-select'
import { colorInputValue, readTimelineLucideShapes, timelineRecipeFillStyle } from './timeline-recipe-appearance'
import { collectTimelineRecipeFields } from './timeline-recipe-sample'
import TimelineRecipeAppearance from './TimelineRecipeAppearance.vue'
import TimelineRecipeBoundaryEditor from './TimelineRecipeBoundaryEditor.vue'
import TimelineRecipeElementPosition from './TimelineRecipeElementPosition.vue'
import TimelineRecipeExpressionInput from './TimelineRecipeExpressionInput.vue'
import TimelineRecipePrimitiveTools from './TimelineRecipePrimitiveTools.vue'
import TimelineRecipeStyleEditor from './TimelineRecipeStyleEditor.vue'
import TimelineRecipeTextEditor from './TimelineRecipeTextEditor.vue'
import TimelineRecipeToolButton from './TimelineRecipeToolButton.vue'
import TimelineSampleTaskWidget from './TimelineSampleTaskWidget.vue'

const props = defineProps<{
  configurationHost: HTMLElement | null
  jsonHost: HTMLElement | null
  propNames: string[]
  recipes: readonly ComponentSFCTimelineRecipeVisualNode[]
  recipeIndex: number
  previews: readonly TimelineRecipeChartPreview[]
  presetName: string
  previewError?: string
  patch: (start: number | undefined, value: ComponentSFCTimelineRecipeSource | null) => string | null
  createRecipe: (recipe: Omit<ComponentSFCTimelineRecipeSource, 'id'>) => string | null
  removeRecipe: () => string | null
}>()
const emit = defineEmits<{ openSource: [offset: number], selectRecipe: [index: number] }>()
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
const alignments = computed(() => [
  { value: 'left', label: t('timelineEditor.recipes.left') },
  { value: 'center', label: t('timelineEditor.recipes.center') },
  { value: 'right', label: t('timelineEditor.recipes.right') },
])
const selection = ref<string | null>('')
const chartKey = ref('')
const taskId = ref('')
const canvas = ref<HTMLElement>()
const { width: canvasWidth, height: canvasHeight } = useElementSize(canvas)
const error = ref('')
const jsonDirty = ref(false)
const json = ref('')
const layout = ref<TimelineRecipeLayout>()
const fields = ref({ id: '', name: '', kind: '', when: '' })
const current = computed(() => props.recipes[props.recipeIndex])
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
const taskHeight = computed(() => chart.value?.taskHeight ?? 24)
const start = computed(() => sample.value?.startTime ?? 0)
const end = computed(() => sample.value?.endTime ?? 3_600_000)
const domain = computed(() => Math.max(1, end.value - start.value))
const sampleTask = computed(() => sample.value ?? { startTime: start.value, endTime: end.value })
const previewExpressionSources = computed(() => JSON.stringify(layout.value ? timelineRecipeExpressions(layout.value) : []))
const previewExpressions = computed(() => new Map((JSON.parse(previewExpressionSources.value) as string[])
  .map(source => [source, compileComponentSFCExpression(source, { props: props.propNames, locals: ['$task', '$group'] }).value])))
const positionDraft = ref<{ id: string, position: TimelineRecipeElement['position'] }>()
const geometry = computed(() => {
  const recipe = layout.value
  if (!recipe) {
    return
  }
  const draft = positionDraft.value
  return measureLayout(draft
    ? {
        ...recipe,
        elements: recipe.elements?.map(item => item.id === draft.id ? { ...item, position: draft.position } : item),
      }
    : recipe)
})
const rectangles = computed(() => layout.value ? timelineRecipeRects(layout.value) : [])
const sampleStyles = computed<Record<string, ReturnType<typeof resolveTimelineRecipeStyle>>>(() => {
  const values = Object.create(null)
  for (const rect of rectangles.value) {
    if (rect.appearance) {
      values[rect.id] = resolveTimelineRecipeStyle(rect.appearance, evaluateSampleExpression)
    }
  }
  return values
})
const sampleRectangles = computed(() => rectangles.value.map((rect) => {
  const appearance = sampleStyles.value[rect.id]
  return appearance ? applyTimelineRecipeStyle(rect, appearance) : rect
}))
const sampleRectanglesById = computed(() => new Map(sampleRectangles.value.map(rect => [rect.id, rect])))
const overlay = computed(() => layout.value?.overlays?.find(item => item.id === selection.value))
const elementsById = computed(() => new Map(layout.value?.elements?.map(item => [item.id, item])))
const element = computed(() => selection.value ? elementsById.value.get(selection.value) : undefined)
const layoutBlocks = computed(() => layout.value ? timelineRecipeRects({ layout: layout.value.layout }).map(item => item.id) : [])
const selectedNode = computed(() => element.value ?? overlay.value ?? (layout.value && selection.value ? findNode(layout.value.layout, selection.value) : undefined))
const selectedRect = computed(() => selectedNode.value?.type === 'rect' ? selectedNode.value : undefined)
const contentWhen = ref('')
const insertTarget = computed(() => selection.value === null ? layout.value?.layout : !overlay.value && !element.value ? selectedNode.value : undefined)
const removableBlock = computed(() => Boolean(element.value || overlay.value || (layout.value && selection.value && parentSplit(layout.value.layout, selection.value))))
const movableIds = computed(() => new Set(layout.value?.layout.type === 'split' ? layoutBlocks.value : []))
const movingBlock = ref('')
const dropTarget = ref<BlockDrop>()
const dropBounds = computed(() => dropTarget.value && nodeBounds(dropTarget.value.id, geometry.value))
let blockPointer: { id: string, pointer: number, x: number, y: number } | undefined
let drag: { pointer: number, id: string } | undefined

watch(
  [() => selectedRect.value?.id, () => selectedRect.value?.content?.when],
  ([, when]) => { contentWhen.value = when ?? '' },
  { immediate: true },
)

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

watch([() => props.recipeIndex, current], ([index, recipe], [previousIndex, previous]) => {
  error.value = ''
  if (index !== previousIndex) {
    selection.value = ''
    clearBlockDrag()
  }
  const keepJson = jsonDirty.value && index === previousIndex && recipe?.id === previous?.id
  jsonDirty.value = keepJson
  if (!recipe) {
    layout.value = undefined
    return
  }
  fields.value = { id: recipe.id, name: recipe.name, kind: recipe.kind, when: recipe.when }
  try {
    layout.value = parseLayout(recipe.json)
    if (!keepJson) {
      json.value = JSON.stringify(layout.value, null, 2)
    }
    if (selection.value && !selectedNode.value) {
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

function overrideRecipe(profile: string) {
  const inherited = chart.value?.editableRecipes?.[profile]
  const matched = tasks.value.find(task => chart.value?.profileByTask.get(task.id) === profile)
  const kind = inherited
    ? inherited.kind ?? ''
    : (matched ? matched.kind : profile) ?? ''
  const when = inherited?.when ?? (kind ? '' : 'true')
  if (inherited) {
    const existing = props.recipes.findIndex(item => item.kind === kind && item.when === when)
    if (existing >= 0) {
      emit('selectRecipe', existing)
      if (matched) {
        taskId.value = matched.id
      }
      return
    }
  }
  const result = props.createRecipe({ name: inherited?.name || profile, kind, when, recipe: inherited?.recipe ?? createTimelineRecipeLayout() })
  if (!result && matched) {
    taskId.value = matched.id
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
  for (const item of [...(layout.value?.overlays ?? []), ...(layout.value?.elements ?? [])]) {
    ids.add(item.id)
  }
  return ids
}

function replaceBlock(id: string, node: TimelineRecipeNode | TimelineRecipeElement, commit = true) {
  const recipe = layout.value
  if (!recipe || jsonDirty.value) {
    return
  }
  const root = replaceNode(recipe.layout, id, node)
  const overlays = recipe.overlays?.map(item => item.id === id && node.type === 'rect' ? { ...item, ...node } : item)
  const elements = recipe.elements?.flatMap((item) => {
    if (item.id === id && node.type === 'rect') {
      return [{ ...item, ...node }]
    }
    return !item.position.blockId || findNode(root, item.position.blockId)?.type === 'rect' ? [item] : []
  })
  layout.value = { ...recipe, layout: root, overlays, elements }
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
    evaluate: evaluateSampleExpression,
    styles: sampleStyles.value,
  })
}

function evaluateSampleExpression(source: string): unknown {
  const value = previewExpressions.value.get(source)
  if (!value || value.kind === 'literal') {
    return value?.value
  }
  const context = chart.value?.expressionContext
  return evaluateComponentSFCExpression(value.expression, {
    props: context?.props ?? conditionBindings.value.props,
    locals: { ...context?.locals, $task: sampleTask.value, $group: conditionBindings.value.$group },
    context: context?.context ?? Endge.context.runtimeSnapshot(),
    host: context?.host ?? null,
    dataScope: context?.dataScope ?? null,
    translate: context?.translate,
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

function addPrimitive(type: TimelineRecipeShape | 'icon' | 'text') {
  const recipe = layout.value
  if (!recipe || jsonDirty.value) {
    return
  }
  const id = nextId('primitive', blockIds())
  const item: TimelineRecipeElement = {
    id,
    type: 'rect',
    shape: type === 'icon' || type === 'text' ? 'rect' : type,
    fill: type === 'icon' || type === 'text' ? 'transparent' : '#facc15',
    position: {
      x: { mode: 'ratio', offset: 0.5 },
      y: { mode: 'ratio', offset: 0.5 },
      width: type === 'text' ? 72 : type === 'rect' ? 24 : 14,
      height: 14,
    },
    content: type === 'icon'
      ? { type, align: 'center', value: 'Smile', iconSource: 'lucide', iconShapes: readTimelineLucideShapes(Smile) }
      : type === 'text' ? { type, align: 'center', value: t('timelineEditor.recipes.text') } : undefined,
  }
  const next = { ...recipe, elements: [...(recipe.elements ?? []), item] }
  if (apply(next)) {
    layout.value = next
    json.value = JSON.stringify(next, null, 2)
    selection.value = id
  }
}

function setElementPosition(position: TimelineRecipeElement['position']) {
  const item = element.value
  if (item) {
    replaceBlock(item.id, { ...item, position })
  }
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

function removeBlock(rect: TimelineRecipeRect) {
  if (!layout.value) {
    return
  }
  if (element.value?.id === rect.id) {
    const blockId = element.value.position.blockId
    const next = { ...layout.value, elements: layout.value.elements?.filter(item => item.id !== rect.id) }
    if (apply(next)) {
      layout.value = next
      json.value = JSON.stringify(next, null, 2)
      selection.value = blockId ?? null
    }
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
  if (rect.content?.type === type) {
    setContent(rect)
  }
  else if (type === 'icon') {
    selectLucideIcon('Check', Check, rect)
  }
  else {
    setContent(rect, {
      type: 'text',
      value: '',
      iconSource: undefined,
      iconShapes: undefined,
      iconVariants: undefined,
      iconColor: undefined,
    })
  }
}

function selectLucideIcon(name: string, icon: Component, rect = selectedRect.value, variant = false) {
  if (!rect) {
    return
  }
  try {
    const iconShapes = readTimelineLucideShapes(icon)
    if (!iconShapes.length) {
      throw new Error(t('timelineEditor.recipes.iconUnavailable'))
    }
    timelineRecipeIconSvg(iconShapes)
    const variants = rect.content?.iconVariants ?? []
    if (variant) {
      if (name !== rect.content?.value && !variants.some(item => item.name === name) && variants.length < 32) {
        setContent(rect, { iconVariants: [...variants, { name, shapes: iconShapes }] })
      }
      return
    }
    setContent(rect, {
      type: 'icon',
      value: name,
      field: undefined,
      expression: undefined,
      textStyle: undefined,
      iconSource: 'lucide',
      iconShapes,
      iconVariants: variants.length ? variants.filter(item => item.name !== name) : undefined,
    })
  }
  catch (cause) {
    error.value = String(cause instanceof Error ? cause.message : cause)
  }
}

function setIconSource(rect: TimelineRecipeRect, source: string) {
  if (source === 'lucide') {
    selectLucideIcon('Check', Check, rect)
  }
  else if (source === 'asset') {
    setContent(rect, { iconSource: 'asset', value: '', iconShapes: undefined, iconVariants: undefined, iconColor: undefined })
  }
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

function commitContentWhen(): void {
  const rect = selectedRect.value
  const when = contentWhen.value.trim() || undefined
  if (rect?.content && rect.content.when !== when) {
    setContent(rect, { when })
  }
}

function updateAppearance(appearance?: TimelineRecipeStyle): void {
  const rect = selectedRect.value
  if (rect) {
    replaceBlock(rect.id, { ...rect, appearance })
  }
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
  if (!event.isPrimary || event.button !== 0 || jsonDirty.value || (!movableIds.value.has(id) && !elementsById.value.has(id))) {
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
  const item = elementsById.value.get(pointer.id)
  if (item) {
    const rect = canvas.value?.getBoundingClientRect()
    const base = item.position.blockId ? geometry.value?.rectangles[item.position.blockId] : undefined
    if (rect?.width && rect.height) {
      positionDraft.value = {
        id: item.id,
        position: {
          ...item.position,
          x: shiftAnchor(item.position.x, event.clientX - pointer.x, base?.width ?? rect.width, domain.value / rect.width),
          y: shiftAnchor(item.position.y, (event.clientY - pointer.y) * taskHeight.value / rect.height, base?.height ?? taskHeight.value, 0),
        },
      }
    }
    return
  }
  dropTarget.value = locateBlockDrop(event)
}

function shiftAnchor<T extends TimelineRecipeBoundary>(anchor: T, delta: number, size: number, msPerPixel: number): T {
  if (anchor.offsetExpression || size <= 0) {
    return anchor
  }
  if (anchor.mode === 'ratio') {
    return { ...anchor, offset: Math.min(1, Math.max(0, anchor.offset + delta / size)) }
  }
  if (anchor.mode === 'time') {
    return { ...anchor, offset: anchor.offset + Math.round(delta * msPerPixel) }
  }
  return { ...anchor, offset: anchor.offset + Math.round(anchor.edge === 'start' ? delta : -delta) }
}

function clearBlockDrag() {
  blockPointer = undefined
  movingBlock.value = ''
  dropTarget.value = undefined
  positionDraft.value = undefined
}

function finishBlockDrag(event: PointerEvent) {
  if (blockPointer?.pointer !== event.pointerId) {
    return
  }
  const id = movingBlock.value
  const draft = positionDraft.value
  if (draft) {
    const item = elementsById.value.get(draft.id)
    clearBlockDrag()
    if (item) {
      selection.value = item.id
      replaceBlock(item.id, { ...item, position: draft.position })
    }
    return
  }
  const drop = id ? locateBlockDrop(event) : undefined
  clearBlockDrag()
  if (drop) {
    moveBlock(id, drop)
  }
}

function startDrag(event: PointerEvent, id: string) {
  if (event.button !== 0 || jsonDirty.value || dividerUsesExpression(id)) {
    return
  }
  selection.value = id
  drag = { pointer: event.pointerId, id }
  const boundary = event.currentTarget as HTMLElement
  boundary.setPointerCapture(event.pointerId)
}

function dividerUsesExpression(id: string): boolean {
  const node = layout.value && findNode(layout.value.layout, id)
  return node?.type === 'split' && Boolean(node.at.offsetExpression || (node.at.mode === 'time' && node.at.offsetField))
}

function moveDivider(id: string, point: number, commit: boolean) {
  if (!layout.value) {
    return
  }
  const divider = geometry.value?.dividers[id]
  const node = findNode(layout.value.layout, id)
  if (!divider || node?.type !== 'split' || dividerUsesExpression(id)) {
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
  return content.type === 'text' ? readTimelineRecipeText(content, sampleTask.value, evaluateSampleExpression) : content.value
}

function textFaceStyle(item: TimelineRecipeRect): CSSProperties {
  const content = item.content
  if (content?.type !== 'text') {
    return { textAlign: content?.align ?? 'left', color: content?.iconColor ?? '#fff' }
  }
  const style = content.textStyle
  return {
    textAlign: content.align,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: style?.vertical === 'top' ? 'flex-start' : style?.vertical === 'bottom' ? 'flex-end' : 'center',
    paddingInline: `${style?.paddingX ?? 3}px`,
    overflow: style?.clip === false ? 'visible' : 'hidden',
    fontFamily: style?.family ?? 'sans-serif',
    fontSize: `${style?.size ?? 11}px`,
    fontWeight: style?.bold ? 'bold' : 'normal',
    fontStyle: style?.italic ? 'italic' : 'normal',
    color: style?.color ?? '#fff',
    lineHeight: style?.lineHeight === undefined ? undefined : `${style.lineHeight}px`,
  }
}

function textFits(item: TimelineRecipeRect): boolean {
  const bounds = displayBounds(item.id)
  const style = item.content?.textStyle
  return Boolean(bounds && bounds.width >= (style?.minWidth ?? 12) && bounds.height >= (style?.minHeight ?? 0))
}

function displayBounds(id: string): TimelineRecipeBounds | undefined {
  return geometry.value?.elementClips?.[id] ?? geometry.value?.rectangles[id]
}

function displayStyle(id: string): CSSProperties {
  const bounds = displayBounds(id)
  if (!bounds) {
    return {}
  }
  const box = style(bounds)
  if (!elementsById.value.has(id)) {
    return box
  }
  // The editing stage stretches lanes on Y. Free primitives keep their pixel proportions.
  const center = (bounds.y + bounds.height / 2) / taskHeight.value * 100
  const height = Math.min(bounds.height, bounds.height * canvasHeight.value / taskHeight.value)
  return { ...box, top: `calc(${center}% - ${height / 2}px)`, height: `${height}px` }
}

const shapeImages = new WeakMap<HTMLCanvasElement, string>()
function previewPrimitive(item: TimelineRecipeRect): string | undefined {
  const primitive = elementsById.value.get(item.id)
  const bounds = geometry.value?.rectangles[item.id]
  const clip = geometry.value?.elementClips?.[item.id]
  if (primitive && bounds && clip) {
    const canvas = timelineRecipeElementAsset(primitive.shape, item, bounds, clip)
    if (canvas) {
      const source = shapeImages.get(canvas) ?? canvas.toDataURL()
      shapeImages.set(canvas, source)
      return source
    }
  }
}

function iconSize(id: string): number {
  const bounds = displayBounds(id)
  return bounds ? Math.max(0, Math.min(elementsById.value.has(id) ? Infinity : 12, bounds.width - 2, bounds.height - 2)) : 0
}

function previewIcon(item: TimelineRecipeRect): string | undefined {
  const shapes = item.content?.iconShapes
  if (item.content?.iconSource === 'lucide' && shapes) {
    return `data:image/svg+xml,${encodeURIComponent(timelineRecipeIconSvg(shapes, item.content.iconColor))}`
  }
}

function taskLabel(task: typeof tasks.value[number]): string {
  const title = timelineRecipeField(task, 'title') ?? timelineRecipeField(task, 'name')
  return [title || task.id, task.kind].filter(Boolean).join(' · ')
}
</script>

<template>
  <Teleport v-if="configurationHost" :to="configurationHost">
    <div class="grid min-w-0 gap-4">
      <section v-if="!current && selectedPreset" class="grid gap-2 rounded-md border bg-muted/20 p-3">
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
          <Button size="sm" variant="ghost" class="h-7" @click="overrideRecipe(profile)">
            {{ $t('timelineEditor.recipes.override') }}
          </Button>
        </div>
        <p v-if="!chart?.profiles.length" class="text-xs text-muted-foreground">
          {{ chart?.presetResolved ? $t('timelineEditor.recipes.emptyPreset') : $t('timelineEditor.recipes.noInherited') }}
        </p>
      </section>

      <p v-if="!current && !recipes.length" class="text-sm text-muted-foreground">
        {{ $t('timelineEditor.recipes.emptyNavigation') }}
      </p>

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
            <TimelineRecipeExpressionInput v-model="fields.when" :bindings="conditionBindings" :label="$t('timelineEditor.recipes.condition')" placeholder="$task.delayMs > 0" @commit="apply()" />
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
                <TooltipProvider :delay-duration="0" disable-hoverable-content>
                  <template v-if="selectedRect">
                    <TimelineRecipeAppearance :block="selectedRect" :rendered-fill="sampleRectanglesById.get(selectedRect.id)?.fill" :bindings="conditionBindings" :overlay="Boolean(overlay)" :shape="element?.shape" @update="block => replaceBlock(block.id, block)" />
                    <template v-if="!overlay && !element">
                      <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.splitX')" @click="split(selectedRect, 'x')">
                        <Columns2 class="size-4" />
                      </TimelineRecipeToolButton>
                      <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.splitY')" @click="split(selectedRect, 'y')">
                        <Rows2 class="size-4" />
                      </TimelineRecipeToolButton>
                    </template>
                    <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.text')" :aria-pressed="selectedRect.content?.type === 'text'" @click="toggleContent(selectedRect, 'text')">
                      <Type class="size-4" />
                    </TimelineRecipeToolButton>
                    <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.icon')" :aria-pressed="selectedRect.content?.type === 'icon'" @click="toggleContent(selectedRect, 'icon')">
                      <Smile class="size-4" />
                    </TimelineRecipeToolButton>
                    <TimelineRecipeToolButton v-if="removableBlock" :label="$t('timelineEditor.recipes.removeBlock')" @click="removeBlock(selectedRect)">
                      <Trash2 class="size-4" />
                    </TimelineRecipeToolButton>
                  </template>
                  <div v-if="insertTarget" class="recipe-add-tools" :class="{ 'recipe-add-tools-bordered': selectedRect }">
                    <TimelineRecipeToolButton v-for="side in sides" :key="side.id" :label="sideLabels[side.id]" @click="insertAdjacent(side)">
                      <component :is="side.icon" class="size-4" aria-hidden="true" />
                    </TimelineRecipeToolButton>
                  </div>
                  <TimelineRecipePrimitiveTools v-if="selection === null" class="recipe-add-tools-bordered" @choose="addPrimitive" />
                </TooltipProvider>
              </div>
            </div>
            <div
              ref="canvas" class="recipe-canvas"
              :class="{ 'recipe-layout-selected': selection === null, 'recipe-canvas-moving': movingBlock }"
              @click.self="selection = ''"
              @keydown.esc.stop="clearBlockDrag"
            >
              <template v-for="rect in sampleRectangles" :key="rect.id">
                <div
                  v-if="displayBounds(rect.id)?.width && displayBounds(rect.id)?.height"
                  class="recipe-rect" :class="{ 'recipe-selected': selection === rect.id, 'recipe-moving': movingBlock === rect.id, 'recipe-primitive': elementsById.has(rect.id) }"
                  :style="displayStyle(rect.id)"
                >
                  <img
                    v-if="elementsById.has(rect.id) && sampleStyles[rect.id]?.visible !== false"
                    :src="previewPrimitive(rect)" alt="" class="pointer-events-none absolute inset-0 size-full object-contain"
                    :class="{ invisible: rect.fill === 'transparent' && !rect.border }"
                  >
                  <div v-else-if="!elementsById.has(rect.id) && sampleStyles[rect.id]?.visible !== false" class="pointer-events-none absolute inset-0" :style="{ ...timelineRecipeFillStyle(rect.fill), opacity: rect.opacity, borderRadius: `${rect.radius ?? 0}px` }" />
                  <button
                    type="button" class="recipe-face" :style="textFaceStyle(rect)"
                    :class="{ 'recipe-movable': movableIds.has(rect.id) || elementsById.has(rect.id) }"
                    :aria-label="$t('timelineEditor.recipes.selectBlock', { id: rect.id })"
                    :aria-pressed="selection === rect.id"
                    :title="elementsById.has(rect.id) ? $t('timelineEditor.recipes.dragPrimitiveHint') : movableIds.has(rect.id) ? $t('timelineEditor.recipes.dragBlockHint') : undefined"
                    @click="selection = rect.id"
                    @pointerdown="startBlockDrag($event, rect.id)"
                    @pointermove="dragBlock"
                    @pointerup="finishBlockDrag"
                    @pointercancel="clearBlockDrag"
                    @lostpointercapture="clearBlockDrag"
                  >
                    <template v-if="sampleStyles[rect.id]?.visible === false || (rect.content && !isTimelineRecipeContentVisible(rect.content, evaluateSampleExpression))" />
                    <img v-else-if="rect.content?.iconSource === 'lucide' && rect.content.iconShapes?.length" :src="previewIcon(rect)" alt="" class="inline-block max-h-full max-w-full object-contain" :style="{ width: `${iconSize(rect.id)}px`, height: `${iconSize(rect.id)}px` }">
                    <Image v-else-if="rect.content?.iconSource === 'asset'" class="inline-block" :style="{ width: `${iconSize(rect.id)}px`, height: `${iconSize(rect.id)}px` }" aria-hidden="true" />
                    <span v-else-if="rect.content?.type === 'text' && textFits(rect)" class="pointer-events-none block w-full" :class="{ truncate: rect.content.textStyle?.ellipsis !== false }">
                      {{ previewContent(rect) }}
                    </span>
                    <template v-else-if="rect.content?.type !== 'text'">
                      {{ previewContent(rect) }}
                    </template>
                  </button>
                  <div v-if="!elementsById.has(rect.id) && rect.border && sampleStyles[rect.id]?.visible !== false" class="pointer-events-none absolute inset-0" :style="{ border: `${rect.border.width}px ${rect.border.style} ${rect.border.color}`, borderRadius: `${rect.radius ?? 0}px` }" />
                </div>
              </template>
              <button
                v-for="(divider, id) in geometry?.dividers" :key="id" type="button"
                class="recipe-divider" :class="[`recipe-divider-${divider.axis}`, { 'recipe-divider-active': id === selection, 'recipe-divider-invalid': divider.invalid, 'recipe-divider-expression': dividerUsesExpression(id) }]"
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
              :boundary="selectedNode.at" :time="selectedNode.axis === 'x'" :instants="acceptedFields.instant" :bindings="conditionBindings"
              @update:boundary="value => { if (value && selectedNode?.type === 'split') replaceBlock(selectedNode.id, { ...selectedNode, at: value }) }"
            />
          </div>

          <div v-if="selectedNode?.type === 'rect' && (selectedNode.content || overlay || element)" class="grid gap-3 rounded-md border bg-muted/15 p-3">
            <div v-if="selectedNode.content" class="grid gap-2 sm:grid-cols-2">
              <h3 class="col-span-full text-xs font-semibold">
                {{ $t('timelineEditor.recipes.content') }}
              </h3>
              <template v-if="selectedNode.content">
                <div v-if="selectedNode.content.type === 'icon'" class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
                  <label class="grid min-w-0 gap-1 text-xs">
                    {{ $t('timelineEditor.recipes.align') }}
                    <select class="recipe-select" :value="selectedNode.content.align" @change="setContent(selectedNode, { align: read($event) as TimelineRecipeContent['align'] })">
                      <option v-for="align in alignments" :key="align.value" :value="align.value">{{ align.label }}</option>
                    </select>
                  </label>
                  <TimelineRecipeStyleEditor field="align" :label="$t('timelineEditor.recipes.align')" :base="selectedNode.content.align" :bindings="conditionBindings" :appearance="selectedNode.appearance" @update="updateAppearance" />
                </div>
                <template v-if="selectedNode.content.type === 'icon'">
                  <label class="grid min-w-0 gap-1 text-xs">
                    {{ $t('timelineEditor.recipes.iconSource') }}
                    <select class="recipe-select" :value="selectedNode.content.iconSource ?? ''" @change="setIconSource(selectedNode, read($event))">
                      <option v-if="!selectedNode.content.iconSource" value="" disabled hidden>{{ $t('timelineEditor.recipes.iconChooseSource') }}</option>
                      <option value="asset">{{ $t('timelineEditor.recipes.iconAsset') }}</option>
                      <option value="lucide">{{ $t('timelineEditor.recipes.iconLucide') }}</option>
                    </select>
                  </label>
                  <div v-if="selectedNode.content.iconSource === 'lucide'" class="col-span-full grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
                    <LucideAppearancePicker
                      icon-only color="currentColor" :icon="selectedNode.content.value" @choose="selectLucideIcon"
                    />
                    <TimelineRecipeStyleEditor
                      field="iconName" :label="$t('timelineEditor.recipes.icon')" :base="selectedNode.content.value"
                      :bindings="conditionBindings" :appearance="selectedNode.appearance" @update="updateAppearance"
                    />
                    <div v-if="selectedNode.appearance?.expressions?.iconName || selectedNode.content.iconVariants?.length" class="col-span-full flex flex-wrap items-center gap-1.5">
                      <span v-for="variant in selectedNode.content.iconVariants" :key="variant.name" class="inline-flex items-center gap-1 rounded border px-1.5 text-xs">
                        <code>{{ variant.name }}</code>
                        <TimelineRecipeToolButton
                          :label="$t('timelineEditor.recipes.removeIconVariant', { name: variant.name })"
                          @click="setContent(selectedNode, { iconVariants: selectedNode.content.iconVariants?.filter(item => item.name !== variant.name) })"
                        >
                          <X class="size-3" />
                        </TimelineRecipeToolButton>
                      </span>
                      <LucideAppearancePicker
                        icon="" icon-only color="currentColor" :trigger-label="$t('timelineEditor.recipes.addIconVariant')"
                        :disabled="(selectedNode.content.iconVariants?.length ?? 0) >= 32"
                        @choose="(name, icon) => selectLucideIcon(name, icon, selectedRect, true)"
                      />
                    </div>
                  </div>
                  <div v-else-if="selectedNode.content.iconSource === 'asset'" class="col-span-full grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
                    <label class="grid min-w-0 gap-1 text-xs">
                      {{ $t('timelineEditor.recipes.iconAsset') }}
                      <Input placeholder="my-preset/icons/warning" :model-value="selectedNode.content.value" @change="setContent(selectedNode, { value: read($event) })" />
                    </label>
                    <TimelineRecipeStyleEditor field="assetId" :label="$t('timelineEditor.recipes.iconAsset')" :base="selectedNode.content.value" :bindings="conditionBindings" :appearance="selectedNode.appearance" @update="updateAppearance" />
                  </div>
                  <div v-if="selectedNode.content.iconSource !== 'asset'" class="flex items-end gap-1">
                    <label class="grid gap-1 text-xs">
                      {{ $t('timelineEditor.recipes.iconColor') }}
                      <Input
                        type="color" class="h-7 w-12 p-0.5" :model-value="colorInputValue(selectedNode.content.iconColor ?? '#ffffff')"
                        @change="setContent(selectedNode, { iconColor: read($event) })"
                      />
                    </label>
                    <TimelineRecipeStyleEditor
                      field="iconColor" color :label="$t('timelineEditor.recipes.iconColor')" :base="selectedNode.content.iconColor ?? '#ffffff'"
                      :bindings="conditionBindings" :appearance="selectedNode.appearance" @update="updateAppearance"
                    />
                  </div>
                </template>
                <TimelineRecipeTextEditor v-else class="col-span-full" :content="selectedNode.content" :bindings="conditionBindings" :appearance="selectedNode.appearance" @update="patch => { if (selectedNode?.type === 'rect') setContent(selectedNode, patch) }" @appearance="updateAppearance" />
              </template>
              <div class="col-span-full grid min-w-0 gap-1">
                <span class="text-xs font-medium">{{ $t('timelineEditor.recipes.contentWhen') }}</span>
                <TimelineRecipeExpressionInput
                  :key="selectedNode.id" v-model="contentWhen"
                  :bindings="conditionBindings" :label="$t('timelineEditor.recipes.contentWhen')"
                  placeholder="$task.takeoffDurationMinutes >= 20"
                  @commit="commitContentWhen"
                />
              </div>
            </div>

            <TimelineRecipeElementPosition
              v-if="element" :element="element" :blocks="layoutBlocks" :instants="acceptedFields.instant" :bindings="conditionBindings"
              @position="setElementPosition" @appearance="updateAppearance"
            />
            <template v-else-if="overlay">
              <div class="grid gap-2 sm:grid-cols-2">
                <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
                  <label class="grid min-w-0 gap-1 text-xs">{{ $t('timelineEditor.recipes.layerTop') }}
                    <Input type="number" min="0" :model-value="overlay.top" @change="updateLayer(overlay, 'top', $event)" />
                  </label>
                  <TimelineRecipeStyleEditor field="layerTop" :label="$t('timelineEditor.recipes.layerTop')" :base="overlay.top" :bindings="conditionBindings" :appearance="overlay.appearance" @update="updateAppearance" />
                </div>
                <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
                  <label class="grid min-w-0 gap-1 text-xs">{{ $t('timelineEditor.recipes.layerHeight') }}
                    <Input type="number" min="1" :model-value="overlay.height" @change="updateLayer(overlay, 'height', $event)" />
                  </label>
                  <TimelineRecipeStyleEditor field="layerHeight" :label="$t('timelineEditor.recipes.layerHeight')" :base="overlay.height" :bindings="conditionBindings" :appearance="overlay.appearance" @update="updateAppearance" />
                </div>
              </div>
              <fieldset class="min-w-0 rounded border p-2">
                <legend class="px-1 text-xs">
                  {{ $t('timelineEditor.recipes.layerStart') }}
                </legend>
                <TimelineRecipeBoundaryEditor :boundary="overlay.from" :instants="acceptedFields.instant" :bindings="conditionBindings" optional time @update:boundary="setLayerBoundary(overlay, 'from', $event)" />
              </fieldset>
              <fieldset class="min-w-0 rounded border p-2">
                <legend class="px-1 text-xs">
                  {{ $t('timelineEditor.recipes.layerEnd') }}
                </legend>
                <TimelineRecipeBoundaryEditor :boundary="overlay.to" :instants="acceptedFields.instant" :bindings="conditionBindings" optional time default-edge="end" @update:boundary="setLayerBoundary(overlay, 'to', $event)" />
              </fieldset>
            </template>
          </div>
        </fieldset>

        <div class="flex flex-wrap justify-between gap-2 border-t pt-3">
          <Button size="sm" variant="ghost" @click="emit('openSource', current.sourceRange.start)">
            <ExternalLink class="size-4" /> {{ $t('uiText.sourceda13add2') }}
          </Button>
          <Button size="sm" variant="ghost" class="text-destructive" @click="error = removeRecipe() ?? ''">
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
  position: relative;
  z-index: 1;
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
.recipe-primitive .recipe-face { z-index: 3; }

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

.recipe-tools :deep(button) {
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

.recipe-tools :deep(button:hover),
.recipe-tools :deep(button[aria-pressed='true']) { background: var(--accent); }

.recipe-divider {
  position: absolute;
  z-index: 2;
  touch-action: none;
}
.recipe-divider-x { padding: 0 5px; transform: translateX(-5px); cursor: col-resize; }
.recipe-divider-y { padding: 5px 0; transform: translateY(-5px); cursor: row-resize; }
.recipe-divider-expression { cursor: pointer; }
.recipe-divider span { display: block; background: white; opacity: .65; }
.recipe-divider-x span { width: 1px; height: 100%; }
.recipe-divider-y span { width: 100%; height: 1px; }
.recipe-divider:hover span, .recipe-divider-active span { opacity: 1; box-shadow: 0 0 0 1px var(--foreground); }
.recipe-divider-invalid span { background: #facc15; opacity: 1; }
</style>
