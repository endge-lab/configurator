<script setup lang="ts">
import type { SFCRenderInspectionNode, SFCRenderInspectionTreeNode } from '@endge/core'
import type { CSSProperties } from 'vue'
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorDragPayload, UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import { SFCRenderInspectionSession } from '@endge/core'
import { AlertTriangle, Code2, GripVertical, LoaderCircle, MousePointer2, Play, RefreshCw, Settings2, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { isUIEditorContainer, UI_EDITOR_DND_MIME } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import { UIEditorRuntimePreviewSession } from '@/features/endge-admin-ui-editor/entities/ui-editor-runtime-preview'
import { getUIEditorSFCSourceTag } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import UIEditorDemoRuntimeInspector from '@/features/endge-admin-ui-editor/ui/UIEditorDemoRuntimeInspector.vue'
import { Button } from '@/shared/ui/button'
import EndgeAdapterRoot from '@/shared/ui/endge/EndgeAdapterRoot'

interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

interface SelectableInspectionTarget {
  element: HTMLElement
  inspectionId: string
  nodeId: string
}

interface RuntimeDropTarget {
  element: HTMLElement | null
  parentId: string
  index: number
}

const props = defineProps<{
  state: UIEditorDemoState
}>()

const runtimeSession = new UIEditorRuntimePreviewSession({
  scopeId: 'ui-editor-demo-visual',
  rootPath: 'runtime-preview.ui-editor-demo.visual',
  origin: 'ui-editor-demo-visual',
  mode: 'editor',
})
const inspection = new SFCRenderInspectionSession()
const inspectionRevision = ref(0)
const unsubscribeInspection = inspection.subscribe(() => {
  inspectionRevision.value += 1
  void nextTick(syncSelectionFromState)
})
const refreshTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const editorMode = ref<'edit' | 'interact'>('edit')
const inspectorOpen = ref(false)
const hoveredElement = ref<HTMLElement | null>(null)
const selectedElement = ref<HTMLElement | null>(null)
const dropTarget = ref<RuntimeDropTarget | null>(null)
const hoverRect = ref<CanvasRect | null>(null)
const selectionRect = ref<CanvasRect | null>(null)
const dropRect = ref<CanvasRect | null>(null)
const selectedNode = computed<UIEditorNode | null>(() => props.state.getSelectedNode())
const selectedLabel = computed(() => {
  const node = selectedNode.value
  if (!node) {
    return 'Element'
  }
  return getUIEditorSFCSourceTag(node) ?? getUIEditorSFCDefinitionContract(node.definitionRef)?.tag ?? node.name
})
const statusLabel = computed(() => {
  if (runtimeSession.status.value === 'preparing') {
    return 'Building editor runtime'
  }
  if (runtimeSession.status.value === 'stale') {
    return 'Updating runtime'
  }
  if (runtimeSession.status.value === 'error') {
    return 'Runtime unavailable'
  }
  return editorMode.value === 'edit' ? 'Runtime canvas · Edit' : 'Runtime canvas · Interact'
})
const selectionStyle = computed<CSSProperties>(() => rectStyle(selectionRect.value))
const hoverStyle = computed<CSSProperties>(() => rectStyle(hoverRect.value))
const dropStyle = computed<CSSProperties>(() => rectStyle(dropRect.value))
const toolbarStyle = computed<CSSProperties>(() => {
  const rect = selectionRect.value
  const stage = stageRef.value
  if (!rect || !stage) {
    return {}
  }
  return {
    left: `${Math.max(4, Math.min(rect.left, stage.clientWidth - 254))}px`,
    top: `${Math.max(4, rect.top - 38)}px`,
  }
})

let resizeObserver: ResizeObserver | null = null

function rectStyle(rect: CanvasRect | null): CSSProperties {
  return rect
    ? { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }
    : {}
}

function scheduleRefresh(): void {
  runtimeSession.markStale()
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
  }
  refreshTimer.value = setTimeout(() => {
    refreshTimer.value = null
    void restart()
  }, 220)
}

async function restart(): Promise<void> {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
    refreshTimer.value = null
  }
  inspection.clear()
  clearRenderedTargets()
  await runtimeSession.launch(props.state.source)
  await nextTick()
  syncSelectionFromState()
}

function setEditorMode(mode: 'edit' | 'interact'): void {
  editorMode.value = mode
  if (mode === 'interact') {
    clearHover()
    inspectorOpen.value = false
  }
  else {
    syncSelectionFromState()
  }
}

function clearRenderedTargets(): void {
  hoveredElement.value = null
  selectedElement.value = null
  hoverRect.value = null
  selectionRect.value = null
  clearDropTarget()
  refreshObservedElements()
}

function sourceNodeIdForInspection(inspectionId: string): string | null {
  let node = inspection.getNode(inspectionId)
  while (node) {
    const range = node.sourceRange
    if (range) {
      const exact = Object.entries(props.state.sourceLocations).find(([, location]) =>
        location.range.start === range.start && location.range.end === range.end,
      )
      if (exact) {
        return exact[0]
      }
      const containing = Object.entries(props.state.sourceLocations)
        .filter(([, location]) => location.range.start <= range.start && location.range.end >= range.end)
        .sort(([, left], [, right]) =>
          (left.range.end - left.range.start) - (right.range.end - right.range.start),
        )[0]
      if (containing) {
        return containing[0]
      }
    }
    node = node.parentId ? inspection.getNode(node.parentId) : null
  }
  return null
}

function inspectionNodeForSourceNode(nodeId: string): SFCRenderInspectionNode | null {
  const location = props.state.getSourceLocation(nodeId)
  if (!location) {
    return null
  }
  const candidates: SFCRenderInspectionNode[] = []
  visitInspectionNodes(inspection.getTree(), (node) => {
    if (node.sourceRange?.start === location.range.start && node.sourceRange.end === location.range.end) {
      candidates.push(node)
    }
  })
  return candidates.find(candidate => findInspectionElement(candidate.id)) ?? candidates[0] ?? null
}

function visitInspectionNodes(roots: SFCRenderInspectionTreeNode[], visit: (node: SFCRenderInspectionTreeNode) => void): void {
  for (const node of roots) {
    visit(node)
    visitInspectionNodes(node.children, visit)
  }
}

function findInspectionElement(id: string): HTMLElement | null {
  return [...(stageRef.value?.querySelectorAll<HTMLElement>('[data-endge-inspect-id]') ?? [])]
    .find(element => element.dataset.endgeInspectId === id) ?? null
}

function findSelectableTarget(target: EventTarget | null): SelectableInspectionTarget | null {
  const stage = stageRef.value
  if (!(target instanceof Element) || !stage) {
    return null
  }
  let element = target.closest<HTMLElement>('[data-endge-inspect-id]')
  while (element && stage.contains(element)) {
    const inspectionId = element.dataset.endgeInspectId
    const nodeId = inspectionId ? sourceNodeIdForInspection(inspectionId) : null
    if (inspectionId && nodeId) {
      return { element, inspectionId, nodeId }
    }
    element = element.parentElement?.closest<HTMLElement>('[data-endge-inspect-id]') ?? null
  }
  return null
}

function selectTarget(target: SelectableInspectionTarget, openInspector = false): void {
  selectedElement.value = target.element
  props.state.selectNode(target.nodeId)
  if (openInspector) {
    inspectorOpen.value = true
  }
  updateOverlayRects()
  refreshObservedElements()
}

function syncSelectionFromState(): void {
  if (editorMode.value !== 'edit') {
    return
  }
  const nodeId = props.state.selectedNodeId
  if (!nodeId) {
    selectedElement.value = null
    selectionRect.value = null
    refreshObservedElements()
    return
  }
  const inspectionNode = inspectionNodeForSourceNode(nodeId)
  const element = inspectionNode ? findInspectionElement(inspectionNode.id) : null
  selectedElement.value = element
  updateOverlayRects()
  refreshObservedElements()
  if (props.state.selectionOrigin === 'source') {
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

function onPointerMove(event: PointerEvent): void {
  if (editorMode.value !== 'edit' || props.state.isGridInteractionActive) {
    return
  }
  const target = findSelectableTarget(event.target)
  hoveredElement.value = target?.element ?? null
  updateOverlayRects()
}

function clearHover(): void {
  hoveredElement.value = null
  hoverRect.value = null
}

function isEditorControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-ui-editor-control]') != null
}

function onPointerDownCapture(event: PointerEvent): void {
  if (editorMode.value !== 'edit' || isEditorControl(event.target)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const target = findSelectableTarget(event.target)
  if (target) {
    selectTarget(target)
    return
  }
  props.state.selectNode(props.state.document.rootId)
  syncSelectionFromState()
}

function suppressRuntimeClick(event: MouseEvent): void {
  if (editorMode.value !== 'edit' || isEditorControl(event.target)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

function onDoubleClickCapture(event: MouseEvent): void {
  if (editorMode.value !== 'edit' || isEditorControl(event.target)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const target = findSelectableTarget(event.target)
  if (target) {
    selectTarget(target, true)
  }
}

function onContextMenu(event: MouseEvent): void {
  if (editorMode.value !== 'edit' || isEditorControl(event.target)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const target = findSelectableTarget(event.target)
  if (target) {
    selectTarget(target)
    props.state.openContextMenu(target.nodeId, event.clientX, event.clientY)
  }
}

function openSourcePanel(): void {
  if (!props.state.isPanelVisible('source')) {
    props.state.togglePanel('source')
  }
}

function removeSelected(): void {
  const nodeId = props.state.selectedNodeId
  if (!nodeId || nodeId === props.state.document.rootId) {
    return
  }
  props.state.removeNode(nodeId)
  inspectorOpen.value = false
}

function beginSelectedDrag(event: DragEvent): void {
  const nodeId = props.state.selectedNodeId
  if (!nodeId || nodeId === props.state.document.rootId) {
    event.preventDefault()
    return
  }
  const payload: UIEditorDragPayload = { source: 'node', nodeId }
  props.state.beginGridDrag(payload, nodeId)
  event.dataTransfer?.setData(UI_EDITOR_DND_MIME, JSON.stringify(payload))
  event.dataTransfer?.setData('text/plain', selectedLabel.value)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function endSelectedDrag(): void {
  props.state.endGridInteraction()
  clearDropTarget()
}

function readDragPayload(event: DragEvent): UIEditorDragPayload | null {
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
  catch {
    return null
  }
}

function resolveDropTarget(event: DragEvent): RuntimeDropTarget {
  const selectable = findSelectableTarget(event.target)
  const targetNode = selectable ? props.state.getNode(selectable.nodeId) : null
  if (targetNode && isUIEditorContainer(targetNode.kind)) {
    return { element: selectable?.element ?? null, parentId: targetNode.id, index: targetNode.children.length }
  }
  if (targetNode) {
    const parent = props.state.getParentNode(targetNode.id)
    if (parent && isUIEditorContainer(parent.kind)) {
      const currentIndex = parent.children.indexOf(targetNode.id)
      const rect = selectable?.element.getBoundingClientRect()
      const horizontal = parent.kind === 'flex' && parent.props.direction === 'row'
      const after = rect
        ? horizontal
          ? event.clientX >= rect.left + rect.width / 2
          : event.clientY >= rect.top + rect.height / 2
        : false
      return {
        element: selectable?.element ?? null,
        parentId: parent.id,
        index: Math.max(0, currentIndex + (after ? 1 : 0)),
      }
    }
  }
  return {
    element: null,
    parentId: props.state.document.rootId,
    index: props.state.getChildren(props.state.document.rootId).length,
  }
}

function onDragOver(event: DragEvent): void {
  if (editorMode.value !== 'edit') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const target = resolveDropTarget(event)
  dropTarget.value = target
  dropRect.value = elementRect(target.element)
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = readDragPayload(event)?.source === 'palette' ? 'copy' : 'move'
  }
}

function onDrop(event: DragEvent): void {
  if (editorMode.value !== 'edit') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const payload = readDragPayload(event)
  const target = dropTarget.value ?? resolveDropTarget(event)
  try {
    if (payload?.source === 'palette') {
      props.state.addPaletteItem(payload, target.parentId, target.index)
    }
    else if (payload?.source === 'node' && payload.nodeId) {
      props.state.moveNode(payload.nodeId, target.parentId, target.index)
    }
  }
  finally {
    props.state.endGridInteraction()
    clearDropTarget()
  }
}

function clearDropTarget(): void {
  dropTarget.value = null
  dropRect.value = null
}

function elementRect(element: HTMLElement | null): CanvasRect | null {
  const stage = stageRef.value
  if (!stage || !element?.isConnected) {
    return null
  }
  const stageRect = stage.getBoundingClientRect()
  const targetRect = element.getBoundingClientRect()
  return {
    left: targetRect.left - stageRect.left,
    top: targetRect.top - stageRect.top,
    width: targetRect.width,
    height: targetRect.height,
  }
}

function updateOverlayRects(): void {
  hoverRect.value = hoveredElement.value === selectedElement.value ? null : elementRect(hoveredElement.value)
  selectionRect.value = elementRect(selectedElement.value)
  dropRect.value = elementRect(dropTarget.value?.element ?? null)
}

function refreshObservedElements(): void {
  resizeObserver?.disconnect()
  if (!resizeObserver) {
    return
  }
  for (const element of [stageRef.value, hoveredElement.value, selectedElement.value, dropTarget.value?.element]) {
    if (element) {
      resizeObserver.observe(element)
    }
  }
}

watch(() => props.state.source, scheduleRefresh)
watch(
  [() => props.state.selectedNodeId, () => props.state.selectionOrigin, () => inspectionRevision.value],
  () => void nextTick(syncSelectionFromState),
  { flush: 'post' },
)

onMounted(() => {
  resizeObserver = new ResizeObserver(updateOverlayRects)
  refreshObservedElements()
  window.addEventListener('resize', updateOverlayRects)
  void restart()
})

onBeforeUnmount(() => {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
  }
  unsubscribeInspection()
  inspection.clear()
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateOverlayRects)
  void runtimeSession.dispose()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-background">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/20 px-3">
      <span
        class="size-1.5 rounded-full"
        :class="{
          'bg-emerald-500': runtimeSession.status.value === 'active',
          'bg-amber-500': runtimeSession.status.value === 'stale',
          'bg-destructive': runtimeSession.status.value === 'error',
          'animate-pulse bg-sky-500': runtimeSession.status.value === 'preparing',
          'bg-muted-foreground/40': runtimeSession.status.value === 'idle',
        }"
      />
      <span class="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{{ statusLabel }}</span>

      <div class="ml-auto inline-flex items-center rounded-md border border-border/70 bg-background/80 p-0.5" data-ui-editor-control>
        <Button variant="ghost" size="sm" class="h-7 gap-1.5 rounded px-2 text-[11px]" :class="editorMode === 'edit' ? 'bg-sky-500 text-white hover:bg-sky-500/90 hover:text-white' : 'text-muted-foreground'" @click="setEditorMode('edit')">
          <MousePointer2 class="size-3" /> {{ $t('uiText.edit5301648d') }}
        </Button>
        <Button variant="ghost" size="sm" class="h-7 gap-1.5 rounded px-2 text-[11px]" :class="editorMode === 'interact' ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background' : 'text-muted-foreground'" @click="setEditorMode('interact')">
          <Play class="size-3" /> {{ $t('uiText.interact53deafc6') }}
        </Button>
      </div>

      <Button variant="ghost" size="icon" class="size-7" title="Restart runtime canvas" :disabled="runtimeSession.status.value === 'preparing'" data-ui-editor-control @click="restart">
        <RefreshCw class="size-3.5" />
      </Button>
    </header>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div
        class="h-full overflow-auto bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.045),_transparent_36%)]"
        @pointermove="onPointerMove"
        @pointerleave="clearHover"
        @pointerdown.capture="onPointerDownCapture"
        @click.capture="suppressRuntimeClick"
        @dblclick.capture="onDoubleClickCapture"
        @contextmenu.capture="onContextMenu"
        @dragover.capture="onDragOver"
        @dragleave.self="clearDropTarget"
        @drop.capture="onDrop"
      >
        <div v-if="runtimeSession.error.value" class="sticky top-0 z-40 m-3 mb-0 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur dark:bg-amber-950/90 dark:text-amber-100">
          <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
          <span>{{ runtimeSession.error.value }}</span>
        </div>

        <div v-if="runtimeSession.status.value === 'preparing' && !runtimeSession.runtime.value" class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle class="size-4 animate-spin" /> {{ $t('uiText.buildingEditorRuntime94b5e0b5') }}
        </div>

        <div v-if="runtimeSession.runtime.value" ref="stageRef" class="relative mx-auto min-h-full w-full p-3">
          <EndgeAdapterRoot root-key="sfc-runtime" :host="runtimeSession.runtime.value" :input="runtimeSession.input.value" :inspection="inspection" />

          <div v-if="editorMode === 'edit' && hoverRect" class="pointer-events-none absolute z-[55] rounded-[2px] border border-sky-400/80 bg-sky-400/5" :style="hoverStyle" />
          <div v-if="editorMode === 'edit' && selectionRect" class="pointer-events-none absolute z-[56] rounded-[2px] border-2 border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.13)]" :style="selectionStyle" />
          <div v-if="editorMode === 'edit' && dropRect" class="pointer-events-none absolute z-[57] rounded-[2px] border-2 border-dashed border-amber-400 bg-amber-400/10 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]" :style="dropStyle" />

          <div v-if="editorMode === 'edit' && selectionRect && selectedNode" class="absolute z-[60] flex h-8 max-w-[calc(100%_-_8px)] items-center gap-0.5 rounded-md border border-sky-500/35 bg-slate-950/94 p-0.5 text-white shadow-xl backdrop-blur" :style="toolbarStyle" data-ui-editor-control>
            <button v-if="selectedNode.id !== props.state.document.rootId" type="button" draggable="true" class="flex size-7 cursor-grab items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white active:cursor-grabbing" title="Перетащить элемент" @dragstart="beginSelectedDrag" @dragend="endSelectedDrag">
              <GripVertical class="size-3.5" />
            </button>
            <span class="max-w-28 truncate px-1.5 text-[10px] font-semibold tracking-wide text-sky-200">{{ selectedLabel }}</span>
            <button type="button" class="flex size-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white" title="Настройки" @click="inspectorOpen = !inspectorOpen">
              <Settings2 class="size-3.5" />
            </button>
            <button type="button" class="flex size-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white" title="Показать в Source" @click="openSourcePanel">
              <Code2 class="size-3.5" />
            </button>
            <button v-if="selectedNode.id !== props.state.document.rootId" type="button" class="flex size-7 items-center justify-center rounded text-rose-300 hover:bg-rose-500/20 hover:text-rose-200" title="Удалить" @click="removeSelected">
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="editorMode === 'edit' && inspectorOpen && selectedNode" class="absolute inset-y-3 right-3 z-[70] w-[320px] max-w-[calc(100%_-_24px)]" data-ui-editor-control>
        <UIEditorDemoRuntimeInspector :state="props.state" @close="inspectorOpen = false" />
      </div>
    </div>
  </section>
</template>
