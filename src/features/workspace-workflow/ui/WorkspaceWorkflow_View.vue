<script setup lang="ts">
import type { VueFlowStore } from '@vue-flow/core'
import type { WorkflowNodeData, WorkflowViewport, WorkspaceWorkflow } from '../domain/WorkspaceWorkflow'
import { Endge } from '@endge/core'

import { Background, BackgroundVariant } from '@vue-flow/background'
import { MarkerType, SelectionMode, VueFlow } from '@vue-flow/core'
import { LayoutGrid, Maximize, Minus, Plus, SquareDashedMousePointer, Workflow } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import WorkflowCompactResource from './WorkflowCompactResource.vue'
import WorkflowEdge from './WorkflowEdge.vue'
import WorkflowNode from './WorkflowNode.vue'
import WorkflowResourceToggle from './WorkflowResourceToggle.vue'

const props = defineProps<{ workflow: WorkspaceWorkflow, runtimeActiveIds?: ReadonlySet<string> }>()
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
  toggleResources: [id: string]
  viewportChange: [viewport: WorkflowViewport]
  arrange: []
}>()
const { t } = useI18n()
const flow = shallowRef<VueFlowStore>()
let initialFitPending = props.workflow.viewport === null
let nodesMeasured = false
let currentGestureDragged = false
let previousGestureDragged = false
const selectionMode = shallowRef(false)
const selectedNodes = computed(() => flow.value?.getSelectedNodes.value ?? [])
const observingRuntime = computed(() => props.runtimeActiveIds !== undefined)
const selectedIds = computed(() => props.runtimeActiveIds ?? new Set(selectedNodes.value.map(node => node.id)))
watch([() => props.workflow, selectedIds], ([workflow, ids], previous) => {
  if (previous?.[0] && previous[0] !== workflow) {
    previous[0].setSelection(new Set())
  }
  if (!observingRuntime.value) {
    workflow.setSelection(ids)
  }
}, { immediate: true })
onBeforeUnmount(() => {
  rememberViewport()
  props.workflow.setSelection(new Set())
})
const focus = computed(() => props.runtimeActiveIds ? new Map([...props.runtimeActiveIds].map(id => [id, 1])) : props.workflow.focus)
const scene = computed(() => props.workflow.scene)
const snapGrid: [number, number] = [16, 16]
// При обновлении проекции сохраняем ту же привязку, что Vue Flow применяет при первом показе.
const nodes = computed(() => scene.value.nodes.map(node => ({
  ...node,
  type: node.role ?? 'workflow',
  parentNode: node.parentId,
  expandParent: false,
  draggable: node.parentId ? false : undefined,
  selectable: !observingRuntime.value && node.role !== 'resource-toggle',
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
      ? (edge.filterView ? t('workspaceWorkflow.filterRepresentation') : edge.resource ? t('workspaceWorkflow.connectedResource') : t('workspaceWorkflow.includes'))
      : undefined,
    markerEnd: MarkerType.ArrowClosed,
    class: selectedIds.value.size && focus.value.has(edge.logicalSource) && focus.value.has(edge.logicalTarget)
      ? 'text-primary'
      : 'text-muted-foreground',
    style: {
      stroke: 'currentColor',
      strokeWidth: 2.2,
      opacity: observingRuntime.value || selectedIds.value.size
        ? (focus.value.has(edge.logicalSource) && focus.value.has(edge.logicalTarget) ? 0.85 : 0.12)
        : 0.85,
      strokeDasharray: edge.resource ? '5 4' : undefined,
    },
  })))

function nodeOpacity(data: WorkflowNodeData): number {
  if (observingRuntime.value) {
    return selectedIds.value.has(data.id) ? 1 : 0.22
  }
  if (!selectedIds.value.size) {
    return 1
  }
  return focus.value.get(data.id) ?? 0.22
}

function selectResource(id: string, additive: boolean): void {
  if (observingRuntime.value) {
    return
  }
  const instance = flow.value
  const node = instance?.findNode(id)
  if (!instance || !node) {
    return
  }
  const selected = node.selected
  if (!additive) {
    instance.removeSelectedNodes(instance.getSelectedNodes.value)
  }
  if (selected) {
    instance.removeSelectedNodes([node])
  }
  else {
    instance.addSelectedNodes([node])
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

function toggleResources(id: string): void {
  emit('toggleResources', id)
}

function rememberViewport(): void {
  if (flow.value) {
    emit('viewportChange', flow.value.getViewport())
  }
}

async function zoom(direction: 'in' | 'out'): Promise<void> {
  if (direction === 'in') {
    await flow.value?.zoomIn()
  }
  else {
    await flow.value?.zoomOut()
  }
  rememberViewport()
}

async function fit(): Promise<void> {
  await nextTick()
  await flow.value?.fitView({ padding: 0.2, maxZoom: 1, duration: 200 })
  rememberViewport()
}

async function focusRoot(): Promise<void> {
  await nextTick()
  const root = nodes.value[0]
  if (root) {
    const resources = [
      ...scene.value.edges.filter(edge => edge.resource && edge.target === root.id).map(edge => edge.source),
      ...scene.value.nodes.filter(node => node.parentId === root.id && !node.hidden).map(node => node.id),
    ]
    await flow.value?.fitView({ nodes: [root.id, ...resources], padding: 0.15, maxZoom: 0.7, duration: 200 })
    rememberViewport()
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
  if (observingRuntime.value) {
    return
  }
  Endge.assertWritable()
  emit('arrange')
  await fit()
}

function openDocument(data: WorkflowNodeData): void {
  if (!observingRuntime.value && data.documentType && data.status !== 'missing') {
    emit('openDocument', data)
  }
}
</script>

<template>
  <section
    class="workspace-workflow"
    :aria-label="t('workspaceWorkflow.title')"
    @pointerdown.capture="beginPointerGesture"
    @dblclick.capture="suppressDragDoubleClick"
  >
    <div v-if="!nodes.length" class="workflow-empty">
      <Workflow class="mb-4 size-8 text-violet-400" />
      <h3 class="text-sm font-medium">
        {{ t('workspaceWorkflow.emptyTitle') }}
      </h3>
      <p class="mt-2 max-w-sm text-center text-xs leading-5 text-muted-foreground">
        {{ t('workspaceWorkflow.emptyDescription') }}
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
      :nodes-draggable="!observingRuntime && Endge.mode !== 'debugger' && workflow.layoutEditable"
      :edges-updatable="false"
      :connect-on-click="false"
      :delete-key-code="null"
      :zoom-on-double-click="false"
      :elements-selectable="!observingRuntime"
      :selection-key-code="observingRuntime ? null : selectionMode ? true : 'Shift'"
      :selection-mode="SelectionMode.Full"
      :pan-on-drag="selectionMode ? [1, 2] : true"
      :snap-to-grid="true"
      :snap-grid="snapGrid"
      @init="initialize"
      @nodes-initialized="nodesInitialized"
      @node-drag-start="markNodeDrag"
      @node-drag-stop="!observingRuntime && workflow.moveNodes($event.nodes)"
      @viewport-change-end="emit('viewportChange', $event)"
      @node-double-click="openDocument($event.node.data)"
    >
      <Background :variant="BackgroundVariant.Lines" :gap="32" :line-width="0.5" color="color-mix(in srgb, var(--border) 25%, transparent)" />
      <p v-if="!workflow.layoutEditable" role="status" class="workflow-layout-notice">
        {{ t('workspaceWorkflow.layoutUnavailable') }}
      </p>
      <template #node-workflow="nodeProps">
        <WorkflowNode
          :data="nodeProps.data"
          :selected="observingRuntime ? selectedIds.has(nodeProps.id) : nodeProps.selected"
          :interactive="!observingRuntime"
          :opacity="nodeOpacity(nodeProps.data)"
          @open-document="openDocument"
        />
      </template>
      <template #node-resource-toggle="nodeProps">
        <WorkflowResourceToggle
          :data="nodeProps.data"
          :selected-ids="selectedIds"
          :focus="focus"
          @toggle-resources="toggleResources"
        />
      </template>
      <template #node-compact-resource="nodeProps">
        <WorkflowCompactResource
          :data="nodeProps.data"
          :selected="observingRuntime ? selectedIds.has(nodeProps.id) : nodeProps.selected"
          :interactive="!observingRuntime"
          :opacity="nodeOpacity(nodeProps.data)"
          @open-document="openDocument"
          @select-resource="selectResource"
        />
      </template>
      <template #edge-workflow="edgeProps">
        <WorkflowEdge v-bind="edgeProps" />
      </template>
      <div class="workflow-controls nodrag nopan">
        <Button
          v-if="!observingRuntime"
          :variant="selectionMode ? 'secondary' : 'ghost'"
          size="icon"
          :aria-label="t('workspaceWorkflow.select')"
          :aria-pressed="selectionMode"
          :title="t('workspaceWorkflow.selectHint')"
          @click="selectionMode = !selectionMode"
        >
          <SquareDashedMousePointer class="size-4" />
        </Button>
        <span class="my-1 h-px w-4 bg-border" />
        <Button variant="ghost" size="icon" :aria-label="t('workspaceWorkflow.zoomOut')" :title="t('workspaceWorkflow.zoomOut')" @click="zoom('out')">
          <Minus class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" :aria-label="t('workspaceWorkflow.zoomIn')" :title="t('workspaceWorkflow.zoomIn')" @click="zoom('in')">
          <Plus class="size-4" />
        </Button>
        <span class="my-1 h-px w-4 bg-border" />
        <Button variant="ghost" size="icon" :aria-label="t('workspaceWorkflow.fit')" :title="t('workspaceWorkflow.fit')" @click="fit">
          <Maximize class="size-4" />
        </Button>
        <Button v-if="!observingRuntime" variant="ghost" size="icon" :disabled="Endge.mode === 'debugger' || !workflow.layoutEditable" :aria-label="t('workspaceWorkflow.arrange')" :title="t('workspaceWorkflow.arrange')" @click="arrange">
          <LayoutGrid class="size-4" />
        </Button>
      </div>
    </VueFlow>
  </section>
</template>

<style scoped>
.workspace-workflow { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--background); }
.workflow-canvas { flex: 1; min-height: 0; }
.workflow-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
.workflow-layout-notice { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 5; width: fit-content; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--muted-foreground); font-size: 12px; }
.workflow-controls { position: absolute; bottom: 20px; right: 20px; z-index: 5; display: flex; flex-direction: column; align-items: center; border: 1px solid var(--border); border-radius: 9px; padding: 3px; background: var(--card); box-shadow: 0 4px 20px #00000012; }
.workflow-canvas :deep(.vue-flow__selection),
.workflow-canvas :deep(.vue-flow__nodesselection-rect) { border: 1px dashed var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); border-radius: 4px; }
.workflow-canvas :deep(.vue-flow__edge-textbg) { fill: var(--card); }
.workflow-canvas :deep(.vue-flow__edge-text) { fill: var(--muted-foreground); font-size: 10px; }
</style>
