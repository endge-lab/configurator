<script setup lang="ts">
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorDragPayload, UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIPresentationSurface } from '@endge/core'
import type { CSSProperties } from 'vue'

import { Endge, UI_COMPONENT_HOST_DEFINITION_ID } from '@endge/core'
import { Blocks } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { Card } from '@/components/ui/card'
import { getUIEditorDefaultLayout, isUIEditorContainer, UI_EDITOR_DND_MIME } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import { hasUIEditorSFCBinding, hasUIEditorSFCTextBinding } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import UIEditorDemoSelectionChrome from '@/features/endge-admin-ui-editor/ui/UIEditorDemoSelectionChrome.vue'

defineOptions({
  name: 'UIEditorDemoNode',
})

const props = defineProps<{
  state: UIEditorDemoState
  nodeId: string
  parentId?: string
  depth?: number
  preview?: boolean
}>()
type UIEditorChromeHandle = 'north' | 'east' | 'south' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west'
interface UIEditorPagePlacementPreview {
  nodeId?: string
  label: string
  colStart: number
  rowStart: number
  span: number
  rowSpan: number
}
interface UIEditorPageGridGeometry {
  rect: DOMRect
  columns: number
  gap: number
  rowHeight: number
  rowStep: number
  columnWidth: number
  columnStep: number
}
interface UIEditorPageLayoutRect {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

const isDropHovered = ref(false)
const inlineEditorRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

const node = computed<UIEditorNode | null>(() => props.state.getNode(props.nodeId))
const parentNode = computed<UIEditorNode | null>(() => props.parentId ? props.state.getNode(props.parentId) : null)
const isContainer = computed<boolean>(() => node.value != null && isUIEditorContainer(node.value.kind))
const isSelected = computed<boolean>(() => !props.preview && props.state.selectedNodeId === props.nodeId)
const isGridPlacedNode = computed<boolean>(() => parentNode.value?.kind === 'grid'
  || (parentNode.value?.kind === 'page' && parentNode.value.props.layoutMode === 'grid'))
const isPageGrid = computed<boolean>(() => node.value?.kind === 'page' && node.value.props.layoutMode === 'grid')
const isGridLayoutContainer = computed<boolean>(() => node.value?.kind === 'grid' || isPageGrid.value)
const pageColumnCount = computed<number>(() => node.value?.kind === 'page'
  ? Math.max(1, Math.min(12, Math.round(Number(node.value.props.columns) || 12)))
  : 12)
const children = computed(() => props.state.getChildren(props.nodeId))
const definition = computed(() => node.value ? Endge.uiRegistry.getDefinition(node.value.definitionRef) : null)
const isSourceBoundText = computed<boolean>(() => node.value?.kind === 'text' && hasUIEditorSFCTextBinding(node.value))
const isInlineEditable = computed<boolean>(() => node.value?.kind === 'button' || (node.value?.kind === 'text' && !isSourceBoundText.value))
const isInlineEditing = computed<boolean>(() => isInlineEditable.value && props.state.editingNodeId === props.nodeId)
const nodeTypeLabel = computed<string>(() => node.value ? getNodeTypeLabel(node.value) : '')
const selectionLabel = computed<string>(() => node.value ? getSelectionLabel(node.value) : '')
const renderSurface = computed<UIPresentationSurface>(() => props.preview ? 'runtime' : 'admin')
const nodeRenderer = computed(() => {
  if (!node.value || node.value.kind === 'page') {
    return null
  }

  return Endge.uiRegistry.resolveRenderer({
    definitionRef: node.value.definitionRef,
    surface: renderSurface.value,
    role: 'main',
    rendererRef: node.value.kind === 'custom-component'
      ? String(node.value.props.rendererRef ?? '')
      : null,
  })
})
const nodeRendererComponent = computed(() => nodeRenderer.value?.component ?? null)
const insertHoverIndex = ref<number | null>(null)
const pageGridRef = ref<HTMLElement | null>(null)
const pageChildRefs = ref<Record<string, HTMLElement | null>>({})
const pagePlacementPreview = ref<UIEditorPagePlacementPreview | null>(null)
const pageResizePreview = ref<UIEditorPagePlacementPreview | null>(null)
const cardStyle = computed<CSSProperties | undefined>(() => {
  if (!node.value || node.value.kind === 'page') {
    return node.value?.kind === 'page'
      ? {
          width: '100%',
        }
      : undefined
  }

  return {
    height: '100%',
  }
})

const pageGridMetrics = computed(() => {
  if (node.value?.kind !== 'page') {
    return null
  }

  return {
    gap: Math.max(0, Number(node.value.props.gap ?? 0)),
    rowHeight: Math.max(20, Number(node.value.props.rowHeight ?? 28)),
  }
})

const isPageGridVisible = computed(() =>
  !props.preview
  && node.value?.kind === 'page'
  && (props.state.showGridOverlay || (isPageGrid.value && props.state.isGridInteractionActive)),
)

const isPageDragSurfaceActive = computed(() =>
  !props.preview
  && isPageGrid.value
  && props.state.gridInteractionMode === 'drag',
)

const activePagePreview = computed<UIEditorPagePlacementPreview | null>(() =>
  pageResizePreview.value ?? pagePlacementPreview.value,
)

const pageGridRowCount = computed(() => {
  if (node.value?.kind !== 'page') {
    return 0
  }

  return Math.max(10, children.value.reduce((maxRows, child) => {
    const rowStart = Math.max(1, Number(child.layout?.rowStart ?? 1))
    const rowSpan = Math.max(1, Math.min(40, Number(child.layout?.rowSpan ?? 4)))
    return Math.max(maxRows, rowStart + rowSpan + 2)
  }, 10), activePagePreview.value ? activePagePreview.value.rowStart + activePagePreview.value.rowSpan + 2 : 10)
})

const containerStyle = computed<CSSProperties | undefined>(() => {
  const value = node.value
  if (!value || !isContainer.value) {
    return undefined
  }
  if (value.kind === 'grid') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, value.props.columns)}, minmax(0, 1fr))`,
      gap: `${value.props.gap}px`,
      minHeight: `${value.props.minHeight}px`,
      padding: `${value.props.padding}px`,
      alignContent: 'start',
    }
  }
  if (value.kind === 'flex') {
    return {
      display: 'flex',
      flexDirection: value.props.direction,
      gap: `${value.props.gap}px`,
      padding: `${value.props.padding}px`,
      alignItems: value.props.align ?? undefined,
      justifyContent: value.props.justify ?? undefined,
      flexWrap: value.props.wrap ? 'wrap' : undefined,
      minWidth: 0,
      width: '100%',
    }
  }
  if (value.kind === 'page') {
    if (value.props.layoutMode !== 'grid') {
      return {
        display: 'flex',
        flexDirection: value.props.direction,
        gap: `${Math.max(0, Number(value.props.gap ?? 0))}px`,
        alignItems: value.props.align ?? undefined,
        justifyContent: value.props.justify ?? undefined,
        flexWrap: value.props.wrap ? 'wrap' : undefined,
        minWidth: 0,
        minHeight: '100%',
        width: '100%',
      }
    }
    const rowHeight = Math.max(20, value.props.rowHeight)
    const gap = Math.max(0, Number(value.props.gap ?? 0))
    const trackCount = Math.max(10, pageGridRowCount.value)
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${pageColumnCount.value}, minmax(0, 1fr))`,
      gridAutoRows: `${rowHeight}px`,
      gridAutoFlow: 'row',
      gap: `${gap}px`,
      alignItems: 'start',
      minHeight: `${trackCount * rowHeight + Math.max(0, trackCount - 1) * gap}px`,
    }
  }
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: `${value.props.padding}px`,
  }
})

const bodyStyle = computed<Record<string, string> | undefined>(() => {
  if (node.value?.kind !== 'page') {
    return undefined
  }

  return {
    padding: `${node.value.props.padding}px`,
    width: '100%',
  }
})

const pageGridGuideStyle = computed<Record<string, string> | undefined>(() => {
  if (node.value?.kind !== 'page' || !pageGridMetrics.value) {
    return undefined
  }

  return {
    'display': 'grid',
    'gridTemplateColumns': `repeat(${pageColumnCount.value}, minmax(0, 1fr))`,
    'columnGap': `${pageGridMetrics.value.gap}px`,
    '--ui-editor-grid-row-step': `${pageGridMetrics.value.rowHeight + pageGridMetrics.value.gap}px`,
    'height': '100%',
    'overflow': 'hidden',
  }
})

const pagePlacementPreviewStyle = computed<Record<string, string> | undefined>(() => {
  if (!activePagePreview.value) {
    return undefined
  }

  return {
    gridColumn: `${activePagePreview.value.colStart} / span ${activePagePreview.value.span}`,
    gridRow: `${activePagePreview.value.rowStart} / span ${activePagePreview.value.rowSpan}`,
    height: `${getSnappedSizeForRowSpan(activePagePreview.value.rowSpan)}px`,
    minHeight: `${getSnappedSizeForRowSpan(activePagePreview.value.rowSpan)}px`,
  }
})

const textPreview = computed<string>(() => node.value?.kind === 'text' ? node.value.props.text : '')
const buttonLabel = computed<string>(() => node.value?.kind === 'button' ? node.value.props.label : '')
const customComponentTitle = computed<string>(() => node.value?.kind === 'custom-component' ? node.value.props.title : '')
const customComponentHeadline = computed<string>(() =>
  definition.value?.title
  || customComponentTitle.value
  || 'Component',
)
const customComponentMeta = computed<string>(() => {
  if (node.value?.kind !== 'custom-component') {
    return ''
  }

  const sourceLabel = String(node.value.meta?.sourceLabel ?? '').trim()
  if (sourceLabel) {
    return sourceLabel
  }
  const sourceType = String(node.value.meta?.sourceType ?? '').trim()
  if (sourceType === 'preset') {
    return 'Preset component'
  }
  if (sourceType === 'jsx') {
    return 'JSX component'
  }
  if (node.value.props.rendererRef) {
    return String(node.value.props.rendererRef)
  }
  return node.value.definitionRef
})
const customComponentBadge = computed<string>(() => {
  if (!definition.value) {
    return 'Component'
  }

  if (definition.value.id === UI_COMPONENT_HOST_DEFINITION_ID) {
    return 'Component Host'
  }

  return definition.value.configKind
    ? `Definition · ${definition.value.configKind}`
    : 'Definition'
})
const customComponentDescription = computed<string>(() =>
  definition.value?.stubDescription
  ?? 'Definition-placeholder для будущего renderer слоя.',
)
const nodeRendererProps = computed(() => {
  if (!node.value) {
    return {}
  }

  return {
    node: node.value,
    definition: definition.value,
    surface: renderSurface.value,
    preview: props.preview,
  }
})

watch(isInlineEditing, async (editing) => {
  if (!editing) {
    return
  }
  await nextTick()
  const editor = inlineEditorRef.value
  if (!editor) {
    return
  }
  editor.focus()
  const caret = editor.value.length
  editor.setSelectionRange(caret, caret)
}, { immediate: true })

function getNodeTypeLabel(targetNode: UIEditorNode): string {
  if (targetNode.kind === 'page') {
    return targetNode.props.layoutMode === 'grid'
      ? `Template · Grid ${targetNode.props.columns}`
      : 'Template · Flex Column'
  }

  if (targetNode.kind === 'flex') {
    return targetNode.props.direction === 'row' ? 'Flex · Row' : 'Flex · Column'
  }
  if (targetNode.kind === 'grid') {
    return `Grid · ${targetNode.props.columns} cols`
  }

  const contract = getUIEditorSFCDefinitionContract(targetNode.definitionRef)
  if (contract) {
    return contract.tag
  }
  if (targetNode.kind === 'text') {
    return 'Text'
  }
  if (targetNode.kind === 'button') {
    return 'Button'
  }
  if (targetNode.kind === 'custom-component') {
    const targetDefinition = Endge.uiRegistry.getDefinition(targetNode.definitionRef)
    return `Component · ${targetDefinition?.title ?? targetNode.name}`
  }
  return targetNode.name
}

function getSelectionLabel(targetNode: UIEditorNode): string {
  const typeLabel = getNodeTypeLabel(targetNode)
  if (hasUIEditorSFCBinding(targetNode)) {
    return `${typeLabel} · Bound`
  }
  return props.state.editingNodeId === targetNode.id
    ? `${typeLabel} · Editing`
    : typeLabel
}

function createTransparentDragImage(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas
}

function isNodeInGridInteraction(targetNodeId: string): boolean {
  return props.state.interactionNodeId === targetNodeId && props.state.isGridInteractionActive
}

function clearInteractionPreviews(): void {
  pagePlacementPreview.value = null
  pageResizePreview.value = null
}

function getPageGridGeometry(): UIEditorPageGridGeometry | null {
  if (!isPageGrid.value || !pageGridRef.value || !pageGridMetrics.value) {
    return null
  }

  const rect = pageGridRef.value.getBoundingClientRect()
  const gap = pageGridMetrics.value.gap
  const columns = pageColumnCount.value
  const columnWidth = (rect.width - gap * Math.max(0, columns - 1)) / columns

  return {
    rect,
    columns,
    gap,
    rowHeight: pageGridMetrics.value.rowHeight,
    rowStep: pageGridMetrics.value.rowHeight + gap,
    columnWidth,
    columnStep: columnWidth + gap,
  }
}

function getGridLeftForColumnStart(colStart: number, geometry: UIEditorPageGridGeometry): number {
  return (Math.max(1, colStart) - 1) * geometry.columnStep
}

function getGridTopForRowStart(rowStart: number, geometry: UIEditorPageGridGeometry): number {
  return (Math.max(1, rowStart) - 1) * geometry.rowStep
}

function getGridRightForColEnd(colEnd: number, geometry: UIEditorPageGridGeometry): number {
  const finalLine = geometry.columns + 1
  const safeColEnd = Math.max(2, Math.min(finalLine, colEnd))
  const startOffset = getGridLeftForColumnStart(Math.min(safeColEnd, geometry.columns), geometry)
  return safeColEnd === finalLine
    ? geometry.rect.width
    : Math.max(geometry.columnWidth, startOffset - geometry.gap)
}

function getGridBottomForRowEnd(rowEnd: number, geometry: UIEditorPageGridGeometry): number {
  const safeRowEnd = Math.max(2, rowEnd)
  const startOffset = getGridTopForRowStart(safeRowEnd, geometry)
  return Math.max(geometry.rowHeight, startOffset - geometry.gap)
}

function getGridWidthForSpan(span: number, geometry: UIEditorPageGridGeometry): number {
  const safeSpan = Math.max(1, Math.min(geometry.columns, span))
  return geometry.columnWidth * safeSpan + geometry.gap * Math.max(0, safeSpan - 1)
}

function getGridHeightForRowSpan(rowSpan: number, geometry: UIEditorPageGridGeometry): number {
  const safeRowSpan = Math.max(1, Math.min(40, rowSpan))
  return geometry.rowHeight * safeRowSpan + geometry.gap * Math.max(0, safeRowSpan - 1)
}

function createPageLayoutRect(
  layout: Pick<UIEditorPagePlacementPreview, 'colStart' | 'rowStart' | 'span' | 'rowSpan'>,
  geometry: UIEditorPageGridGeometry,
): UIEditorPageLayoutRect {
  const left = getGridLeftForColumnStart(layout.colStart, geometry)
  const top = getGridTopForRowStart(layout.rowStart, geometry)
  const width = getGridWidthForSpan(layout.span, geometry)
  const height = getGridHeightForRowSpan(layout.rowSpan, geometry)

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
}

function snapColStartFromLeft(leftOffset: number, span: number, geometry: UIEditorPageGridGeometry): number {
  const safeSpan = Math.max(1, Math.min(geometry.columns, span))
  const maxStart = Math.max(1, geometry.columns + 1 - safeSpan)
  const maxLeft = Math.max(0, geometry.rect.width - getGridWidthForSpan(safeSpan, geometry))
  const normalizedLeft = Math.max(0, Math.min(maxLeft, leftOffset))

  let bestStart = 1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let colStart = 1; colStart <= maxStart; colStart += 1) {
    const distance = Math.abs(normalizedLeft - getGridLeftForColumnStart(colStart, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestStart = colStart
    }
  }

  return bestStart
}

function snapRowStartFromTop(topOffset: number, geometry: UIEditorPageGridGeometry): number {
  const maxRow = Math.max(60, pageGridRowCount.value + 24)
  const normalizedTop = Math.max(0, topOffset)

  let bestStart = 1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let rowStart = 1; rowStart <= maxRow; rowStart += 1) {
    const distance = Math.abs(normalizedTop - getGridTopForRowStart(rowStart, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestStart = rowStart
    }
  }

  return bestStart
}

function snapColStartBeforeColEnd(leftOffset: number, fixedColEnd: number, geometry: UIEditorPageGridGeometry): number {
  const maxStart = Math.max(1, fixedColEnd - 1)
  const maxLeft = getGridLeftForColumnStart(maxStart, geometry)
  const normalizedLeft = Math.max(0, Math.min(maxLeft, leftOffset))

  let bestStart = 1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let colStart = 1; colStart <= maxStart; colStart += 1) {
    const distance = Math.abs(normalizedLeft - getGridLeftForColumnStart(colStart, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestStart = colStart
    }
  }

  return bestStart
}

function snapRowStartBeforeRowEnd(topOffset: number, fixedRowEnd: number, geometry: UIEditorPageGridGeometry): number {
  const maxStart = Math.max(1, fixedRowEnd - 1)
  const maxTop = getGridTopForRowStart(maxStart, geometry)
  const normalizedTop = Math.max(0, Math.min(maxTop, topOffset))

  let bestStart = 1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let rowStart = 1; rowStart <= maxStart; rowStart += 1) {
    const distance = Math.abs(normalizedTop - getGridTopForRowStart(rowStart, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestStart = rowStart
    }
  }

  return bestStart
}

function snapColEndFromRight(rightOffset: number, startCol: number, geometry: UIEditorPageGridGeometry): number {
  const minEnd = Math.max(startCol + 1, 2)
  const normalizedRight = Math.max(
    getGridRightForColEnd(minEnd, geometry),
    Math.min(geometry.rect.width, rightOffset),
  )

  let bestEnd = minEnd
  let bestDistance = Number.POSITIVE_INFINITY

  for (let colEnd = minEnd; colEnd <= geometry.columns + 1; colEnd += 1) {
    const distance = Math.abs(normalizedRight - getGridRightForColEnd(colEnd, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestEnd = colEnd
    }
  }

  return bestEnd
}

function snapRowEndFromBottom(bottomOffset: number, startRow: number, geometry: UIEditorPageGridGeometry): number {
  const minEnd = Math.max(startRow + 1, 2)
  const normalizedBottom = Math.max(
    getGridBottomForRowEnd(minEnd, geometry),
    bottomOffset,
  )

  let bestEnd = minEnd
  let bestDistance = Number.POSITIVE_INFINITY

  for (let rowEnd = minEnd; rowEnd <= Math.max(60, pageGridRowCount.value + 24); rowEnd += 1) {
    const distance = Math.abs(normalizedBottom - getGridBottomForRowEnd(rowEnd, geometry))
    if (distance < bestDistance) {
      bestDistance = distance
      bestEnd = rowEnd
    }
  }

  return bestEnd
}

function onSelect(): void {
  if (props.preview) {
    return
  }
  props.state.selectNode(props.nodeId)
}

function onDoubleClick(event: MouseEvent): void {
  if (props.preview || !isInlineEditable.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  props.state.beginInlineEdit(props.nodeId)
}

function onInlineEditInput(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    props.state.updateInlineEditDraft(target.value)
  }
}

function onInlineEditBlur(): void {
  if (props.state.editingNodeId === props.nodeId) {
    props.state.commitInlineEdit()
  }
}

function onInlineEditKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    props.state.cancelInlineEdit()
    return
  }

  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    event.stopPropagation()
    props.state.commitInlineEdit()
  }
}

function onDragstart(event: DragEvent): void {
  if (props.preview || !node.value || node.value.kind === 'page' || isGridPlacedNode.value) {
    return
  }

  const payload: UIEditorDragPayload = {
    source: 'node',
    nodeId: props.nodeId,
  }

  props.state.selectNode(props.nodeId)
  props.state.beginGridDrag(payload, props.nodeId)
  event.dataTransfer?.setData(UI_EDITOR_DND_MIME, JSON.stringify(payload))
  event.dataTransfer?.setData('text/plain', node.value.name)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setDragImage(createTransparentDragImage(), 0, 0)
  }
}

function onDragend(): void {
  props.state.endGridInteraction()
  clearInteractionPreviews()
}

function onDragover(event: DragEvent): void {
  if (props.preview || !isContainer.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  isDropHovered.value = true

  if (isPageGrid.value) {
    const payload = parseDropPayload(event)
    if (!payload) {
      return
    }

    props.state.beginGridDrag(payload, payload.nodeId)
    pageResizePreview.value = null
    pagePlacementPreview.value = resolvePagePlacement(event, payload)
  }
}

function onDragleave(): void {
  isDropHovered.value = false
  if (isPageGrid.value) {
    clearInteractionPreviews()
  }
}

function parseDropPayload(event: DragEvent): UIEditorDragPayload | null {
  if (props.state.dragPayload) {
    return props.state.dragPayload
  }

  const raw = event.dataTransfer?.getData(UI_EDITOR_DND_MIME)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as UIEditorDragPayload
  }
  catch (error) {
    console.warn('[UIEditorDemoNode] drop payload parse failed', error)
    return null
  }
}

function getPageLayoutForPayload(payload: UIEditorDragPayload): UIEditorPagePlacementPreview | null {
  if (payload.source === 'node' && payload.nodeId) {
    const draggedNode = props.state.getNode(payload.nodeId)
    if (!draggedNode || draggedNode.kind === 'page') {
      return null
    }

    return {
      nodeId: draggedNode.id,
      label: draggedNode.name,
      colStart: Math.max(1, Number(draggedNode.layout?.colStart ?? 1)),
      rowStart: Math.max(1, Number(draggedNode.layout?.rowStart ?? 1)),
      span: Math.max(1, Math.min(12, Number(draggedNode.layout?.span ?? 12))),
      rowSpan: Math.max(1, Math.min(40, Number(draggedNode.layout?.rowSpan ?? 4))),
    }
  }

  if (payload.source === 'palette' && (payload.definitionRef || payload.kind)) {
    const defaultLayout = getUIEditorDefaultLayout(payload.definitionRef ?? payload.kind ?? 'ui.box')
    const patchedLayout = {
      ...defaultLayout,
      ...(payload.layoutPatch ?? {}),
    }
    const span = Math.max(1, Math.min(12, Number(patchedLayout.span ?? defaultLayout.span)))
    const rowSpan = Math.max(1, Math.min(40, Number(patchedLayout.rowSpan ?? defaultLayout.rowSpan)))
    const maxColStart = Math.max(1, 13 - span)
    return {
      label: payload.label ?? payload.definitionRef ?? payload.kind ?? 'component',
      colStart: Math.max(1, Math.min(maxColStart, Number(patchedLayout.colStart ?? defaultLayout.colStart))),
      rowStart: Math.max(1, Number(patchedLayout.rowStart ?? defaultLayout.rowStart)),
      span,
      rowSpan,
    }
  }

  return null
}

function layoutsOverlap(
  first: Pick<UIEditorPagePlacementPreview, 'colStart' | 'rowStart' | 'span' | 'rowSpan'>,
  second: Pick<UIEditorPagePlacementPreview, 'colStart' | 'rowStart' | 'span' | 'rowSpan'>,
): boolean {
  const firstColEnd = first.colStart + first.span
  const secondColEnd = second.colStart + second.span
  const firstRowEnd = first.rowStart + first.rowSpan
  const secondRowEnd = second.rowStart + second.rowSpan

  return first.colStart < secondColEnd
    && firstColEnd > second.colStart
    && first.rowStart < secondRowEnd
    && firstRowEnd > second.rowStart
}

function resolvePageCollisions(
  preview: UIEditorPagePlacementPreview,
  ignoreNodeId?: string,
): UIEditorPagePlacementPreview {
  let candidateRowStart = Math.max(1, preview.rowStart)
  let hasCollision = true
  let safety = 0

  while (hasCollision && safety < 500) {
    hasCollision = false

    for (const sibling of children.value) {
      if (sibling.id === ignoreNodeId || sibling.kind === 'page') {
        continue
      }

      const siblingLayout = {
        colStart: Math.max(1, Number(sibling.layout?.colStart ?? 1)),
        rowStart: Math.max(1, Number(sibling.layout?.rowStart ?? 1)),
        span: Math.max(1, Math.min(12, Number(sibling.layout?.span ?? 12))),
        rowSpan: Math.max(1, Math.min(40, Number(sibling.layout?.rowSpan ?? 4))),
      }

      if (layoutsOverlap(
        {
          colStart: preview.colStart,
          rowStart: candidateRowStart,
          span: preview.span,
          rowSpan: preview.rowSpan,
        },
        siblingLayout,
      )) {
        candidateRowStart = siblingLayout.rowStart + siblingLayout.rowSpan
        hasCollision = true
        break
      }
    }

    safety += 1
  }

  return {
    ...preview,
    rowStart: candidateRowStart,
  }
}

function resolvePagePlacement(
  event: DragEvent,
  payload: UIEditorDragPayload,
): UIEditorPagePlacementPreview | null {
  if (!isPageGrid.value) {
    return null
  }

  const draggedLayout = getPageLayoutForPayload(payload)
  const geometry = getPageGridGeometry()
  if (!draggedLayout || !geometry) {
    return null
  }

  const dragElement = payload.source === 'node' && payload.nodeId
    ? pageChildRefs.value[payload.nodeId]
    : null
  const dragRect = dragElement?.getBoundingClientRect()
  const anchorOffsetX = dragRect ? event.clientX - dragRect.left : geometry.columnWidth / 2
  const anchorOffsetY = dragRect ? event.clientY - dragRect.top : geometry.rowHeight / 2
  const candidateLeft = event.clientX - geometry.rect.left - anchorOffsetX
  const candidateTop = event.clientY - geometry.rect.top - anchorOffsetY
  const span = Math.max(1, Math.min(geometry.columns, draggedLayout.span))

  return resolvePageCollisions({
    ...draggedLayout,
    span,
    colStart: snapColStartFromLeft(candidateLeft, span, geometry),
    rowStart: snapRowStartFromTop(candidateTop, geometry),
  }, payload.source === 'node' ? payload.nodeId : undefined)
}

function onDrop(event: DragEvent): void {
  if (props.preview || !isContainer.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  isDropHovered.value = false
  const payload = parseDropPayload(event)
  props.state.endGridInteraction()
  if (!payload) {
    clearInteractionPreviews()
    return
  }

  if (isPageGrid.value && pagePlacementPreview.value) {
    const previewLayout = pagePlacementPreview.value
    clearInteractionPreviews()

    if (payload.source === 'palette') {
      const addedNode = props.state.addPaletteItem(payload, props.nodeId)

      if (addedNode) {
        props.state.patchNodeLayout(addedNode.id, {
          colStart: previewLayout.colStart,
          rowStart: previewLayout.rowStart,
          span: previewLayout.span,
          rowSpan: previewLayout.rowSpan,
        })
      }
      return
    }

    if (payload.source === 'node' && payload.nodeId) {
      props.state.moveNode(payload.nodeId, props.nodeId)
      props.state.patchNodeLayout(payload.nodeId, {
        colStart: previewLayout.colStart,
        rowStart: previewLayout.rowStart,
        span: previewLayout.span,
        rowSpan: previewLayout.rowSpan,
      })
      props.state.selectNode(payload.nodeId)
      return
    }
  }

  if (payload.source === 'palette') {
    props.state.addPaletteItem(payload, props.nodeId)
  }
  if (payload.source === 'node' && payload.nodeId) {
    props.state.moveNode(payload.nodeId, props.nodeId)
  }
}

function onInsertDragover(index: number, event: DragEvent): void {
  if (props.preview || !isContainer.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  insertHoverIndex.value = index
}

function onInsertDragleave(index: number): void {
  if (insertHoverIndex.value === index) {
    insertHoverIndex.value = null
  }
}

function onInsertDrop(index: number, event: DragEvent): void {
  if (props.preview || !isContainer.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  insertHoverIndex.value = null
  const payload = parseDropPayload(event)
  props.state.endGridInteraction()
  clearInteractionPreviews()
  if (!payload) {
    return
  }

  if (payload.source === 'palette') {
    props.state.addPaletteItem(payload, props.nodeId, index)
    return
  }

  if (payload.source === 'node' && payload.nodeId) {
    props.state.moveNode(payload.nodeId, props.nodeId, index)
  }
}

function setPageChildRef(nodeId: string, element: Element | null): void {
  pageChildRefs.value[nodeId] = element instanceof HTMLElement ? element : null
}

function getSnappedSizeForRowSpan(rowSpan: number): number {
  if (!pageGridMetrics.value) {
    return 96
  }

  const safeRowSpan = Math.max(1, Math.min(40, Math.round(rowSpan)))
  return safeRowSpan * pageGridMetrics.value.rowHeight + Math.max(0, safeRowSpan - 1) * pageGridMetrics.value.gap
}

function createPagePreviewFromNode(child: UIEditorNode): UIEditorPagePlacementPreview {
  const columns = pageColumnCount.value
  const span = Math.max(1, Math.min(columns, Number(child.layout?.span ?? columns)))
  return {
    nodeId: child.id,
    label: getNodeTypeLabel(child),
    colStart: Math.max(1, Math.min(Math.max(1, columns + 1 - span), Number(child.layout?.colStart ?? 1))),
    rowStart: Math.max(1, Number(child.layout?.rowStart ?? 1)),
    span,
    rowSpan: Math.max(1, Math.min(40, Number(child.layout?.rowSpan ?? 4))),
  }
}

function startPageChildMove(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  const childPreview = createPagePreviewFromNode(child)
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.selectNode(child.id)
  props.state.beginGridDrag({
    source: 'node',
    nodeId: child.id,
  }, child.id)

  const previewRect = createPageLayoutRect(childPreview, geometry)
  const pointerOffsetX = event.clientX - (geometry.rect.left + previewRect.left)
  const pointerOffsetY = event.clientY - (geometry.rect.top + previewRect.top)
  pageResizePreview.value = null
  pagePlacementPreview.value = childPreview

  const onMouseMove = (moveEvent: MouseEvent) => {
    const nextPreview = createPagePreviewFromNode(child)
    const candidateLeft = moveEvent.clientX - geometry.rect.left - pointerOffsetX
    const candidateTop = moveEvent.clientY - geometry.rect.top - pointerOffsetY
    pagePlacementPreview.value = resolvePageCollisions({
      ...nextPreview,
      colStart: snapColStartFromLeft(candidateLeft, nextPreview.span, geometry),
      rowStart: snapRowStartFromTop(candidateTop, geometry),
    }, child.id)
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pagePlacementPreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pagePlacementPreview.value.colStart,
        rowStart: pagePlacementPreview.value.rowStart,
        span: pagePlacementPreview.value.span,
        rowSpan: pagePlacementPreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'move'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onPageChildPointerDown(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  if (
    event.button !== 0
    || event.detail > 1
    || props.state.editingNodeId === child.id
    || props.state.selectedNodeId !== child.id
    || isNodeInGridInteraction(child.id)
  ) {
    return
  }

  const target = event.target
  if (target instanceof HTMLElement && target.closest('[data-ui-editor-chrome="true"]')) {
    return
  }

  const childElement = pageChildRefs.value[child.id]
  if (!childElement) {
    startPageChildMove(child, event)
    return
  }

  const childRect = childElement.getBoundingClientRect()
  const edgeSize = 12

  if (childRect.width > 0 && event.clientX >= childRect.right - edgeSize) {
    startPageChildWidthResize(child, event)
    return
  }

  if (childRect.width > 0 && event.clientX <= childRect.left + edgeSize) {
    startPageChildLeftResize(child, event)
    return
  }

  if (childRect.height > 0 && event.clientY <= childRect.top + edgeSize) {
    startPageChildTopResize(child, event)
    return
  }

  if (childRect.height > 0 && event.clientY >= childRect.bottom - edgeSize) {
    startPageChildHeightResize(child, event)
    return
  }

  startPageChildMove(child, event)
}

function startPageChildWidthResize(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.beginGridResize(child.id)
  props.state.selectNode(child.id)
  pagePlacementPreview.value = null
  const startPreview = createPagePreviewFromNode(child)
  pageResizePreview.value = startPreview

  const startRect = createPageLayoutRect(startPreview, geometry)
  const startCol = Math.max(1, Math.min(12, startPreview.colStart))
  const pointerOffsetFromRight = event.clientX - (geometry.rect.left + startRect.right)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const candidateRight = moveEvent.clientX - geometry.rect.left - pointerOffsetFromRight
    if (!pageResizePreview.value) {
      return
    }

    const nextColEnd = snapColEndFromRight(candidateRight, startCol, geometry)

    pageResizePreview.value = {
      ...pageResizePreview.value,
      colStart: startPreview.colStart,
      span: nextColEnd - startCol,
    }
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pageResizePreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pageResizePreview.value.colStart,
        rowStart: pageResizePreview.value.rowStart,
        span: pageResizePreview.value.span,
        rowSpan: pageResizePreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function startPageChildHeightResize(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.beginGridResize(child.id)
  props.state.selectNode(child.id)
  pagePlacementPreview.value = null
  const startPreview = createPagePreviewFromNode(child)
  pageResizePreview.value = startPreview

  const startRect = createPageLayoutRect(startPreview, geometry)
  const pointerOffsetFromBottom = event.clientY - (geometry.rect.top + startRect.bottom)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const candidateBottom = moveEvent.clientY - geometry.rect.top - pointerOffsetFromBottom
    if (!pageResizePreview.value) {
      return
    }

    const nextRowEnd = snapRowEndFromBottom(candidateBottom, startPreview.rowStart, geometry)

    pageResizePreview.value = {
      ...pageResizePreview.value,
      rowStart: startPreview.rowStart,
      rowSpan: nextRowEnd - startPreview.rowStart,
    }
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pageResizePreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pageResizePreview.value.colStart,
        rowStart: pageResizePreview.value.rowStart,
        span: pageResizePreview.value.span,
        rowSpan: pageResizePreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function startPageChildTopResize(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.beginGridResize(child.id)
  props.state.selectNode(child.id)
  pagePlacementPreview.value = null
  const startPreview = createPagePreviewFromNode(child)
  pageResizePreview.value = startPreview

  const startRect = createPageLayoutRect(startPreview, geometry)
  const fixedRowEnd = startPreview.rowStart + startPreview.rowSpan
  const pointerOffsetFromTop = event.clientY - (geometry.rect.top + startRect.top)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const candidateTop = moveEvent.clientY - geometry.rect.top - pointerOffsetFromTop
    if (!pageResizePreview.value) {
      return
    }

    const targetRowStart = snapRowStartBeforeRowEnd(candidateTop, fixedRowEnd, geometry)
    const targetRowSpan = fixedRowEnd - targetRowStart

    pageResizePreview.value = {
      ...pageResizePreview.value,
      rowStart: targetRowStart,
      rowSpan: targetRowSpan,
    }
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pageResizePreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pageResizePreview.value.colStart,
        rowStart: pageResizePreview.value.rowStart,
        span: pageResizePreview.value.span,
        rowSpan: pageResizePreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function startPageChildLeftResize(child: UIEditorNode, event: MouseEvent): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.beginGridResize(child.id)
  props.state.selectNode(child.id)
  pagePlacementPreview.value = null
  const startPreview = createPagePreviewFromNode(child)
  pageResizePreview.value = startPreview

  const startRect = createPageLayoutRect(startPreview, geometry)
  const fixedColEnd = startPreview.colStart + startPreview.span
  const pointerOffsetFromLeft = event.clientX - (geometry.rect.left + startRect.left)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const candidateLeft = moveEvent.clientX - geometry.rect.left - pointerOffsetFromLeft
    if (!pageResizePreview.value) {
      return
    }

    const nextColStart = snapColStartBeforeColEnd(candidateLeft, fixedColEnd, geometry)
    const nextSpan = fixedColEnd - nextColStart

    pageResizePreview.value = {
      ...pageResizePreview.value,
      colStart: nextColStart,
      span: nextSpan,
    }
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pageResizePreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pageResizePreview.value.colStart,
        rowStart: pageResizePreview.value.rowStart,
        span: pageResizePreview.value.span,
        rowSpan: pageResizePreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function startPageChildCornerResize(
  child: UIEditorNode,
  event: MouseEvent,
  handle: Extract<UIEditorChromeHandle, 'north-west' | 'north-east' | 'south-west' | 'south-east'>,
): void {
  if (props.preview || !isPageGrid.value) {
    return
  }

  const geometry = getPageGridGeometry()
  if (!geometry) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.state.beginGridResize(child.id)
  props.state.selectNode(child.id)
  pagePlacementPreview.value = null
  const startPreview = createPagePreviewFromNode(child)
  pageResizePreview.value = startPreview

  const startRect = createPageLayoutRect(startPreview, geometry)
  const startCol = Math.max(1, Math.min(12, startPreview.colStart))
  const fixedColEnd = startPreview.colStart + startPreview.span
  const fixedRowEnd = startPreview.rowStart + startPreview.rowSpan
  const pointerOffsetFromLeft = event.clientX - (geometry.rect.left + startRect.left)
  const pointerOffsetFromRight = event.clientX - (geometry.rect.left + startRect.right)
  const pointerOffsetFromTop = event.clientY - (geometry.rect.top + startRect.top)
  const pointerOffsetFromBottom = event.clientY - (geometry.rect.top + startRect.bottom)

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!pageResizePreview.value) {
      return
    }

    let nextColStart = startPreview.colStart
    let nextSpan = startPreview.span
    let nextRowStart = startPreview.rowStart
    let nextRowSpan = startPreview.rowSpan

    if (handle === 'north-west' || handle === 'south-west') {
      const candidateLeft = moveEvent.clientX - geometry.rect.left - pointerOffsetFromLeft
      nextColStart = snapColStartBeforeColEnd(candidateLeft, fixedColEnd, geometry)
      nextSpan = fixedColEnd - nextColStart
    }
    else {
      const candidateRight = moveEvent.clientX - geometry.rect.left - pointerOffsetFromRight
      const nextColEnd = snapColEndFromRight(candidateRight, startCol, geometry)
      nextColStart = startPreview.colStart
      nextSpan = nextColEnd - startCol
    }

    if (handle === 'north-west' || handle === 'north-east') {
      const candidateTop = moveEvent.clientY - geometry.rect.top - pointerOffsetFromTop
      nextRowStart = snapRowStartBeforeRowEnd(candidateTop, fixedRowEnd, geometry)
      nextRowSpan = fixedRowEnd - nextRowStart
    }
    else {
      const candidateBottom = moveEvent.clientY - geometry.rect.top - pointerOffsetFromBottom
      const nextRowEnd = snapRowEndFromBottom(candidateBottom, startPreview.rowStart, geometry)
      nextRowStart = startPreview.rowStart
      nextRowSpan = nextRowEnd - startPreview.rowStart
    }

    pageResizePreview.value = {
      ...pageResizePreview.value,
      colStart: nextColStart,
      rowStart: nextRowStart,
      span: nextSpan,
      rowSpan: nextRowSpan,
    }
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (pageResizePreview.value) {
      props.state.patchNodeLayout(child.id, {
        colStart: pageResizePreview.value.colStart,
        rowStart: pageResizePreview.value.rowStart,
        span: pageResizePreview.value.span,
        rowSpan: pageResizePreview.value.rowSpan,
      })
    }
    clearInteractionPreviews()
    props.state.endGridInteraction()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = handle === 'north-east' || handle === 'south-west'
    ? 'nesw-resize'
    : 'nwse-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function getNodeSizeBadge(targetNode: UIEditorNode): string {
  if (targetNode.kind === 'page' || (!isGridPlacedNode.value && !isGridLayoutContainer.value)) {
    return ''
  }

  const span = Math.max(1, Math.min(12, Number(targetNode.layout?.span ?? 12)))
  const rowSpan = Math.max(1, Math.min(40, Number(targetNode.layout?.rowSpan ?? 4)))
  return `${span} x ${rowSpan}`
}

function onPageChildSelectionChromeResize(child: UIEditorNode, handle: UIEditorChromeHandle, event: MouseEvent): void {
  if (!isPageGrid.value) {
    return
  }

  if (handle === 'west') {
    startPageChildLeftResize(child, event)
    return
  }

  if (handle === 'north') {
    startPageChildTopResize(child, event)
    return
  }

  if (handle === 'north-west' || handle === 'north-east' || handle === 'south-west' || handle === 'south-east') {
    startPageChildCornerResize(child, event, handle)
    return
  }

  if (handle === 'east') {
    startPageChildWidthResize(child, event)
    return
  }

  if (handle === 'south') {
    startPageChildHeightResize(child, event)
  }
}

function getChildWrapperStyle(child: UIEditorNode): Record<string, string> | undefined {
  const container = node.value
  if (!container) {
    return undefined
  }

  if (container.kind === 'page' && container.props.layoutMode === 'flex') {
    return container.props.direction === 'row'
      ? { flex: '0 1 auto', minWidth: '0', width: 'auto' }
      : { width: '100%', minWidth: '0' }
  }

  if (container.kind === 'flex') {
    return container.props.direction === 'row'
      ? { flex: '0 1 auto', minWidth: '0', width: 'auto' }
      : { width: '100%', minWidth: '0' }
  }

  if (!isGridLayoutContainer.value) {
    return undefined
  }

  const columns = container.kind === 'grid'
    ? Math.max(1, Number(container.props.columns) || 12)
    : pageColumnCount.value
  const colStart = Math.max(1, Math.min(columns, Number(child.layout?.colStart ?? 1)))
  const rowStart = Math.max(1, Number(child.layout?.rowStart ?? 1))
  const span = Math.max(1, Math.min(columns, Number(child.layout?.span ?? columns)))
  const rowSpan = Math.max(1, Math.min(40, Number(child.layout?.rowSpan ?? 4)))
  const style: Record<string, string> = {
    gridColumn: `${colStart} / span ${span}`,
    gridRow: `${rowStart} / span ${rowSpan}`,
  }
  if (container.kind === 'page') {
    style.height = `${getSnappedSizeForRowSpan(rowSpan)}px`
    style.minHeight = `${getSnappedSizeForRowSpan(rowSpan)}px`
    style.visibility = isNodeInGridInteraction(child.id) ? 'hidden' : 'visible'
  }
  return style
}

function getInsertStyle(): Record<string, string> | undefined {
  if (!isGridLayoutContainer.value) {
    return undefined
  }
  return {
    gridColumn: '1 / -1',
  }
}
</script>

<template>
  <div
    v-if="node"
    class="group/ui-editor-node relative"
    :class="node.kind === 'page' ? 'w-full' : ''"
  >
    <div
      v-if="!props.preview && !isSelected"
      class="pointer-events-none absolute -top-5 left-0 z-20 inline-flex items-center rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white opacity-0 shadow-sm transition-opacity group-hover/ui-editor-node:opacity-100 dark:bg-slate-100 dark:text-slate-950"
    >
      {{ nodeTypeLabel }}
    </div>

    <Card
      class="ui-editor-node gap-0 overflow-visible rounded-none py-0 shadow-none transition"
      :class="[
        props.preview
          ? node.kind === 'page'
            ? 'min-h-full w-full border-0 bg-white shadow-none dark:bg-slate-950'
            : node.kind === 'box'
              ? 'h-full border border-slate-200/80 bg-white/95 shadow-none dark:border-slate-700/80 dark:bg-slate-900/95'
              : 'h-full border-0 bg-transparent shadow-none'
          : node.kind === 'page'
            ? 'min-h-full w-full border border-white/60 bg-white/90 shadow-none dark:border-slate-700/60 dark:bg-slate-950/90'
            : 'h-full border border-transparent bg-transparent shadow-none',
        !props.preview && isContainer && isDropHovered ? 'border-sky-400 bg-sky-50/40 dark:border-sky-400 dark:bg-sky-950/35' : '',
        !props.preview && !isSelected ? 'hover:border-slate-400/60 dark:hover:border-slate-500/60' : '',
      ]"
      :style="cardStyle"
      :draggable="!props.preview && !isInlineEditing && node.kind !== 'page' && !isGridPlacedNode"
      @click.stop="onSelect"
      @dblclick.stop="onDoubleClick"
      @dragstart="onDragstart"
      @dragend="onDragend"
    >
      <UIEditorDemoSelectionChrome
        v-if="!props.preview && isSelected && (!isGridPlacedNode || node.kind === 'page')"
        :label="selectionLabel"
        :size-label="getNodeSizeBadge(node)"
        :show-delete="node.kind !== 'page' && !isInlineEditing"
        :show-handles="false"
        :label-placement="node.kind === 'page' ? 'inside' : 'outside'"
        :highlight-surface="node.kind === 'page'"
        :editing="isInlineEditing"
        :interactive-handles="[]"
        @delete="props.state.removeNode(node.id)"
      />

      <div
        v-if="isContainer"
        class="space-y-1.5"
        :class="props.preview || node.kind === 'page' ? 'p-0' : 'p-1.5'"
        :style="bodyStyle"
        @dragover="onDragover"
        @dragleave="onDragleave"
        @drop="onDrop"
      >
        <component
          :is="node.kind === 'page' ? 'div' : (nodeRendererComponent || 'div')"
          v-bind="node.kind === 'page' ? {} : nodeRendererProps"
        >
          <div
            ref="pageGridRef"
            class="relative grid w-full gap-1.5"
            :style="containerStyle"
          >
            <div
              v-if="isPageGridVisible"
              class="ui-editor-layout-guides pointer-events-none absolute inset-0 z-0"
              :class="props.state.isGridInteractionActive ? 'ui-editor-layout-guides--active' : ''"
              :style="pageGridGuideStyle"
              aria-hidden="true"
            >
              <span
                v-for="columnIndex in pageColumnCount"
                :key="columnIndex"
                class="ui-editor-layout-guide-column"
              />
            </div>

            <div
              v-if="isPageDragSurfaceActive"
              class="absolute inset-0 z-20"
              @dragover="isPageDragSurfaceActive ? onDragover($event) : undefined"
              @dragleave="isPageDragSurfaceActive ? onDragleave() : undefined"
              @drop="isPageDragSurfaceActive ? onDrop($event) : undefined"
            />

            <div
              v-if="node.kind === 'page' && activePagePreview && pagePlacementPreviewStyle"
              class="pointer-events-none relative z-40 border border-sky-500/90"
              :style="pagePlacementPreviewStyle"
            >
              <div class="absolute left-1.5 top-1.5 inline-flex items-center rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm">
                {{ activePagePreview.label }}
              </div>
              <div class="absolute bottom-1.5 right-1.5 inline-flex items-center rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm">
                {{ activePagePreview.span }} x {{ activePagePreview.rowSpan }}
              </div>
            </div>

            <div
              v-if="!props.preview && node.kind !== 'page'"
              class="relative z-10 border border-dashed transition"
              :class="insertHoverIndex === 0 ? 'h-7 border-sky-500 bg-sky-100/80 dark:border-sky-400 dark:bg-sky-950/70' : 'h-[3px] border-transparent bg-transparent hover:border-sky-300/80 hover:bg-sky-50/80 dark:hover:border-sky-700/80 dark:hover:bg-sky-950/45'"
              :style="getInsertStyle()"
              @dragover="onInsertDragover(0, $event)"
              @dragleave="onInsertDragleave(0)"
              @drop="onInsertDrop(0, $event)"
            />

            <div
              v-if="children.length === 0 && !(node.kind === 'page' && activePagePreview)"
              class="relative z-10 border border-dashed border-border/80 px-3 py-5 text-center text-xs text-muted-foreground"
              :class="props.preview ? 'bg-slate-50/80 dark:bg-slate-900/75' : 'bg-background/70'"
              :style="getInsertStyle()"
            >
              {{ props.preview ? 'Пустой контейнер' : 'Контейнер пока пуст. Перетащи блок из палитры слева.' }}
            </div>

            <template v-for="(child, index) in children" :key="child.id">
              <div
                :ref="element => setPageChildRef(child.id, element as Element | null)"
                class="relative z-10 overflow-visible"
                :class="!props.preview && isPageGrid ? 'ui-editor-grid-item-surface' : ''"
                :style="getChildWrapperStyle(child)"
                @mousedown="onPageChildPointerDown(child, $event)"
              >
                <UIEditorDemoNode
                  :state="state"
                  :node-id="child.id"
                  :parent-id="node.id"
                  :depth="(depth ?? 0) + 1"
                  :preview="props.preview"
                />

                <UIEditorDemoSelectionChrome
                  v-if="!props.preview && isPageGrid && props.state.selectedNodeId === child.id && !isNodeInGridInteraction(child.id)"
                  :label="getSelectionLabel(child)"
                  :size-label="getNodeSizeBadge(child)"
                  :show-delete="props.state.editingNodeId !== child.id"
                  :show-handles="props.state.editingNodeId !== child.id"
                  label-placement="outside"
                  :editing="props.state.editingNodeId === child.id"
                  :interactive-handles="['north-west', 'north', 'north-east', 'west', 'east', 'south-west', 'south', 'south-east']"
                  :drag-handles="[]"
                  @delete="props.state.removeNode(child.id)"
                  @resize-handle="(handle, resizeEvent) => onPageChildSelectionChromeResize(child, handle, resizeEvent)"
                />
              </div>

              <div
                v-if="!props.preview && node.kind !== 'page'"
                class="relative z-10 border border-dashed transition"
                :class="insertHoverIndex === index + 1 ? 'h-7 border-sky-500 bg-sky-100/80 dark:border-sky-400 dark:bg-sky-950/70' : 'h-[3px] border-transparent bg-transparent hover:border-sky-300/80 hover:bg-sky-50/80 dark:hover:border-sky-700/80 dark:hover:bg-sky-950/45'"
                :style="getInsertStyle()"
                @dragover="onInsertDragover(index + 1, $event)"
                @dragleave="onInsertDragleave(index + 1)"
                @drop="onInsertDrop(index + 1, $event)"
              />
            </template>
          </div>
        </component>
      </div>

      <div
        v-else
        class="relative h-full min-h-8"
      >
        <textarea
          v-if="isInlineEditing && node.kind === 'text'"
          ref="inlineEditorRef"
          :value="props.state.inlineEditDraft"
          aria-label="Edit text"
          class="relative z-40 h-full min-h-8 w-full resize-none overflow-auto border-0 bg-transparent px-2 py-1.5 text-sm leading-5 text-foreground outline-none ring-2 ring-inset ring-indigo-500/70"
          @input="onInlineEditInput"
          @blur="onInlineEditBlur"
          @keydown="onInlineEditKeydown"
          @mousedown.stop
          @click.stop
          @dblclick.stop
        />

        <input
          v-else-if="isInlineEditing && node.kind === 'button'"
          ref="inlineEditorRef"
          :value="props.state.inlineEditDraft"
          aria-label="Edit button label"
          class="relative z-40 m-1 h-8 min-w-24 rounded-sm border border-indigo-400 bg-sky-600 px-3 text-xs font-semibold text-white outline-none ring-2 ring-indigo-500/60"
          @input="onInlineEditInput"
          @blur="onInlineEditBlur"
          @keydown="onInlineEditKeydown"
          @mousedown.stop
          @click.stop
          @dblclick.stop
        >

        <component
          :is="nodeRendererComponent"
          v-if="nodeRendererComponent && !isInlineEditing"
          v-bind="nodeRendererProps"
        />

        <div
          v-else-if="node.kind === 'text' && !isInlineEditing"
          class="flex min-h-8 w-full items-center whitespace-pre-wrap px-2 py-1.5 text-sm leading-5 text-foreground"
        >
          {{ textPreview || 'Empty text' }}
        </div>

        <div
          v-else-if="node.kind === 'custom-component'"
          class="border border-dashed border-border/70 bg-muted/10 px-3 py-2.5"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Blocks class="size-3" />
                <span>{{ customComponentBadge }}</span>
              </div>

              <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ customComponentHeadline }}
              </div>

              <div class="truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">
                {{ customComponentMeta || 'definitionRef is not set yet' }}
              </div>

              <div class="text-xs text-slate-600/90 dark:text-slate-400">
                {{ customComponentDescription }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex items-start justify-between gap-2"
        >
          <button
            v-if="node.kind === 'button' && !isInlineEditing"
            type="button"
            class="inline-flex items-center bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            {{ buttonLabel }}
          </button>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.ui-editor-layout-guides {
  --ui-editor-grid-line: rgb(100 116 139 / 0.11);

  background-image: repeating-linear-gradient(
    to bottom,
    var(--ui-editor-grid-line) 0,
    var(--ui-editor-grid-line) 1px,
    transparent 1px,
    transparent var(--ui-editor-grid-row-step)
  );
  opacity: 0.82;
  transition: opacity 120ms ease, background-image 120ms ease;
}

.ui-editor-layout-guides--active {
  --ui-editor-grid-line: rgb(14 165 233 / 0.24);

  opacity: 1;
}

.ui-editor-layout-guide-column {
  min-width: 0;
  border-left: 1px solid var(--ui-editor-grid-line);
}

.ui-editor-layout-guide-column:last-child {
  border-right: 1px solid var(--ui-editor-grid-line);
}

.ui-editor-grid-item-surface {
  background-color: rgb(255 255 255);
}

:global(.dark) .ui-editor-layout-guides {
  --ui-editor-grid-line: rgb(148 163 184 / 0.10);
}

:global(.dark) .ui-editor-layout-guides--active {
  --ui-editor-grid-line: rgb(56 189 248 / 0.24);
}

:global(.dark) .ui-editor-grid-item-surface {
  background-color: rgb(2 6 23);
}
</style>

<style scoped>
.ui-editor-node {
  transition-duration: 140ms;
}
</style>
