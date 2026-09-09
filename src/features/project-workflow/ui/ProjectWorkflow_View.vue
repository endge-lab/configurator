<script setup lang="ts">
import type { VueFlowStore } from '@vue-flow/core'
import type { ProjectWorkflow, WorkflowNodeData, WorkflowViewport } from '../domain/ProjectWorkflow'

import { Background, BackgroundVariant } from '@vue-flow/background'
import { MarkerType, SelectionMode, VueFlow } from '@vue-flow/core'
import { LayoutGrid, Maximize, Minus, Plus, SquareDashedMousePointer, Workflow } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import WorkflowEdge from './WorkflowEdge.vue'
import WorkflowNode from './WorkflowNode.vue'

const props = defineProps<{ workflow: ProjectWorkflow }>()
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
  toggleResources: [id: string]
  viewportChange: [viewport: WorkflowViewport]
}>()
const { t } = useI18n()
const flow = shallowRef<VueFlowStore>()
let initialFitPending = props.workflow.viewport === null
let nodesMeasured = false
let currentGestureDragged = false
let previousGestureDragged = false
const selectionMode = shallowRef(false)
const selectedNodes = computed(() => flow.value?.getSelectedNodes.value ?? [])
const selectedResources = shallowRef(new Set<string>())
const selectedIds = computed(() => new Set([...selectedNodes.value.map(node => node.id), ...selectedResources.value]))
watch([() => props.workflow, selectedIds], ([workflow, ids], previous) => {
  if (previous?.[0] && previous[0] !== workflow) {
    previous[0].setSelection(new Set())
  }
  workflow.setSelection(ids)
}, { immediate: true })
onBeforeUnmount(() => props.workflow.setSelection(new Set()))
const focus = computed(() => props.workflow.focus)
const scene = computed(() => props.workflow.scene)
const snapGrid: [number, number] = [16, 16]
// При обновлении проекции сохраняем ту же привязку, что Vue Flow применяет при первом показе.
const nodes = computed(() => scene.value.nodes.map(node => ({
  ...node,
  type: 'workflow',
  position: {
    x: Math.round(node.position.x / snapGrid[0]) * snapGrid[0],
    y: Math.round(node.position.y / snapGrid[1]) * snapGrid[1],
  },
})))
const edges = computed(() => scene.value.edges
  .map(edge => ({
    ...edge,
    type: 'workflow',
    data: { resource: edge.resource },
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.resource ? 'top' : 'left',
    label: selectedIds.value.has(edge.logicalSource) || selectedIds.value.has(edge.logicalTarget)
      ? (edge.resource ? t('projectWorkflow.connectedResource') : t('projectWorkflow.includes'))
      : undefined,
    markerEnd: MarkerType.ArrowClosed,
    class: selectedIds.value.size && focus.value.has(edge.logicalSource) && focus.value.has(edge.logicalTarget)
      ? 'text-primary'
      : 'text-muted-foreground',
    style: {
      stroke: 'currentColor',
      strokeWidth: 2.2,
      opacity: selectedIds.value.size
        ? (focus.value.has(edge.logicalSource) && focus.value.has(edge.logicalTarget) ? 0.85 : 0.12)
        : 0.85,
      strokeDasharray: edge.resource ? '5 4' : undefined,
    },
  })))

function nodeOpacity(data: WorkflowNodeData): number {
  if (!selectedIds.value.size) {
    return 1
  }
  return Math.max(focus.value.get(data.id) ?? 0.22, ...(data.resourceRows?.flatMap(row => row.items.map(item => focus.value.get(item.id) ?? 0.22)) ?? []))
}

function selectResource(id: string, additive: boolean): void {
  if (!additive && flow.value) {
    flow.value.removeSelectedNodes(flow.value.getSelectedNodes.value)
  }
  const next = additive ? new Set(selectedResources.value) : new Set<string>()
  if (next.has(id)) {
    next.delete(id)
  }
  else {
    next.add(id)
  }
  selectedResources.value = next
}

function clearResourceSelection(): void {
  selectedResources.value = new Set()
}

function selectNode(event: MouseEvent | TouchEvent): void {
  if (!event.metaKey && !event.ctrlKey) {
    clearResourceSelection()
  }
}

function beginPointerGesture(): void {
  previousGestureDragged = currentGestureDragged
  currentGestureDragged = false
}

function markNodeDrag(): void {
  currentGestureDragged = true
}

function suppressDragDoubleClick(event: MouseEvent): void {
  // Drag не может быть ни первым, ни вторым нажатием двойного клика.
  if (currentGestureDragged || previousGestureDragged) {
    event.preventDefault()
    event.stopPropagation()
  }
}

async function toggleResources(id: string): Promise<void> {
  emit('toggleResources', id)
  await nextTick()
  flow.value?.updateNodeInternals([id])
}

async function fit(): Promise<void> {
  await nextTick()
  await flow.value?.fitView({ padding: 0.2, maxZoom: 1, duration: 200 })
}

async function focusRoot(): Promise<void> {
  await nextTick()
  const root = nodes.value[0]
  if (root) {
    const resources = scene.value.edges.filter(edge => edge.resource && edge.target === root.id).map(edge => edge.source)
    await flow.value?.fitView({ nodes: [root.id, ...resources], padding: 0.15, maxZoom: 0.7, duration: 200 })
  }
}

function initialize(instance: VueFlowStore): void {
  flow.value = instance
  fitInitially()
}

function nodesInitialized(): void {
  nodesMeasured = true
  fitInitially()
}

function fitInitially(): void {
  if (initialFitPending && nodesMeasured && flow.value) {
    initialFitPending = false
    void focusRoot()
  }
}

async function arrange(): Promise<void> {
  props.workflow.resetLayout()
  await fit()
}

function openDocument(data: WorkflowNodeData): void {
  if (data.documentType && data.status !== 'missing') {
    emit('openDocument', data)
  }
}
</script>

<template>
  <section
    class="project-workflow"
    :aria-label="t('projectWorkflow.title')"
    @pointerdown.capture="beginPointerGesture"
    @dblclick.capture="suppressDragDoubleClick"
  >
    <div v-if="!nodes.length" class="workflow-empty">
      <Workflow class="mb-4 size-8 text-violet-400" />
      <h3 class="text-sm font-medium">
        {{ t('projectWorkflow.emptyTitle') }}
      </h3>
      <p class="mt-2 max-w-sm text-center text-xs leading-5 text-muted-foreground">
        {{ t('projectWorkflow.emptyDescription') }}
      </p>
    </div>
    <VueFlow
      v-else
      class="workflow-canvas"
      :nodes="nodes"
      :edges="edges"
      :default-viewport="workflow.viewport ?? undefined"
      :min-zoom="0.02"
      :max-zoom="1.8"
      :nodes-connectable="false"
      :nodes-draggable="workflow.layoutEditable"
      :edges-updatable="false"
      :connect-on-click="false"
      :delete-key-code="null"
      :zoom-on-double-click="false"
      :selection-key-code="selectionMode ? true : 'Shift'"
      :selection-mode="SelectionMode.Full"
      :pan-on-drag="selectionMode ? [1, 2] : true"
      :snap-to-grid="true"
      :snap-grid="snapGrid"
      @init="initialize"
      @nodes-initialized="nodesInitialized"
      @node-drag-start="markNodeDrag"
      @node-drag-stop="workflow.moveNodes($event.nodes)"
      @viewport-change-end="emit('viewportChange', $event)"
      @node-double-click="openDocument($event.node.data)"
      @node-click="selectNode($event.event)"
      @pane-click="clearResourceSelection"
    >
      <Background :variant="BackgroundVariant.Lines" :gap="32" :line-width="0.5" color="color-mix(in srgb, var(--border) 25%, transparent)" />
      <p v-if="!workflow.layoutEditable" role="status" class="workflow-layout-notice">
        {{ t('projectWorkflow.layoutUnavailable') }}
      </p>
      <template #node-workflow="nodeProps">
        <WorkflowNode
          :data="nodeProps.data"
          :selected="nodeProps.selected"
          :selected-ids="selectedIds"
          :focus="focus"
          :opacity="nodeOpacity(nodeProps.data)"
          @open-document="openDocument"
          @toggle-resources="toggleResources"
          @select-resource="selectResource"
        />
      </template>
      <template #edge-workflow="edgeProps">
        <WorkflowEdge v-bind="edgeProps" />
      </template>
      <div class="workflow-controls nodrag nopan">
        <Button
          :variant="selectionMode ? 'secondary' : 'ghost'"
          size="icon"
          :aria-label="t('projectWorkflow.select')"
          :aria-pressed="selectionMode"
          :title="t('projectWorkflow.selectHint')"
          @click="selectionMode = !selectionMode"
        >
          <SquareDashedMousePointer class="size-4" />
        </Button>
        <span class="my-1 h-px w-4 bg-border" />
        <Button variant="ghost" size="icon" :aria-label="t('projectWorkflow.zoomOut')" :title="t('projectWorkflow.zoomOut')" @click="flow?.zoomOut()">
          <Minus class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" :aria-label="t('projectWorkflow.zoomIn')" :title="t('projectWorkflow.zoomIn')" @click="flow?.zoomIn()">
          <Plus class="size-4" />
        </Button>
        <span class="my-1 h-px w-4 bg-border" />
        <Button variant="ghost" size="icon" :aria-label="t('projectWorkflow.fit')" :title="t('projectWorkflow.fit')" @click="fit">
          <Maximize class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" :disabled="!workflow.layoutEditable" :aria-label="t('projectWorkflow.arrange')" :title="t('projectWorkflow.arrange')" @click="arrange">
          <LayoutGrid class="size-4" />
        </Button>
      </div>
    </VueFlow>
  </section>
</template>

<style scoped>
.project-workflow { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--background); }
.workflow-canvas { flex: 1; min-height: 0; }
.workflow-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
.workflow-layout-notice { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 5; width: fit-content; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--muted-foreground); font-size: 12px; }
.workflow-controls { position: absolute; bottom: 20px; right: 20px; z-index: 5; display: flex; flex-direction: column; align-items: center; border: 1px solid var(--border); border-radius: 9px; padding: 3px; background: var(--card); box-shadow: 0 4px 20px #00000012; }
.workflow-canvas :deep(.vue-flow__selection),
.workflow-canvas :deep(.vue-flow__nodesselection-rect) { border: 1px dashed var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); border-radius: 4px; }
.workflow-canvas :deep(.vue-flow__edge-textbg) { fill: var(--card); }
.workflow-canvas :deep(.vue-flow__edge-text) { fill: var(--muted-foreground); font-size: 10px; }
</style>
