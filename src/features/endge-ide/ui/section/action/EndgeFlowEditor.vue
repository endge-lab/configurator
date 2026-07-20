<script setup lang="ts">
import type { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'
import type { EndgeIDEFlowBlockSpec } from '@/features/endge-ide/domain/action-flow/endge-ide-flow-catalog.types'
import type { ActionFlowStepKind, ActionRuntimeEvents, RuntimeHost } from '@endge/core'
import type { Connection, Edge, EdgeProps, Node } from '@vue-flow/core'
import type { Component } from 'vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { BUILTIN_ACTION_IDS, DomainSectionType, Endge, RAction, RField } from '@endge/core'
import type { FlowConditionSpec, FlowSwitchBranchConfig } from '@endge/core'
import { useSubscribableRef } from '@endge/utils'
import { useDomainStore } from '@endge/ui-vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Handle, MarkerType, Position, VueFlow } from '@vue-flow/core'
import { ArrowRight, Bell, BellRing, ChevronsDownUp, ChevronsUpDown, CirclePlus, Clock3, Database, GitBranch, Play, RefreshCcw, Repeat, Split, StepForward, Trash2, Zap } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { getEndgeFlowPaletteGroupByKind, groupEndgeFlowPalette, shouldShowEndgeFlowPaletteKind } from '@/features/endge-ide/model/action-flow-editor/endge-flow-palette'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import EndgeFlowBottomPanel from '@/features/endge-ide/ui/section/action/flow-editor/EndgeFlowBottomPanel.vue'
import EndgeFlowContextTree from '@/features/endge-ide/ui/section/action/flow-editor/EndgeFlowContextTree.vue'
import EndgeFlowPalette from '@/features/endge-ide/ui/section/action/flow-editor/EndgeFlowPalette.vue'
import EndgeFlowPayloadDialog from '@/features/endge-ide/ui/section/action/flow-editor/EndgeFlowPayloadDialog.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

type PlaygroundBlockKind = 'action' | 'control'
type PlaygroundNodeRole = 'entry' | 'step'
type PlaygroundNodeVariant = 'entry' | 'watch' | 'eventSubscribe' | 'delay' | 'timer' | 'intervalTimer' | 'action' | 'query' | 'runtimeAction' | 'switch' | 'forEach' | 'while' | 'parallel'

interface FlowPort {
  id: string
  label: string
}

interface PlaygroundPaletteBlock {
  id: string
  title: string
  section: string
  category: string
  kind: PlaygroundBlockKind
  description: string
  variant: PlaygroundNodeVariant
  inputPorts: FlowPort[]
  outputPorts: FlowPort[]
}

interface FlowNodeData {
  nodeRole: PlaygroundNodeRole
  variant: PlaygroundNodeVariant
  title: string
  blockId: string
  actionId: string | null
  queryId: string | null
  runtimeId: string | null
  stepKind: ActionFlowStepKind
  blockKind: PlaygroundBlockKind
  category: string
  description: string
  params: Record<string, unknown>
  inputPorts: FlowPort[]
  outputPorts: FlowPort[]
}

interface ActionOption {
  id: string
  documentId: string
  identity: string
  title: string
  description: string
}

interface QueryOption {
  id: string
  documentId: string
  identity: string
  title: string
  description: string
}

interface DomainDraggedEntity {
  id: string | number
  sectionType: string
  docType?: string
}

interface VariantBadgeMeta {
  icon: Component
  label: string
  className: string
}

const model = defineModel<RActionEditor>({ required: true })
const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'
const paletteCollapsedStorageKey = 'endge-flow-editor.palette-collapsed'
const bottomPanelHeightStorageKey = 'endge-flow-editor.bottom-panel-height'

const CORE_BLOCK_TITLES: Partial<Record<string, string>> = {
  'core.watch': 'Подписка на хранилище',
  'core.event-subscribe': 'Подписка на события',
  'core.delay': 'Задержка',
  'core.timer': 'Таймер',
  'core.interval-timer': 'Таймер',
  'core.action': 'Действие',
  'core.query': 'Запрос',
  'core.runtime-action': 'Управляемое действие',
  'core.switch': 'Условие',
  'core.forEach': 'Цикл',
  'core.while': 'Цикл',
  'core.parallel': 'Параллельно',
}
const DEFAULT_ACTION_NODE_TITLE = 'ДЕЙСТВИЕ'

const flowCanvasRef = ref<HTMLElement | null>(null)
const flowWorkspaceRef = ref<HTMLElement | null>(null)
const contextTreeRef = ref<{ expandAll: () => void, collapseAll: () => void } | null>(null)
const selectedNodeId = ref<string>('')
const executingNodeId = ref<string>('')
const selectedEdgeId = ref<string>('')
const editingTitleNodeId = ref<string>('')
const nodeContextMenu = ref<{ nodeId: string, x: number, y: number } | null>(null)
const isCanvasDragOver = ref(false)
const isHydrating = ref(false)
const showGeneratedCode = ref(false)
const isPaletteCollapsed = useSafeLocalStorage<boolean>(paletteCollapsedStorageKey, false)
const bottomPanelTab = useSmartTabSelection(
  'flow.bottom-panel.active-tab',
  'context',
  ['block', 'context'] as const,
)
const bottomPanelHeight = useSafeLocalStorage<number>(bottomPanelHeightStorageKey, 220)
const isBottomPanelResizing = ref(false)

const { refObj: runtimeModule } = useSubscribableRef(Endge.runtime)
const { refObj: actionsModule } = useSubscribableRef(Endge.actions)
const domainStore = useDomainStore()

const nodes = ref<Node<FlowNodeData>[]>([])
const edges = ref<Edge[]>([])
const temporaryRuntimeActionIdentity = `__temp__.flow-editor.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`
const temporaryRuntimeActionId = -Math.max(1, Math.floor(Date.now() + Math.random() * 100000))
const executionRuntimeId = ref<string | null>(null)
const executionContextTick = ref(0)

const minFlowCanvasHeight = 96
const minBottomPanelHeight = 140
const defaultBottomPanelHeight = 220
const bottomPanelResizeHandleHeight = 9
let handleWindowResize: (() => void) | null = null

function getMaxBottomPanelHeight(): number {
  const workspaceHeight = flowWorkspaceRef.value?.getBoundingClientRect().height ?? 0
  if (!Number.isFinite(workspaceHeight) || workspaceHeight <= 0)
    return Number.POSITIVE_INFINITY

  return Math.max(
    minBottomPanelHeight,
    Math.floor(workspaceHeight - minFlowCanvasHeight - bottomPanelResizeHandleHeight),
  )
}

function clampBottomPanelHeight(nextHeight: number): number {
  return Math.min(getMaxBottomPanelHeight(), Math.max(minBottomPanelHeight, nextHeight))
}

if (!Number.isFinite(bottomPanelHeight.value))
  bottomPanelHeight.value = defaultBottomPanelHeight

onMounted(() => {
  bottomPanelHeight.value = clampBottomPanelHeight(bottomPanelHeight.value)

  handleWindowResize = () => {
    const normalized = clampBottomPanelHeight(bottomPanelHeight.value)
    if (bottomPanelHeight.value !== normalized)
      bottomPanelHeight.value = normalized
  }

  window.addEventListener('resize', handleWindowResize)
})

function clonePort(port: FlowPort): FlowPort {
  return { id: port.id, label: port.label }
}

function createPort(id: string, label: string): FlowPort {
  return { id, label }
}

function isActionPaletteKind(kind: string): boolean {
  return kind === 'action' || kind === 'runtimeAction' || kind === 'query'
}

function toPlaygroundKind(kind: string): PlaygroundBlockKind {
  return isActionPaletteKind(kind) ? 'action' : 'control'
}

function getNodeVariant(kind: string): PlaygroundNodeVariant {
  if (kind === 'start')
    return 'entry'
  if (kind === 'runtimeAction')
    return 'runtimeAction'
  if (kind === 'watch')
    return 'watch'
  if (kind === 'eventSubscribe')
    return 'eventSubscribe'
  if (kind === 'delay')
    return 'delay'
  if (kind === 'timer')
    return 'timer'
  if (kind === 'intervalTimer')
    return 'intervalTimer'
  if (kind === 'query')
    return 'query'
  if (kind === 'switch')
    return 'switch'
  if (kind === 'forEach')
    return 'forEach'
  if (kind === 'while')
    return 'while'
  if (kind === 'parallel')
    return 'parallel'
  return 'action'
}

function getPaletteTitle(spec: { id: string, title: string }): string {
  return CORE_BLOCK_TITLES[spec.id] ?? spec.title ?? spec.id
}

function mapSpecPorts(ports: Array<{ id: string, label: string }>): FlowPort[] {
  return ports.map(port => createPort(port.id, port.label))
}

function getActionDisplayTitle(action: Partial<{ displayName: unknown, name: unknown, identity: unknown, id: unknown }>): string {
  return String(action.displayName ?? '').trim()
    || String(action.name ?? '').trim()
    || String(action.identity ?? '').trim()
    || String(action.id ?? '').trim()
}

function mapBlockSpecToPaletteBlock(spec: { id: string, title: string, description?: string | null, kind: string, inputPorts: Array<{ id: string, label: string }>, outputPorts: Array<{ id: string, label: string }> }, section: string): PlaygroundPaletteBlock {
  return {
    id: spec.id,
    title: getPaletteTitle(spec),
    section,
    category: isActionPaletteKind(spec.kind) ? 'action' : 'control',
    kind: toPlaygroundKind(spec.kind),
    description: spec.description ?? '',
    variant: getNodeVariant(spec.kind),
    inputPorts: mapSpecPorts(spec.inputPorts),
    outputPorts: mapSpecPorts(spec.outputPorts),
  }
}

function getDefaultPortsForVariant(variant: PlaygroundNodeVariant): { inputPorts: FlowPort[], outputPorts: FlowPort[] } {
  if (variant === 'entry') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'старт')],
    }
  }

  if (variant === 'switch') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [
        createPort('case-1', 'условие 1'),
        createPort('else', 'иначе'),
      ],
    }
  }

  if (variant === 'watch') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'далее')],
    }
  }

  if (variant === 'eventSubscribe') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'далее')],
    }
  }

  if (variant === 'delay') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'далее')],
    }
  }

  if (variant === 'timer') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'далее')],
    }
  }

  if (variant === 'intervalTimer') {
    return {
      inputPorts: [],
      outputPorts: [createPort('out', 'далее')],
    }
  }

  if (variant === 'runtimeAction') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [createPort('success', '')],
    }
  }

  if (variant === 'query') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [createPort('success', '')],
    }
  }

  if (variant === 'forEach') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [
        createPort('loop', 'элемент'),
        createPort('done', 'готово'),
      ],
    }
  }

  if (variant === 'while') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [
        createPort('loop', 'цикл'),
        createPort('done', 'готово'),
      ],
    }
  }

  if (variant === 'parallel') {
    return {
      inputPorts: [createPort('in', 'вход')],
      outputPorts: [
        createPort('branch-1', 'ветка 1'),
        createPort('branch-2', 'ветка 2'),
      ],
    }
  }

  return {
    inputPorts: [createPort('in', 'вход')],
    outputPorts: [createPort('success', '')],
  }
}

function createPortsForBlock(block: PlaygroundPaletteBlock): { inputPorts: FlowPort[], outputPorts: FlowPort[] } {
  if (block.inputPorts.length || block.outputPorts.length) {
    return {
      inputPorts: block.inputPorts.map(clonePort),
      outputPorts: block.outputPorts.map(port =>
        block.kind === 'action'
          ? createPort(port.id, '')
          : clonePort(port),
      ),
    }
  }

  return getDefaultPortsForVariant(block.variant)
}

function createExtraPortLabel(variant: PlaygroundNodeVariant, nextIndex: number): string {
  if (variant === 'switch')
    return `условие ${nextIndex}`
  if (variant === 'parallel')
    return `ветка ${nextIndex}`
  if (variant === 'forEach' || variant === 'while')
    return `путь ${nextIndex}`
  return `выход ${nextIndex}`
}

function getVariantBadgeMeta(variant: PlaygroundNodeVariant): VariantBadgeMeta {
  if (variant === 'entry') {
    return {
      icon: Play,
      label: 'Старт',
      className: 'action-playgrounds-node__variant-badge--entry',
    }
  }

  if (variant === 'watch') {
    return {
      icon: BellRing,
      label: 'watch',
      className: 'action-playgrounds-node__variant-badge--watch',
    }
  }

  if (variant === 'eventSubscribe') {
    return {
      icon: Bell,
      label: 'Подписка на события',
      className: 'action-playgrounds-node__variant-badge--event-subscribe',
    }
  }

  if (variant === 'delay') {
    return {
      icon: Clock3,
      label: 'Задержка',
      className: 'action-playgrounds-node__variant-badge--delay',
    }
  }

  if (variant === 'timer') {
    return {
      icon: Clock3,
      label: 'Таймер',
      className: 'action-playgrounds-node__variant-badge--timer',
    }
  }

  if (variant === 'intervalTimer') {
    return {
      icon: Repeat,
      label: 'Таймер',
      className: 'action-playgrounds-node__variant-badge--interval-timer',
    }
  }

  if (variant === 'switch') {
    return {
      icon: GitBranch,
      label: 'Условие',
      className: 'action-playgrounds-node__variant-badge--switch',
    }
  }

  if (variant === 'runtimeAction') {
    return {
      icon: Play,
      label: 'Runtime',
      className: 'action-playgrounds-node__variant-badge--runtime',
    }
  }

  if (variant === 'query') {
    return {
      icon: Database,
      label: 'Запрос',
      className: 'action-playgrounds-node__variant-badge--query',
    }
  }

  if (variant === 'forEach') {
    return {
      icon: RefreshCcw,
      label: 'Цикл',
      className: 'action-playgrounds-node__variant-badge--for-each',
    }
  }

  if (variant === 'while') {
    return {
      icon: RefreshCcw,
      label: 'Цикл',
      className: 'action-playgrounds-node__variant-badge--while',
    }
  }

  if (variant === 'parallel') {
    return {
      icon: Split,
      label: 'Параллельно',
      className: 'action-playgrounds-node__variant-badge--parallel',
    }
  }

  return {
    icon: Zap,
    label: 'Действие',
    className: 'action-playgrounds-node__variant-badge--action',
  }
}

const flowBlockSpecs = computed<EndgeIDEFlowBlockSpec[]>(() => EndgeIDE.flowCatalog.listBlockSpecs())

const actionOptions = computed<ActionOption[]>(() =>
  (void actionsModule.value, Endge.actions.listResolved())
    .map(action => ({
      id: String(action.identity ?? '').trim(),
      documentId: String(action.identity ?? '').trim(),
      identity: String(action.identity ?? '').trim(),
      title: getActionDisplayTitle(action),
      description: String(action.description ?? '').trim(),
    }))
    .filter(action => action.id !== ''),
)

const queryOptions = computed<QueryOption[]>(() =>
  (domainStore.queries ?? [])
    .map(query => ({
      id: String(query.id ?? '').trim(),
      documentId: String(query.id ?? '').trim(),
      identity: String(query.identity ?? '').trim(),
      title: getActionDisplayTitle(query),
      description: String(query.description ?? '').trim(),
    }))
    .filter(query => query.id !== ''),
)

const querySelectOptions = computed(() =>
  queryOptions.value.map(query => ({
    value: query.id,
    label: query.title || query.id,
  })),
)

const consoleLogShortcutBlock: PlaygroundPaletteBlock = {
  id: `shortcut.${BUILTIN_ACTION_IDS.consoleLog}`,
  title: 'Вывод в консоль',
  section: 'Общие команды',
  category: 'action',
  kind: 'action',
  description: `Быстрый shortcut для Action ${BUILTIN_ACTION_IDS.consoleLog}.`,
  variant: 'action',
  inputPorts: [createPort('in', 'вход')],
  outputPorts: [createPort('success', '')],
}

const paletteBlocks = computed<PlaygroundPaletteBlock[]>(() =>
  [
    ...flowBlockSpecs.value
      .filter(spec => spec.kind !== 'start')
      .map(spec => mapBlockSpecToPaletteBlock(spec, getEndgeFlowPaletteGroupByKind(spec.kind)?.title ?? 'Общие команды')),
    consoleLogShortcutBlock,
  ],
)

const paletteSections = computed(() =>
  groupEndgeFlowPalette(flowBlockSpecs.value.filter(spec => spec.kind !== 'start'))
    .map(group => ({
      title: group.title,
      items: [
        ...group.blocks
          .filter(block => shouldShowEndgeFlowPaletteKind(block.kind))
          .map(block => mapBlockSpecToPaletteBlock(block, group.title)),
        ...(group.id === 'flow-commands' ? [consoleLogShortcutBlock] : []),
      ],
    }))
    .filter(group => group.items.length > 0),
)

const generatedPayload = computed(() =>
  JSON.stringify(model.value.flowEditor.toDefinition(), null, 2),
)

const selectedStepNode = computed(() =>
  nodes.value.find(node =>
    String(node.id) === selectedNodeId.value
    && node.data.nodeRole === 'step',
  ) ?? null,
)

const selectedStepLabel = computed(() =>
  selectedStepNode.value?.data.title?.trim()
  || selectedStepNode.value?.data.actionId
  || selectedStepNode.value?.data.queryId
  || selectedStepNode.value?.data.runtimeId
  || 'Block',
)

const currentExecutionState = computed(() => {
  void runtimeModule.value
  void executionContextTick.value

  const runtimeId = executionRuntimeId.value
  if (!runtimeId)
    return null

  const runtime = Endge.runtime.getRuntimeById(runtimeId)
  if (!runtime || runtime.kind !== 'action')
    return null

  const state = (runtime as RuntimeHost<'action'>).context.flowState ?? null
  if (!state)
    return null

  try {
    return structuredClone(state)
  }
  catch {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  }
})

const canRunSelectedNode = computed(() =>
  Boolean(selectedStepNode.value),
)

const nextStepNodeId = computed(() => {
  const node = selectedStepNode.value
  if (!node)
    return ''

  const nodeId = String(node.id)
  const outputPortOrder = new Map(
    node.data.outputPorts.map((port, index) => [port.id, index] as const),
  )

  const nextEdge = edges.value
    .filter(edge => String(edge.source) === nodeId)
    .sort((left, right) => {
      const leftIndex = outputPortOrder.get(String(left.sourceHandle ?? 'out')) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = outputPortOrder.get(String(right.sourceHandle ?? 'out')) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })[0]

  return nextEdge ? String(nextEdge.target) : ''
})

const canRunNextNode = computed(() =>
  Boolean(nextStepNodeId.value),
)

const canManageContextTree = computed(() =>
  Boolean(currentExecutionState.value && typeof currentExecutionState.value === 'object'),
)

const hasSelectedBlock = computed(() =>
  Boolean(selectedStepNode.value),
)

const flowViewportReady = computed(() => Boolean(flowWorkspaceRef.value))

const selectedActionModel = computed(() => {
  const selectedNode = selectedStepNode.value
  if (!selectedNode || selectedNode.data.blockKind !== 'action')
    return null

  if (selectedNode.data.stepKind === 'runtime') {
    const runtimeId = selectedNode.data.runtimeId
    if (!runtimeId)
      return null

    return (domainStore.actions ?? []).find(action =>
      (Array.isArray(action.definition?.nodes) ? action.definition.nodes : []).some((node) => {
        const kind = String(node?.kind ?? '').trim()
        const meta = node?.meta && typeof node.meta === 'object' && !Array.isArray(node.meta)
          ? node.meta as Record<string, unknown>
          : {}
        const stepKind = String(meta.stepKind ?? '').trim()
        if (kind !== 'runtimeAction' && stepKind !== 'runtime')
          return false
        return String(meta.runtimeId ?? meta.actionId ?? '').trim() === String(runtimeId).trim()
      }),
    ) ?? null
  }

  const actionId = selectedNode.data.actionId
  if (!actionId)
    return null

  const option = getActionOption(actionId)
  if (!option)
    return null

  return (void actionsModule.value, Endge.actions.listResolved()).find(action =>
    action.identity === option.identity,
  ) ?? null
})

const selectedInputField = computed<RField | null>(() => {
  const action = selectedActionModel.value
  if (!action?.input)
    return null

  return action.input instanceof RField
    ? action.input
    : new RField(
        String((action.input as Record<string, unknown>)?.name ?? 'input'),
        String((action.input as Record<string, unknown>)?.type ?? ''),
        (action.input as Record<string, unknown>)?.isArray === true,
        (action.input as Record<string, unknown>)?.optional === true,
      )
})

const selectedInputTypeModel = computed(() => {
  const inputField = selectedInputField.value
  if (!inputField?.type)
    return null

  return domainStore.typeCatalog.find((type) => {
    const id = String(type.id ?? '').trim()
    const identity = String(type.identity ?? '').trim()
    return [id, identity].includes(String(inputField.type).trim())
  }) ?? null
})

const selectedInputResolvedType = computed(() =>
  String(
    selectedInputTypeModel.value?.identity
    ?? selectedInputField.value?.type
    ?? '',
  ).trim(),
)

const selectedInputIsBoolean = computed(() => selectedInputResolvedType.value === 'Boolean')
const selectedInputIsNumber = computed(() => selectedInputResolvedType.value === 'Number')
const selectedInputIsStringLike = computed(() =>
  selectedInputResolvedType.value === 'String' || selectedInputResolvedType.value === 'ID',
)

const selectedInputReferenceTarget = computed<string | null>(() => {
  const type = selectedInputTypeModel.value
  const metaTarget = String(type?.entityReference?.target ?? '').trim()
  if (metaTarget)
    return metaTarget

  const rawName = String(type?.identity ?? '').trim()
  if (rawName.startsWith('Ref'))
    return rawName.slice(3).toLowerCase()

  return null
})

const selectedInputAcceptSectionTypes = computed<DomainSectionType[]>(() => {
  const target = selectedInputReferenceTarget.value
  if (!target)
    return []

  const mapping: Record<string, DomainSectionType> = {
    'actions': DomainSectionType.Action,
    'action': DomainSectionType.Action,
    'components': DomainSectionType.Component,
    'component': DomainSectionType.Component,
    'converters': DomainSectionType.Converter,
    'converter': DomainSectionType.Converter,
    'environments': DomainSectionType.Environment,
    'environment': DomainSectionType.Environment,
    'filters': DomainSectionType.Filters,
    'filter': DomainSectionType.Filters,
    'integrations': DomainSectionType.Integration,
    'integration': DomainSectionType.Integration,
    'navigations': DomainSectionType.Navigation,
    'navigation': DomainSectionType.Navigation,
    'pages': DomainSectionType.Page,
    'page': DomainSectionType.Page,
    'page-templates': DomainSectionType.PageTemplate,
    'pagetemplates': DomainSectionType.PageTemplate,
    'pagetemplate': DomainSectionType.PageTemplate,
    'parameters': DomainSectionType.Parameters,
    'parameter': DomainSectionType.Parameters,
    'policies': DomainSectionType.Policy,
    'policy': DomainSectionType.Policy,
    'projects': DomainSectionType.Project,
    'project': DomainSectionType.Project,
    'queries': DomainSectionType.Query,
    'query': DomainSectionType.Query,
    'styles': DomainSectionType.Style,
    'style': DomainSectionType.Style,
    'types': DomainSectionType.Type,
    'type': DomainSectionType.Type,
    'vocabs': DomainSectionType.Vocabs,
    'vocab': DomainSectionType.Vocabs,
  }

  const sectionType = mapping[target.toLowerCase()]
  return sectionType ? [sectionType] : []
})

const selectedInputReferenceOptions = computed(() => {
  const target = selectedInputReferenceTarget.value?.toLowerCase() ?? ''
  const sourceMap: Record<string, Array<Record<string, unknown>> | undefined> = {
    'action': domainStore.actions as Array<Record<string, unknown>> | undefined,
    'actions': domainStore.actions as Array<Record<string, unknown>> | undefined,
    'component': domainStore.components as Array<Record<string, unknown>> | undefined,
    'components': domainStore.components as Array<Record<string, unknown>> | undefined,
    'converter': domainStore.converters as Array<Record<string, unknown>> | undefined,
    'converters': domainStore.converters as Array<Record<string, unknown>> | undefined,
    'environment': domainStore.environments as Array<Record<string, unknown>> | undefined,
    'environments': domainStore.environments as Array<Record<string, unknown>> | undefined,
    'filter': domainStore.filters as Array<Record<string, unknown>> | undefined,
    'filters': domainStore.filters as Array<Record<string, unknown>> | undefined,
    'integration': domainStore.integrations as Array<Record<string, unknown>> | undefined,
    'integrations': domainStore.integrations as Array<Record<string, unknown>> | undefined,
    'navigation': domainStore.navigations as Array<Record<string, unknown>> | undefined,
    'navigations': domainStore.navigations as Array<Record<string, unknown>> | undefined,
    'page': domainStore.pages as Array<Record<string, unknown>> | undefined,
    'pages': domainStore.pages as Array<Record<string, unknown>> | undefined,
    'page-template': domainStore.pageTemplates as Array<Record<string, unknown>> | undefined,
    'pageTemplate': domainStore.pageTemplates as Array<Record<string, unknown>> | undefined,
    'pagetemplate': domainStore.pageTemplates as Array<Record<string, unknown>> | undefined,
    'pagetemplates': domainStore.pageTemplates as Array<Record<string, unknown>> | undefined,
    'parameter': domainStore.parameters as Array<Record<string, unknown>> | undefined,
    'parameters': domainStore.parameters as Array<Record<string, unknown>> | undefined,
    'policy': domainStore.policies as Array<Record<string, unknown>> | undefined,
    'policies': domainStore.policies as Array<Record<string, unknown>> | undefined,
    'project': domainStore.projects as Array<Record<string, unknown>> | undefined,
    'projects': domainStore.projects as Array<Record<string, unknown>> | undefined,
    'query': domainStore.queries as Array<Record<string, unknown>> | undefined,
    'queries': domainStore.queries as Array<Record<string, unknown>> | undefined,
    'style': domainStore.styles as Array<Record<string, unknown>> | undefined,
    'styles': domainStore.styles as Array<Record<string, unknown>> | undefined,
    'type': domainStore.types as Array<Record<string, unknown>> | undefined,
    'types': domainStore.types as Array<Record<string, unknown>> | undefined,
    'vocab': domainStore.vocabs as Array<Record<string, unknown>> | undefined,
    'vocabs': domainStore.vocabs as Array<Record<string, unknown>> | undefined,
  }

  return (sourceMap[target] ?? [])
    .map((item) => {
      const rawId = item?.id != null ? String(item.id) : String(item?.identity ?? '')
      const label = String(item?.displayName ?? item?.name ?? item?.identity ?? rawId).trim()
      return {
        value: rawId,
        label,
      }
    })
    .filter(option => option.value !== '')
})

const autocompleteState = reactive({
  open: false,
  activeKey: '',
  items: [] as string[],
  index: 0,
  rangeStart: 0,
  rangeEnd: 0,
  inputEl: null as HTMLInputElement | null,
  menuTop: 0,
  menuLeft: 0,
  menuWidth: 0,
  menuMaxHeight: 280,
})

const autocompleteMenuStyle = computed(() => ({
  top: `${autocompleteState.menuTop}px`,
  left: `${autocompleteState.menuLeft}px`,
  width: `${autocompleteState.menuWidth}px`,
  maxHeight: `${autocompleteState.menuMaxHeight}px`,
}))

const nodeContextMenuStyle = computed(() => ({
  top: `${nodeContextMenu.value?.y ?? 0}px`,
  left: `${nodeContextMenu.value?.x ?? 0}px`,
}))

function getPaletteBlock(blockId: string): PlaygroundPaletteBlock | undefined {
  return paletteBlocks.value.find(block => block.id === blockId)
}

function togglePaletteCollapsed(): void {
  isPaletteCollapsed.value = !isPaletteCollapsed.value
}

function getSelectedNodeParams(): Record<string, unknown> {
  return selectedStepNode.value?.data.params ?? {}
}

function normalizeWatchPaths(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(path => String(path ?? '').trim()).filter(Boolean)
    : []
}

function getSelectedWatchPaths(): string[] {
  return normalizeWatchPaths(getSelectedNodeParams().watchPaths)
}

function normalizeEventNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(name => String(name ?? '').trim()).filter(Boolean)
    : []
}

function getSelectedEventNames(): string[] {
  return normalizeEventNames(getSelectedNodeParams().eventNames)
}

function getSelectedDelayMs(): string {
  const value = getSelectedNodeParams().delayMs
  if (value == null)
    return ''
  return String(value)
}

function addSelectedWatchPath(): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    watchPaths: [...getSelectedWatchPaths(), ''],
  })
}

function addSelectedEventName(): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    eventNames: [...getSelectedEventNames(), ''],
  })
}

function updateSelectedWatchPath(index: number, value: string): void {
  const nextItems = [...getSelectedWatchPaths()]
  while (nextItems.length <= index)
    nextItems.push('')
  nextItems[index] = String(value ?? '')
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    watchPaths: nextItems,
  })
}

function removeSelectedWatchPath(index: number): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    watchPaths: getSelectedWatchPaths().filter((_, itemIndex) => itemIndex !== index),
  })
}

function updateSelectedEventName(index: number, value: string): void {
  const nextItems = [...getSelectedEventNames()]
  while (nextItems.length <= index)
    nextItems.push('')
  nextItems[index] = String(value ?? '')
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    eventNames: nextItems,
  })
}

function removeSelectedEventName(index: number): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    eventNames: getSelectedEventNames().filter((_, itemIndex) => itemIndex !== index),
  })
}

function updateSelectedDelayMs(value: string): void {
  const normalized = String(value ?? '').trim()
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    delayMs: normalized === '' ? null : Number(normalized),
  })
}

/** Условия из реестра flow для панели switch. */
const flowRegistryConditions = computed<FlowConditionSpec[]>(() => Endge.runtime.flow.conditions.listConditions())

/** Опции выбора словаря (для условий типа vocab.exists). */
const vocabOptionsForSwitch = computed(() =>
  (domainStore.vocabs ?? [])
    .map((item: Record<string, unknown>) => ({
      value: String(item?.id ?? item?.identity ?? ''),
      label: String(item?.displayName ?? item?.name ?? item?.identity ?? '').trim(),
    }))
    .filter((o: { value: string }) => o.value !== ''),
)

function getSwitchConditionMode(): 'script' | 'registry' {
  const mode = getSelectedNodeParams().conditionMode
  return mode === 'registry' ? 'registry' : 'script'
}

function setSwitchConditionMode(mode: 'script' | 'registry'): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    conditionMode: mode,
  })
}

function getSwitchScriptExpression(): string {
  const v = getSelectedNodeParams().scriptExpression
  return v != null ? String(v) : ''
}

function setSwitchScriptExpression(value: string): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    scriptExpression: String(value ?? '').trim() || undefined,
  })
}

/** Ветки switch (по одной на каждый не-else порт). */
function getSwitchBranches(): Array<{ portId: string; conditionId: string; params: Record<string, unknown> }> {
  const ports = selectedStepNode.value?.data?.outputPorts ?? []
  const elsePortId = 'else'
  const casePorts = ports.filter((p: { id: string }) => String(p.id) !== elsePortId)
  const branches = (getSelectedNodeParams().branches as FlowSwitchBranchConfig[] | undefined) ?? []
  return casePorts.map((port: { id: string }) => {
    const b = branches.find((bb: FlowSwitchBranchConfig) => String(bb?.portId) === String(port.id))
    return {
      portId: String(port.id),
      conditionId: b?.conditionId ?? '',
      params: (b?.params && typeof b.params === 'object') ? { ...b.params } : {},
    }
  })
}

function updateSwitchBranches(nextBranches: Array<{ portId: string; conditionId: string; params: Record<string, unknown> }>): void {
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    branches: nextBranches.map(({ portId, conditionId, params }) => ({ portId, conditionId, params })),
  })
}

function updateSwitchBranchCondition(branchIndex: number, conditionId: string): void {
  const branches = getSwitchBranches()
  if (branchIndex < 0 || branchIndex >= branches.length) return
  const next = [...branches]
  next[branchIndex] = { ...next[branchIndex], conditionId: String(conditionId ?? '').trim() }
  updateSwitchBranches(next)
}

function updateSwitchBranchParam(branchIndex: number, paramKey: string, value: unknown): void {
  const branches = getSwitchBranches()
  if (branchIndex < 0 || branchIndex >= branches.length) return
  const next = [...branches]
  next[branchIndex] = {
    ...next[branchIndex],
    params: { ...next[branchIndex].params, [paramKey]: value },
  }
  updateSwitchBranches(next)
}

function getInputParamKey(): string {
  return selectedInputField.value?.name?.trim() || 'input'
}

function getSelectedInputValue(): unknown {
  return getSelectedNodeParams()[getInputParamKey()]
}

function isReferenceInputField(field: RField | null): boolean {
  return Boolean(field && selectedInputReferenceTarget.value)
}

function normalizeArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : []
}

function normalizeScalarValue(value: unknown): string {
  if (value == null)
    return ''
  return String(value)
}

function updateSelectedNodeParams(nextParams: Record<string, unknown>): void {
  const selectedId = selectedStepNode.value?.id != null ? String(selectedStepNode.value.id) : ''
  if (!selectedId)
    return

  nodes.value = nodes.value.map((node) => {
    if (String(node.id) !== selectedId)
      return node

    return {
      ...node,
      data: {
        ...node.data,
        params: nextParams,
      },
    }
  })

  syncEditorFromGraph()
}

function updateSelectedInputValue(value: unknown): void {
  const key = getInputParamKey()
  updateSelectedNodeParams({
    ...getSelectedNodeParams(),
    [key]: value,
  })
}

function addSelectedInputArrayItem(): void {
  const field = selectedInputField.value
  if (!field?.isArray)
    return

  const nextItems = normalizeArrayValue(getSelectedInputValue())
  nextItems.push(null)
  updateSelectedInputValue(nextItems)
}

function removeSelectedInputArrayItem(index: number): void {
  const field = selectedInputField.value
  if (!field?.isArray)
    return

  const nextItems = normalizeArrayValue(getSelectedInputValue()).filter((_, itemIndex) => itemIndex !== index)
  updateSelectedInputValue(nextItems)
}

function updateSelectedInputArrayItem(index: number, value: unknown): void {
  const field = selectedInputField.value
  if (!field?.isArray)
    return

  const nextItems = normalizeArrayValue(getSelectedInputValue())
  while (nextItems.length <= index)
    nextItems.push(null)
  nextItems[index] = value
  updateSelectedInputValue(nextItems)
}

function collectContextPaths(
  value: unknown,
  currentPath: string,
  target: Set<string>,
  visited: WeakSet<object>,
  depth: number,
): void {
  target.add(currentPath)

  if (depth >= 8 || value == null || typeof value !== 'object')
    return

  const objectValue = value as object
  if (visited.has(objectValue))
    return
  visited.add(objectValue)

  if (Array.isArray(value)) {
    const maxItems = Math.min(value.length, 50)
    for (let index = 0; index < maxItems; index += 1)
      collectContextPaths(value[index], `${currentPath}.${index}`, target, visited, depth + 1)
    return
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const sanitizedKey = String(key ?? '').trim()
    if (!sanitizedKey)
      continue
    collectContextPaths(nestedValue, `${currentPath}.${sanitizedKey}`, target, visited, depth + 1)
  }
}

function buildContextSuggestions(): string[] {
  const state = currentExecutionState.value
  const base = ['ctx.input', 'ctx.locals', 'ctx.lastStep', 'ctx.globals', 'ctx.steps']
  if (!state)
    return base

  const target = new Set<string>(['ctx'])
  const visited = new WeakSet<object>()
  collectContextPaths(state, 'ctx', target, visited, 0)
  base.forEach(item => target.add(item))

  return Array.from(target).sort((left, right) => left.localeCompare(right))
}

function getOpenContextToken(text: string, cursor: number): { start: number, end: number, prefix: string } | null {
  const value = String(text)
  const safeCursor = Math.max(0, Math.min(cursor, value.length))
  const start = value.lastIndexOf('{', safeCursor - 1)
  if (start < 0)
    return null

  const end = safeCursor
  const between = value.slice(start + 1, end)
  if (between.includes('}'))
    return null

  return {
    start,
    end,
    prefix: between.trim(),
  }
}

function openAutocomplete(key: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  if (!target)
    return

  const value = String(target.value ?? '')
  const cursor = target.selectionStart ?? value.length
  const token = getOpenContextToken(value, cursor)
  if (!token)
    return closeAutocomplete()

  if (token.prefix && !token.prefix.startsWith('ctx'))
    return closeAutocomplete()

  const suggestions = buildContextSuggestions()
    .filter(item => item.startsWith(token.prefix || 'ctx'))

  if (suggestions.length === 0)
    return closeAutocomplete()

  autocompleteState.open = true
  autocompleteState.activeKey = key
  autocompleteState.items = suggestions
  autocompleteState.index = 0
  autocompleteState.rangeStart = token.start
  autocompleteState.rangeEnd = token.end
  autocompleteState.inputEl = target

  const rect = target.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const menuMaxHeight = Math.min(320, Math.floor(viewportHeight * 0.45))
  const estimatedHeight = Math.min(menuMaxHeight, 34 + suggestions.length * 30)
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
  const menuWidth = Math.max(220, Math.floor(rect.width))
  const maxLeft = Math.max(8, viewportWidth - menuWidth - 8)

  autocompleteState.menuTop = openUp
    ? Math.max(8, Math.floor(rect.top - estimatedHeight - 6))
    : Math.max(8, Math.floor(rect.bottom + 6))
  autocompleteState.menuLeft = Math.min(maxLeft, Math.max(8, Math.floor(rect.left)))
  autocompleteState.menuWidth = menuWidth
  autocompleteState.menuMaxHeight = menuMaxHeight
}

function closeAutocomplete(): void {
  autocompleteState.open = false
  autocompleteState.activeKey = ''
  autocompleteState.items = []
  autocompleteState.index = 0
  autocompleteState.rangeStart = 0
  autocompleteState.rangeEnd = 0
  autocompleteState.inputEl = null
  autocompleteState.menuTop = 0
  autocompleteState.menuLeft = 0
  autocompleteState.menuWidth = 0
  autocompleteState.menuMaxHeight = 280
}

function applyAutocompleteSelection(
  key: string,
  getValue: () => string,
  setValue: (value: string) => void,
): void {
  if (!autocompleteState.open || autocompleteState.activeKey !== key)
    return

  const suggestion = autocompleteState.items[autocompleteState.index]
  if (!suggestion)
    return

  const currentValue = String(autocompleteState.inputEl?.value ?? getValue())
  const before = currentValue.slice(0, autocompleteState.rangeStart)
  const after = currentValue.slice(autocompleteState.rangeEnd)
  const insertion = `{${suggestion}}`
  const nextValue = `${before}${insertion}${after}`

  setValue(nextValue)

  const caretPos = before.length + insertion.length
  nextTick(() => {
    autocompleteState.inputEl?.setSelectionRange(caretPos, caretPos)
  })

  closeAutocomplete()
}

function applyAutocompleteSelectionAt(
  itemIndex: number,
  key: string,
  getValue: () => string,
  setValue: (value: string) => void,
): void {
  autocompleteState.index = itemIndex
  applyAutocompleteSelection(key, getValue, setValue)
}

function onAutocompleteKeydown(
  event: KeyboardEvent,
  key: string,
  getValue: () => string,
  setValue: (value: string) => void,
): void {
  if (!autocompleteState.open || autocompleteState.activeKey !== key)
    return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    autocompleteState.index = (autocompleteState.index + 1) % autocompleteState.items.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    autocompleteState.index = (autocompleteState.index - 1 + autocompleteState.items.length) % autocompleteState.items.length
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    applyAutocompleteSelection(key, getValue, setValue)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeAutocomplete()
  }
}

function onAutocompleteInput(
  event: Event,
  key: string,
): void {
  openAutocomplete(key, event)
}

function getAutocompleteKey(suffix: string): string {
  return `input:${suffix}`
}

function getReferenceHintText(): string {
  const sectionType = selectedInputAcceptSectionTypes.value[0]
  if (!sectionType)
    return 'Или перетащите сюда'

  const labels: Record<string, string> = {
    [DomainSectionType.Action]: 'действие',
    [DomainSectionType.Component]: 'компонент',
    [DomainSectionType.Converter]: 'конвертер',
    [DomainSectionType.Environment]: 'окружение',
    [DomainSectionType.Filters]: 'фильтр',
    [DomainSectionType.Integration]: 'интеграцию',
    [DomainSectionType.Navigation]: 'навигацию',
    [DomainSectionType.Page]: 'страницу',
    [DomainSectionType.PageTemplate]: 'шаблон страницы',
    [DomainSectionType.Parameters]: 'параметр',
    [DomainSectionType.Policy]: 'политику',
    [DomainSectionType.Project]: 'проект',
    [DomainSectionType.Query]: 'запрос',
    [DomainSectionType.Style]: 'стиль',
    [DomainSectionType.Type]: 'тип',
    [DomainSectionType.Vocabs]: 'словарь',
  }

  return `Или перетащите сюда ${labels[sectionType] ?? 'сущность'} из домена`
}

function getActionOption(actionId: string | null | undefined): ActionOption | undefined {
  if (!actionId)
    return undefined
  const normalized = String(actionId).trim()
  return actionOptions.value.find(action =>
    action.id === normalized
    || action.documentId === normalized
    || action.identity === normalized,
  )
}

function getQueryOption(queryId: string | null | undefined): QueryOption | undefined {
  if (!queryId)
    return undefined
  const normalized = String(queryId).trim()
  return queryOptions.value.find(query =>
    query.id === normalized
    || query.documentId === normalized
    || query.identity === normalized,
  )
}

function getActionOptionByDraggedEntity(payload: DomainDraggedEntity): ActionOption | undefined {
  const rawId = String(payload.id ?? '').trim()
  if (!rawId)
    return undefined

  return actionOptions.value.find(action =>
    action.documentId === rawId || action.id === rawId || action.identity === rawId,
  )
}

function getQueryOptionByDraggedEntity(payload: DomainDraggedEntity): QueryOption | undefined {
  const rawId = String(payload.id ?? '').trim()
  if (!rawId)
    return undefined

  return queryOptions.value.find(query =>
    query.documentId === rawId || query.id === rawId || query.identity === rawId,
  )
}

function getPrimaryActionBlock(): PlaygroundPaletteBlock | undefined {
  return getPaletteBlock('core.action') ?? paletteBlocks.value.find(block => block.kind === 'action')
}

function getPrimaryQueryBlock(): PlaygroundPaletteBlock | undefined {
  return getPaletteBlock('core.query') ?? paletteBlocks.value.find(block => block.variant === 'query')
}

function createEntryNode(): Node<FlowNodeData> {
  const startSpec = flowBlockSpecs.value.find(spec => spec.kind === 'start')
  const startPorts = startSpec
    ? {
        inputPorts: mapSpecPorts(startSpec.inputPorts),
        outputPorts: mapSpecPorts(startSpec.outputPorts),
      }
    : getDefaultPortsForVariant('entry')

  return {
    id: 'flow-entry',
    type: 'entryNode',
    position: { x: 40, y: 180 },
    sourcePosition: Position.Right,
    draggable: false,
    selectable: true,
    data: {
      nodeRole: 'entry',
      variant: 'entry',
      title: 'start',
      blockId: startSpec?.id ?? 'core.start',
      actionId: null,
      queryId: null,
      runtimeId: null,
      stepKind: 'builtin',
      blockKind: 'control',
      category: 'entry',
      description: startSpec?.description ?? 'Начало исполнения',
      params: {},
      inputPorts: startPorts.inputPorts,
      outputPorts: startPorts.outputPorts,
    },
  }
}

function createNodeFromBlock(
  block: PlaygroundPaletteBlock,
  id: string,
  position: { x: number, y: number },
  initialActionId: string | null = null,
  initialQueryId: string | null = null,
  initialRuntimeId: string | null = null,
  initialTitle?: string,
  initialStepKind: ActionFlowStepKind = 'action',
  initialParams: Record<string, unknown> = {},
  opts?: {
    fallbackToFirstAction?: boolean
    fallbackToFirstQuery?: boolean
  },
): Node<FlowNodeData> {
  const ports = createPortsForBlock(block)
  const isRuntimeBlock = block.id === 'core.runtime-action'
  const isQueryBlock = block.id === 'core.query' || block.variant === 'query'
  const resolvedAction = getActionOption(initialActionId)
  const resolvedQuery = getQueryOption(initialQueryId)
  const actionId = block.kind === 'action' && !isRuntimeBlock && !isQueryBlock
    ? (resolvedAction?.id
      ?? (opts?.fallbackToFirstAction !== false ? (actionOptions.value[0]?.id ?? null) : null))
    : null
  const queryId = isQueryBlock
    ? (resolvedQuery?.id
      ?? (opts?.fallbackToFirstQuery !== false ? (queryOptions.value[0]?.id ?? null) : null))
    : null
  const runtimeId = isRuntimeBlock ? (initialRuntimeId ?? id) : null
  const action = getActionOption(actionId)
  const query = getQueryOption(queryId)

  return {
    id,
    type: 'flowNode',
    position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      nodeRole: 'step',
      variant: block.variant,
      title: initialTitle || (block.kind === 'action' && !isQueryBlock ? DEFAULT_ACTION_NODE_TITLE : block.title),
      blockId: block.id,
      actionId,
      queryId,
      runtimeId,
      stepKind: isRuntimeBlock ? 'runtime' : (block.kind === 'action' && !isQueryBlock ? initialStepKind : 'builtin'),
      blockKind: block.kind,
      category: block.category,
      description: isQueryBlock
        ? (query?.description ?? '')
        : block.kind === 'action'
        ? ((isRuntimeBlock || initialStepKind === 'runtime') ? '' : (action?.description ?? ''))
        : block.description,
      params: { ...initialParams },
      inputPorts: ports.inputPorts,
      outputPorts: ports.outputPorts,
    },
  }
}

function getOutputHandleStyle(nodeData: FlowNodeData, index: number | string): Record<string, string> {
  const safeIndex = Number(index)
  const normalizedIndex = Number.isFinite(safeIndex) ? safeIndex : 0
  return {
    top: `${18 + normalizedIndex * 36}px`,
  }
}

function createEdge(
  source: string,
  target: string,
  sourceHandle = 'out',
  targetHandle = 'in',
  edgeId?: string,
): Edge {
  return {
    id: edgeId ?? `edge-${source}-${sourceHandle}-${target}-${targetHandle}`,
    type: 'playground',
    source,
    target,
    sourceHandle,
    targetHandle,
    label: 'dependsOn',
    markerEnd: MarkerType.ArrowClosed,
    animated: true,
    updatable: true,
    selectable: true,
    focusable: true,
  }
}

function hydrateGraphFromEditor(): void {
  isHydrating.value = true

  const entryNode = createEntryNode()
  const flow = model.value.flowEditor.toDefinition()

  const nextNodes: Node<FlowNodeData>[] = [entryNode]

  flow.nodes.forEach((flowNode, index) => {
    const meta = flowNode.meta && typeof flowNode.meta === 'object' && !Array.isArray(flowNode.meta)
      ? flowNode.meta as Record<string, unknown>
      : {}
    const isRuntimeNode = flowNode.kind === 'runtimeAction' || meta.stepKind === 'runtime'
    const fallbackBlock = isRuntimeNode
      ? getPaletteBlock('core.runtime-action')
      : (flowNode.kind === 'query' ? getPrimaryQueryBlock() : (flowNode.kind === 'action' ? getPrimaryActionBlock() : null))
    const block = getPaletteBlock(flowNode.blockId) ?? fallbackBlock
    if (!block)
      return

    try {
      nextNodes.push(createNodeFromBlock(
        block,
        flowNode.id,
        { x: 300 + index * 460, y: 180 },
        String(meta.actionId ?? '').trim() || null,
        String(meta.queryId ?? '').trim() || null,
        String(meta.runtimeId ?? '').trim() || null,
        flowNode.title,
        (meta.stepKind as ActionFlowStepKind | undefined) ?? 'action',
        flowNode.params && typeof flowNode.params === 'object' && !Array.isArray(flowNode.params)
          ? flowNode.params as Record<string, unknown>
          : {},
        { fallbackToFirstAction: false, fallbackToFirstQuery: false },
      ))
    }
    catch (error) {
      console.warn('[EndgeFlowEditor] Skip invalid flow node during hydration', {
        nodeId: flowNode.id,
        blockId: flowNode.blockId,
        error,
      })
    }
  })

  const nodeIds = new Set(nextNodes.map(node => String(node.id)))
  const nextEdges = flow.edges.map(edge =>
    createEdge(
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.sourcePortId || 'out',
      edge.targetPortId || 'in',
      edge.id,
    ),
  ).filter(edge =>
    (String(edge.source) === 'flow-entry' || nodeIds.has(String(edge.source)))
    && nodeIds.has(String(edge.target)),
  )

  nodes.value = nextNodes
  edges.value = nextEdges

  if (selectedNodeId.value && !nextNodes.some(node => String(node.id) === selectedNodeId.value))
    selectedNodeId.value = ''
  if (selectedEdgeId.value && !nextEdges.some(edge => edge.id === selectedEdgeId.value))
    selectedEdgeId.value = ''

  isHydrating.value = false
}

function syncEditorFromGraph(): void {
  if (isHydrating.value)
    return

  const flow = {
    version: 1,
    entrypoint: 'flow-entry',
    nodes: nodes.value
      .filter(node => node.data.nodeRole !== 'entry')
      .map((node) => {
        const actionIdRaw = String(node.data.actionId ?? '').trim()
        const actionIdNumber = Number(actionIdRaw)
        const actionId = actionIdRaw
          ? (Number.isFinite(actionIdNumber) ? actionIdNumber : actionIdRaw)
          : null
        const queryIdRaw = String(node.data.queryId ?? '').trim()
        const queryIdNumber = Number(queryIdRaw)
        const queryId = queryIdRaw
          ? (Number.isFinite(queryIdNumber) ? queryIdNumber : queryIdRaw)
          : null

        return {
          id: String(node.id),
          title: node.data.title,
          blockId: node.data.blockId,
          kind: node.data.variant === 'entry' ? 'start' : (node.data.variant === 'action' ? 'action' : node.data.variant),
          params: { ...node.data.params },
          meta: {
            actionId,
            queryId,
            runtimeId: node.data.runtimeId,
            stepKind: node.data.stepKind,
          },
        }
      }),
    edges: edges.value.map(edge => ({
      id: edge.id,
      sourceNodeId: String(edge.source),
      sourcePortId: String(edge.sourceHandle ?? 'out'),
      targetNodeId: String(edge.target),
      targetPortId: String(edge.targetHandle ?? 'in'),
      label: edge.label != null ? String(edge.label) : null,
    })),
  } as const

  model.value.flowEditor.fillFromDefinition(flow)
  model.value.syncDefinitionFromFlowEditor()
}

watch(() => model.value, () => {
  hydrateGraphFromEditor()
}, { immediate: true })

watch(actionOptions, (options) => {
  if (options.length === 0)
    return

  let updated = false

  nodes.value = nodes.value.map((node) => {
    if (
      node.data.nodeRole !== 'step'
      || node.data.variant !== 'action'
      || node.data.stepKind === 'runtime'
      || node.data.actionId
    ) {
      return node
    }

    updated = true
    const action = options[0]

    return {
      ...node,
      data: {
        ...node.data,
        actionId: action.id,
        queryId: null,
        runtimeId: node.data.runtimeId,
        title: node.data.title.trim() ? node.data.title : action.title,
        description: action.description,
      },
    }
  })

  if (updated)
    syncEditorFromGraph()
}, { immediate: true })

watch(queryOptions, (options) => {
  if (options.length === 0)
    return

  let updated = false

  nodes.value = nodes.value.map((node) => {
    if (node.data.nodeRole !== 'step' || node.data.variant !== 'query' || node.data.queryId)
      return node

    updated = true
    const query = options[0]

    return {
      ...node,
      data: {
        ...node.data,
        actionId: null,
        queryId: query.id,
        runtimeId: node.data.runtimeId,
        title: node.data.title.trim() ? node.data.title : query.title,
        description: query.description,
      },
    }
  })

  if (updated)
    syncEditorFromGraph()
}, { immediate: true })

watch(hasSelectedBlock, (selected) => {
  if (!selected && bottomPanelTab.value === 'block')
    bottomPanelTab.value = 'context'
}, { immediate: true })

function selectNode(nodeId: string): void {
  selectedNodeId.value = nodeId
  bottomPanelTab.value = 'block'
  closeNodeContextMenu()
}

function startTitleEdit(nodeId: string): void {
  closeNodeContextMenu()
  editingTitleNodeId.value = nodeId

  nextTick(() => {
    const element = document.querySelector<HTMLInputElement>(`[data-node-title-input="${nodeId}"]`)
    element?.focus()
    element?.select()
  })
}

function finishTitleEdit(nodeId: string): void {
  if (editingTitleNodeId.value === nodeId)
    editingTitleNodeId.value = ''
}

function openNodeContextMenu(event: MouseEvent, nodeId: string): void {
  event.preventDefault()
  event.stopPropagation()

  const menuWidth = 180
  const menuHeight = 84
  const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
  const maxTop = Math.max(8, window.innerHeight - menuHeight - 8)

  selectedNodeId.value = nodeId
  selectedEdgeId.value = ''
  editingTitleNodeId.value = ''
  bottomPanelTab.value = 'block'
  nodeContextMenu.value = {
    nodeId,
    x: Math.min(maxLeft, Math.max(8, event.clientX)),
    y: Math.min(maxTop, Math.max(8, event.clientY)),
  }
}

function closeNodeContextMenu(): void {
  nodeContextMenu.value = null
}

function renameNodeFromContextMenu(): void {
  const nodeId = nodeContextMenu.value?.nodeId
  if (!nodeId)
    return

  startTitleEdit(nodeId)
}

function runNodeFromContextMenu(): void {
  const nodeId = nodeContextMenu.value?.nodeId
  if (!nodeId)
    return

  selectedNodeId.value = nodeId
  runSelectedNode()
  closeNodeContextMenu()
}

function addNodeFromResolvedBlock(
  block: PlaygroundPaletteBlock,
  position?: { x: number, y: number },
  opts?: {
    initialActionId?: string | null
    initialQueryId?: string | null
    initialRuntimeId?: string | null
    initialTitle?: string
  },
): void {
  const takenIds = new Set(nodes.value.map(node => String(node.id)))
  let counter = nodes.value.length
  let nextId = `step-${counter}`

  while (takenIds.has(nextId)) {
    counter += 1
    nextId = `step-${counter}`
  }

  const previous = nodes.value.find(node => String(node.id) === selectedNodeId.value) ?? null
  const nextPosition = position ?? {
    x: 80 + nodes.value.length * 280,
    y: 180,
  }

  const nextNode = createNodeFromBlock(
    block,
    nextId,
    nextPosition,
    opts?.initialActionId ?? null,
    opts?.initialQueryId ?? null,
    opts?.initialRuntimeId ?? null,
    opts?.initialTitle,
  )

  nodes.value = [
    ...nodes.value,
    nextNode,
  ]

  if (previous && previous.id !== nextId && nextNode.data.inputPorts.length > 0) {
    edges.value = [
      ...edges.value,
      createEdge(
        String(previous.id),
        nextId,
        previous.data.outputPorts[0]?.id ?? 'out',
        nextNode.data.inputPorts[0]?.id ?? 'in',
      ),
    ]
  }

  selectedNodeId.value = nextId
  syncEditorFromGraph()
}

function removeStepById(nodeId: string): void {
  if (nodeId === 'flow-entry')
    return

  nodes.value = nodes.value.filter(node => node.id !== nodeId)
  edges.value = edges.value.filter(edge => edge.source !== nodeId && edge.target !== nodeId)

  if (selectedNodeId.value === nodeId)
    selectedNodeId.value = ''
  if (!edges.value.some(edge => edge.id === selectedEdgeId.value))
    selectedEdgeId.value = ''
  if (nodeContextMenu.value?.nodeId === nodeId)
    closeNodeContextMenu()

  syncEditorFromGraph()
}

function hasEdge(
  source: string,
  target: string,
  sourceHandle = 'out',
  targetHandle = 'in',
  excludedEdgeId?: string,
): boolean {
  return edges.value.some(edge =>
    edge.id !== excludedEdgeId
    && String(edge.source) === source
    && String(edge.target) === target
    && String(edge.sourceHandle ?? 'out') === sourceHandle
    && String(edge.targetHandle ?? 'in') === targetHandle,
  )
}

function replaceOutgoingEdge(
  source: string,
  target: string,
  sourceHandle = 'out',
  targetHandle = 'in',
  edgeId?: string,
): void {
  const nextEdges = edges.value.filter(edge =>
    String(edge.source) !== source
    || String(edge.sourceHandle ?? 'out') !== sourceHandle
    || edge.id === edgeId,
  )

  if (edgeId && nextEdges.some(edge => edge.id === edgeId)) {
    edges.value = nextEdges.map(edge =>
      edge.id === edgeId
        ? createEdge(source, target, sourceHandle, targetHandle, edgeId)
        : edge,
    )
  }
  else {
    edges.value = [
      ...nextEdges,
      createEdge(source, target, sourceHandle, targetHandle, edgeId),
    ]
  }

  syncEditorFromGraph()
}

function updateNodeTitle(nodeId: string, value: string): void {
  nodes.value = nodes.value.map((node) => {
    if (node.id !== nodeId)
      return node
    return {
      ...node,
      data: {
        ...node.data,
        title: value,
      },
    }
  })

  syncEditorFromGraph()
}

function updateNodeAction(nodeId: string, actionId: string): void {
  nodes.value = nodes.value.map((node) => {
    if (node.id !== nodeId || node.data.variant !== 'action' || node.data.stepKind === 'runtime')
      return node

    const actionBlock = getPaletteBlock(node.data.blockId)
    const currentAction = getActionOption(node.data.actionId)
    const nextAction = getActionOption(actionId)

    const shouldReplaceTitle = !node.data.title.trim()
      || node.data.title === currentAction?.title
      || node.data.title === actionBlock?.title

    return {
      ...node,
      data: {
        ...node.data,
        actionId: nextAction?.id ?? null,
        queryId: null,
        runtimeId: node.data.runtimeId,
        title: shouldReplaceTitle
          ? (nextAction?.title ?? actionBlock?.title ?? node.data.title)
          : node.data.title,
        description: nextAction?.description ?? '',
        params: {},
      },
    }
  })

  syncEditorFromGraph()
}

function updateNodeQuery(nodeId: string, queryId: string): void {
  nodes.value = nodes.value.map((node) => {
    if (node.id !== nodeId || node.data.variant !== 'query')
      return node

    const queryBlock = getPaletteBlock(node.data.blockId)
    const currentQuery = getQueryOption(node.data.queryId)
    const nextQuery = getQueryOption(queryId)

    const shouldReplaceTitle = !node.data.title.trim()
      || node.data.title === currentQuery?.title
      || node.data.title === queryBlock?.title

    return {
      ...node,
      data: {
        ...node.data,
        actionId: null,
        queryId: nextQuery?.id ?? null,
        runtimeId: node.data.runtimeId,
        title: shouldReplaceTitle
          ? (nextQuery?.title ?? queryBlock?.title ?? node.data.title)
          : node.data.title,
        description: nextQuery?.description ?? '',
        params: {},
      },
    }
  })

  syncEditorFromGraph()
}

function updateNodeRuntimeId(nodeId: string, value: string): void {
  const runtimeId = value.trim()

  nodes.value = nodes.value.map((node) => {
    if (String(node.id) !== nodeId || node.data.stepKind !== 'runtime')
      return node

    return {
      ...node,
      data: {
        ...node.data,
        runtimeId,
      },
    }
  })

  syncEditorFromGraph()
}

function updateOutputPortLabel(nodeId: string, portId: string, label: string): void {
  nodes.value = nodes.value.map((node) => {
    if (String(node.id) !== nodeId)
      return node

    return {
      ...node,
      data: {
        ...node.data,
        outputPorts: node.data.outputPorts.map(port =>
          port.id === portId
            ? { ...port, label }
            : port,
        ),
      },
    }
  })

  syncEditorFromGraph()
}

function addOutputPort(nodeId: string): void {
  nodes.value = nodes.value.map((node) => {
    if (String(node.id) !== nodeId || node.data.blockKind !== 'control')
      return node

    const nextIndex = node.data.outputPorts.length + 1
    const nextPort = createPort(`out-${nextIndex}`, createExtraPortLabel(node.data.variant, nextIndex))
    const nextPorts = node.data.variant === 'switch'
      ? [...node.data.outputPorts.slice(0, -1), nextPort, node.data.outputPorts[node.data.outputPorts.length - 1]]
      : [...node.data.outputPorts, nextPort]

    return {
      ...node,
      data: {
        ...node.data,
        outputPorts: nextPorts,
      },
    }
  })

  syncEditorFromGraph()
}

function onActionChange(nodeId: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  if (!target)
    return
  updateNodeAction(nodeId, target.value)
}

function onQueryChange(nodeId: string, value: string | null): void {
  updateNodeQuery(nodeId, String(value ?? ''))
}

function onNodeClick(node: Node<FlowNodeData>): void {
  selectedNodeId.value = String(node.id)
  selectedEdgeId.value = ''
  bottomPanelTab.value = 'block'
  closeNodeContextMenu()
}

function onPaneClick(): void {
  editingTitleNodeId.value = ''
  closeNodeContextMenu()
}

function onConnect(connection: Connection): void {
  const source = connection.source ? String(connection.source) : ''
  const target = connection.target ? String(connection.target) : ''
  const sourceHandle = connection.sourceHandle ? String(connection.sourceHandle) : 'out'
  const targetHandle = connection.targetHandle ? String(connection.targetHandle) : 'in'

  if (!source || !target || source === target || hasEdge(source, target, sourceHandle, targetHandle))
    return

  replaceOutgoingEdge(source, target, sourceHandle, targetHandle)
  selectedEdgeId.value = ''
}

function onEdgeUpdate({ edge, connection }: { edge: Edge, connection: Connection }): void {
  const source = connection.source ? String(connection.source) : ''
  const target = connection.target ? String(connection.target) : ''
  const sourceHandle = connection.sourceHandle ? String(connection.sourceHandle) : 'out'
  const targetHandle = connection.targetHandle ? String(connection.targetHandle) : 'in'

  if (!source || !target || source === target || hasEdge(source, target, sourceHandle, targetHandle, edge.id))
    return

  replaceOutgoingEdge(source, target, sourceHandle, targetHandle, edge.id)
  selectedEdgeId.value = edge.id
}

function onEdgeClick({ edge }: { edge: Edge }): void {
  selectedEdgeId.value = edge.id
  selectedNodeId.value = ''
  closeNodeContextMenu()
}

function removeEdgeById(edgeId: string): void {
  edges.value = edges.value.filter(edge => edge.id !== edgeId)
  if (selectedEdgeId.value === edgeId)
    selectedEdgeId.value = ''
  syncEditorFromGraph()
}

function reverseEdge(edgeId: string): void {
  const targetEdge = edges.value.find(edge => edge.id === edgeId)
  if (!targetEdge)
    return

  const nextSource = String(targetEdge.target)
  const nextTarget = String(targetEdge.source)
  const nextSourceNode = nodes.value.find(node => String(node.id) === nextSource)
  const nextSourceHandle = nextSourceNode?.data.outputPorts[0]?.id ?? 'out'
  const nextTargetHandle = 'in'

  if (nextSource === nextTarget || hasEdge(nextSource, nextTarget, nextSourceHandle, nextTargetHandle, edgeId))
    return

  replaceOutgoingEdge(nextSource, nextTarget, nextSourceHandle, nextTargetHandle, edgeId)
  selectedEdgeId.value = edgeId
}

function getEdgePath(edge: EdgeProps): { path: string, labelX: number, labelY: number } {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    sourcePosition: edge.sourcePosition,
    targetX: edge.targetX,
    targetY: edge.targetY,
    targetPosition: edge.targetPosition,
  })

  return { path, labelX, labelY }
}

function getControlSummary(variant: PlaygroundNodeVariant): string {
  if (variant === 'switch')
    return 'Проверка условий с выходом иначе'
  if (variant === 'watch')
    return 'Подписка на изменения по путям данных'
  if (variant === 'eventSubscribe')
    return 'Подписка на события и системные сигналы'
  if (variant === 'delay')
    return 'Пауза перед продолжением потока'
  if (variant === 'timer' || variant === 'intervalTimer')
    return 'Запуск по таймеру'
  if (variant === 'forEach')
    return 'Итерация по набору данных'
  if (variant === 'while')
    return 'Повторение, пока условие истинно'
  if (variant === 'parallel')
    return 'Параллельное разделение на ветки'
  return ''
}

function getNodeMinHeight(nodeData: FlowNodeData): string {
  const baseHeight = 120
  const extraPorts = Math.max(0, nodeData.outputPorts.length - 2)
  const extraHeight = extraPorts * 34

  return `${baseHeight + extraHeight}px`
}

function getNodeWidth(nodeData: FlowNodeData): string {
  const titleLength = nodeData.title.trim().length
  const minWidth = 340
  const maxWidth = 440
  const computedWidth = 248 + titleLength * 7

  return `${Math.max(minWidth, Math.min(maxWidth, computedWidth))}px`
}

function autoLayout(): void {
  const entryId = 'flow-entry'
  const widenedHorizontalGap = 460
  const verticalGap = 248
  const entryPosition = { x: 40, y: 180 }
  const firstColumnX = 300

  const incomingByTarget = new Map<string, string[]>()

  for (const edge of edges.value) {
    const target = String(edge.target)
    const source = String(edge.source)
    incomingByTarget.set(target, [...(incomingByTarget.get(target) ?? []), source])
  }

  const memo = new Map<string, number>([[entryId, 0]])
  const visiting = new Set<string>()

  function resolveLevel(nodeId: string): number {
    if (memo.has(nodeId))
      return memo.get(nodeId) ?? 1

    if (visiting.has(nodeId))
      return 1

    visiting.add(nodeId)

    const parents = (incomingByTarget.get(nodeId) ?? []).filter(parentId => parentId !== nodeId)
    const level = parents.length > 0
      ? Math.max(...parents.map(parentId => parentId === entryId ? 1 : resolveLevel(parentId) + 1))
      : 1

    visiting.delete(nodeId)
    memo.set(nodeId, level)

    return level
  }

  const grouped = new Map<number, Node<FlowNodeData>[]>()

  for (const node of nodes.value) {
    const nodeId = String(node.id)
    if (nodeId === entryId)
      continue

    const level = resolveLevel(nodeId)
    grouped.set(level, [...(grouped.get(level) ?? []), node])
  }

  const nextNodes = nodes.value.map((node) => {
    if (String(node.id) === entryId) {
      return {
        ...node,
        position: entryPosition,
      }
    }

    return { ...node }
  })

  for (const [level, group] of grouped.entries()) {
    const sorted = [...group].sort((a, b) => {
      const ay = a.position?.y ?? 0
      const by = b.position?.y ?? 0
      return ay - by
    })

    const totalHeight = Math.max(0, (sorted.length - 1) * verticalGap)
    const startY = Math.max(48, entryPosition.y - totalHeight / 2)

    sorted.forEach((node, index) => {
      const targetNode = nextNodes.find(item => String(item.id) === String(node.id))
      if (!targetNode)
        return

      targetNode.position = {
        x: firstColumnX + (level - 1) * widenedHorizontalGap,
        y: startY + index * verticalGap,
      }
    })
  }

  nodes.value = nextNodes
}

function onNodeContextMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape')
    closeNodeContextMenu()
}

function onExecutionStepStart(event: ActionRuntimeEvents['step:start']): void {
  const stepId = String(event?.stepId ?? '').trim()
  if (!stepId) {
    executingNodeId.value = ''
    executionContextTick.value += 1
    return
  }

  executingNodeId.value = nodes.value.some(node => String(node.id) === stepId)
    ? stepId
    : ''
  executionContextTick.value += 1
}

function clearExecutingNode(stepId: string | null | undefined): void {
  const id = String(stepId ?? '').trim()
  if (!id || executingNodeId.value === id)
    executingNodeId.value = ''
  executionContextTick.value += 1
}

function onExecutionStepSuccess(event: ActionRuntimeEvents['step:success']): void {
  clearExecutingNode(event?.stepId)
}

function onExecutionStepError(event: ActionRuntimeEvents['step:error']): void {
  clearExecutingNode(event?.stepId)
}

function detachExecutionRuntime(): void {
  const runtimeId = executionRuntimeId.value
  if (!runtimeId) {
    executingNodeId.value = ''
    return
  }

  const runtime = Endge.runtime.getRuntimeById(runtimeId)
  if (runtime && runtime.kind === 'action') {
    const actionRuntime = runtime as RuntimeHost<'action'>
    actionRuntime.off('step:start', onExecutionStepStart)
    actionRuntime.off('step:success', onExecutionStepSuccess)
    actionRuntime.off('step:error', onExecutionStepError)
  }

  Endge.runtime.destroyRuntime(runtimeId)
  executionRuntimeId.value = null
  executingNodeId.value = ''
}

function attachExecutionRuntime(action: RAction): RuntimeHost<'action'> | null {
  detachExecutionRuntime()

  const runtime = Endge.runtime.execute(action, {})
  if (!runtime || runtime.kind !== 'action')
    return null

  const actionRuntime = runtime as RuntimeHost<'action'>
  actionRuntime.on('step:start', onExecutionStepStart)
  actionRuntime.on('step:success', onExecutionStepSuccess)
  actionRuntime.on('step:error', onExecutionStepError)

  executionRuntimeId.value = actionRuntime.id
  return actionRuntime
}

watch(nodeContextMenu, (value) => {
  if (value) {
    document.addEventListener('keydown', onNodeContextMenuKeydown)
  }
  else {
    document.removeEventListener('keydown', onNodeContextMenuKeydown)
  }
}, { flush: 'sync' })

async function runWholeFlow(): Promise<void> {
  const action = createTemporaryDomainAction()
  const runtime = attachExecutionRuntime(action)
  if (!runtime)
    return

  await Endge.runtime.flow.run(runtime)
  executionContextTick.value += 1
  bottomPanelTab.value = 'context'
}

async function runSelectedNode(): Promise<void> {
  const nodeId = selectedStepNode.value?.id != null ? String(selectedStepNode.value.id) : ''
  if (!nodeId)
    return

  const action = createTemporaryDomainAction()
  const runtime = attachExecutionRuntime(action)
  if (!runtime)
    return

  await Endge.runtime.flow.runBlock(runtime, nodeId)
  executionContextTick.value += 1
  bottomPanelTab.value = 'context'
}

async function runNextNode(): Promise<void> {
  const nodeId = nextStepNodeId.value
  if (!nodeId)
    return

  selectedNodeId.value = nodeId
  selectedEdgeId.value = ''
  bottomPanelTab.value = 'block'
  const action = createTemporaryDomainAction()
  const runtime = attachExecutionRuntime(action)
  if (!runtime)
    return

  await Endge.runtime.flow.runBlock(runtime, nodeId)
  executionContextTick.value += 1
  bottomPanelTab.value = 'context'
}

function expandAllContextTree(): void {
  contextTreeRef.value?.expandAll()
}

function collapseAllContextTree(): void {
  contextTreeRef.value?.collapseAll()
}

function createTemporaryDomainAction(): RAction {
  const action = new RAction()
  model.value.updateSource(action)

  action.id = temporaryRuntimeActionId
  action.identity = temporaryRuntimeActionIdentity
  action.name = action.displayName ?? action.name ?? 'Temporary Action'
  action.displayName = action.displayName ?? action.name
  action.isTemporary = true

  Endge.domain.removeActionByIdentity(temporaryRuntimeActionIdentity)
  Endge.domain.addAction(action)
  action.compile()

  return action
}

onBeforeUnmount(() => {
  if (handleWindowResize) {
    window.removeEventListener('resize', handleWindowResize)
    handleWindowResize = null
  }

  detachExecutionRuntime()
  Endge.domain.removeActionByIdentity(temporaryRuntimeActionIdentity)
  document.removeEventListener('keydown', onNodeContextMenuKeydown)
})

function onPaletteDragStart(event: DragEvent, block: PlaygroundPaletteBlock): void {
  if (!event.dataTransfer)
    return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/endge-playground-block', JSON.stringify(block))
}

function onCanvasDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'copy'
  isCanvasDragOver.value = true
}

function onCanvasDragLeave(): void {
  isCanvasDragOver.value = false
}

function onCanvasDrop(event: DragEvent): void {
  event.preventDefault()
  isCanvasDragOver.value = false

  if (!flowCanvasRef.value)
    return

  const rect = flowCanvasRef.value.getBoundingClientRect()
  const position = {
    x: Math.max(24, event.clientX - rect.left - 120),
    y: Math.max(24, event.clientY - rect.top - 40),
  }
  const domainRaw = event.dataTransfer?.getData(DOMAIN_ENTITY_MIME)

  if (domainRaw) {
    try {
      const payload = JSON.parse(domainRaw) as DomainDraggedEntity[]
      const draggedAction = payload.find(item => item.sectionType === DomainSectionType.Action)
      const actionOption = draggedAction ? getActionOptionByDraggedEntity(draggedAction) : undefined
      const actionBlock = getPrimaryActionBlock()
      const draggedQuery = payload.find(item => item.sectionType === DomainSectionType.Query)
      const queryOption = draggedQuery ? getQueryOptionByDraggedEntity(draggedQuery) : undefined
      const queryBlock = getPrimaryQueryBlock()

      if (draggedAction && actionOption && actionBlock) {
        addNodeFromResolvedBlock(actionBlock, position, {
          initialActionId: actionOption.id,
          initialTitle: actionOption.title,
        })
        return
      }

      if (draggedQuery && queryOption && queryBlock) {
        addNodeFromResolvedBlock(queryBlock, position, {
          initialQueryId: queryOption.id,
          initialTitle: queryOption.title,
        })
        return
      }
    }
    catch {
      // noop
    }
  }

  const raw = event.dataTransfer?.getData('application/endge-playground-block')
  if (!raw)
    return

  let block: PlaygroundPaletteBlock | null = null
  try {
    block = JSON.parse(raw) as PlaygroundPaletteBlock
  }
  catch {
    block = null
  }

  if (!block)
    return

  if (block.id === `shortcut.${BUILTIN_ACTION_IDS.consoleLog}`) {
    const actionBlock = getPrimaryActionBlock()
    if (!actionBlock)
      return

    addNodeFromResolvedBlock(actionBlock, position, {
      initialActionId: BUILTIN_ACTION_IDS.consoleLog,
      initialTitle: 'Вывод в консоль',
    })
    return
  }

  addNodeFromResolvedBlock(block, position)
}

function onBottomPanelResizeStart(event: MouseEvent): void {
  event.preventDefault()
  isBottomPanelResizing.value = true

  const startY = event.clientY
  const startHeight = bottomPanelHeight.value

  function onMouseMove(moveEvent: MouseEvent): void {
    const delta = startY - moveEvent.clientY
    bottomPanelHeight.value = clampBottomPanelHeight(startHeight + delta)
  }

  function onMouseUp(): void {
    isBottomPanelResizing.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="flex h-full min-h-[720px] flex-1 flex-col gap-4"
    :class="isPaletteCollapsed
      ? 'xl:flex xl:flex-row xl:items-stretch'
      : 'xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch'"
  >
    <Card class="flex h-full min-h-[720px] min-w-0 w-full flex-col gap-0 overflow-hidden py-0" :class="{ 'xl:flex-1': isPaletteCollapsed }">
      <CardContent class="flex min-h-0 flex-1 p-0 w-full">
        <div ref="flowWorkspaceRef" class="flex h-full min-h-0 flex-col w-full">
          <div
            ref="flowCanvasRef"
            class="relative min-h-[96px] min-w-0 flex-1"
            @dragover="onCanvasDragOver"
            @dragleave="onCanvasDragLeave"
            @drop="onCanvasDrop"
          >
            <div
              class="absolute inset-0"
            >
              <VueFlow
                v-if="flowViewportReady"
                v-model:nodes="nodes"
                v-model:edges="edges"
                class="action-playgrounds-flow"
                :class="{ 'action-playgrounds-flow--dragover': isCanvasDragOver }"
                style="width: 100%; height: 100%;"
                :fit-view-on-init="true"
                :min-zoom="0.1"
                :max-zoom="1.4"
                :nodes-connectable="true"
                :edges-updatable="true"
                @node-click="(_, node) => onNodeClick(node as Node<FlowNodeData>)"
                @pane-click="onPaneClick"
                @connect="onConnect"
                @edge-update="onEdgeUpdate"
                @edge-click="onEdgeClick"
              >
                <Background
                  :gap="20"
                  :size="1"
                  pattern-color="rgba(56, 189, 248, 0.2)"
                />
                <Controls position="bottom-left" />

                <template #node-flowNode="nodeProps">
                  <div
                    class="action-playgrounds-node"
                    :class="[
                      `action-playgrounds-node--${nodeProps.data.variant}`,
                      {
                        'action-playgrounds-node--active': selectedNodeId === String(nodeProps.id),
                        'action-playgrounds-node--executing': executingNodeId === String(nodeProps.id),
                      },
                    ]"
                    :style="{
                      minHeight: getNodeMinHeight(nodeProps.data),
                      width: getNodeWidth(nodeProps.data),
                    }"
                    @click.stop="selectNode(String(nodeProps.id))"
                    @contextmenu="openNodeContextMenu($event, String(nodeProps.id))"
                  >
                    <Handle
                      v-if="nodeProps.data.inputPorts.length > 0"
                      :id="nodeProps.data.inputPorts[0]?.id ?? 'in'"
                      type="target"
                      :position="Position.Left"
                      class="action-playgrounds-node__handle action-playgrounds-node__handle--target"
                    />

                    <Handle
                      v-if="nodeProps.data.blockKind === 'action'"
                      :id="nodeProps.data.outputPorts[0]?.id ?? 'success'"
                      type="source"
                      :position="Position.Right"
                      class="action-playgrounds-node__handle action-playgrounds-node__handle--source action-playgrounds-node__handle--source-centered"
                    />

                    <TooltipProvider :delay-duration="120">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <button
                            type="button"
                            class="action-playgrounds-node__delete"
                            @click.stop="removeStepById(String(nodeProps.id))"
                          >
                            <Trash2 class="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Удалить блок
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <div class="action-playgrounds-node__top">
                      <div
                        class="action-playgrounds-node__variant-badge"
                        :class="getVariantBadgeMeta(nodeProps.data.variant).className"
                        :title="getVariantBadgeMeta(nodeProps.data.variant).label"
                        :aria-label="getVariantBadgeMeta(nodeProps.data.variant).label"
                      >
                        <component
                          :is="getVariantBadgeMeta(nodeProps.data.variant).icon"
                          class="size-3.5"
                        />
                      </div>

                      <div
                        v-if="editingTitleNodeId !== String(nodeProps.id)"
                        class="action-playgrounds-node__title-display"
                        @click.stop
                      >
                        {{ nodeProps.data.title }}
                      </div>

                      <input
                        v-else
                        :data-node-title-input="String(nodeProps.id)"
                        :value="nodeProps.data.title"
                        class="action-playgrounds-node__title"
                        type="text"
                        placeholder="Название блока"
                        @blur="finishTitleEdit(String(nodeProps.id))"
                        @keydown.enter.prevent="finishTitleEdit(String(nodeProps.id))"
                        @input="updateNodeTitle(String(nodeProps.id), ($event.target as HTMLInputElement).value)"
                      >
                    </div>

                    <div class="action-playgrounds-node__body">
                      <div class="action-playgrounds-node__main">
                        <template v-if="nodeProps.data.blockKind === 'action'">
                          <template v-if="nodeProps.data.stepKind === 'runtime'">
                            <div class="action-playgrounds-node__runtime-label">
                              Подключено кодом
                            </div>
                            <label class="action-playgrounds-node__runtime-id-label">
                              Runtime id
                            </label>
                            <input
                              :value="nodeProps.data.runtimeId ?? ''"
                              class="action-playgrounds-node__runtime-id"
                              type="text"
                              placeholder="runtime-id"
                              @input="updateNodeRuntimeId(String(nodeProps.id), ($event.target as HTMLInputElement).value)"
                            >
                          </template>

                          <template v-else-if="nodeProps.data.variant === 'query'">
                            <DomainEntityDropTarget
                              :accept-section-types="[DomainSectionType.Query]"
                              hint-text="Перетащите запрос сюда"
                              :show-hint="false"
                              @update:model-value="value => updateNodeQuery(String(nodeProps.id), String(value ?? ''))"
                            >
                              <SearchableSelect
                                :model-value="nodeProps.data.queryId"
                                :options="querySelectOptions"
                                placeholder="Выберите запрос"
                                trigger-class="w-full h-9"
                                @update:model-value="value => onQueryChange(String(nodeProps.id), value)"
                              />
                            </DomainEntityDropTarget>
                          </template>

                          <select
                            v-else
                            :value="nodeProps.data.actionId"
                            class="action-playgrounds-node__select"
                            @change="onActionChange(String(nodeProps.id), $event)"
                          >
                            <option value="">
                              Выберите действие
                            </option>
                            <option
                              v-for="action in actionOptions"
                              :key="action.id"
                              :value="action.id"
                            >
                              {{ action.title || action.id }}
                            </option>
                          </select>

                          <div v-if="nodeProps.data.description" class="action-playgrounds-node__description">
                            {{ nodeProps.data.description }}
                          </div>
                        </template>

                        <template v-else-if="nodeProps.data.variant === 'watch'">
                          <div class="action-playgrounds-control">
                            <div class="action-playgrounds-control__summary">
                              {{ normalizeWatchPaths(nodeProps.data.params.watchPaths).join(', ') || 'Пути не заданы' }}
                            </div>
                          </div>
                        </template>

                        <template v-else-if="nodeProps.data.variant === 'eventSubscribe'">
                          <div class="action-playgrounds-control">
                            <div class="action-playgrounds-control__summary">
                              {{ normalizeEventNames(nodeProps.data.params.eventNames).join(', ') || 'Ивенты не заданы' }}
                            </div>
                          </div>
                        </template>

                        <template v-else-if="nodeProps.data.variant === 'delay'">
                          <div class="action-playgrounds-control">
                            <div class="action-playgrounds-control__summary">
                              {{ nodeProps.data.params.delayMs != null && String(nodeProps.data.params.delayMs).trim() !== '' ? `${nodeProps.data.params.delayMs} мс` : 'Задержка не задана' }}
                            </div>
                          </div>
                        </template>

                        <template v-else-if="nodeProps.data.variant === 'switch'">
                          <div class="action-playgrounds-switch">
                            <div
                              v-for="port in nodeProps.data.outputPorts"
                              :key="`${nodeProps.id}-${port.id}-switch`"
                              class="action-playgrounds-switch__row"
                            >
                              <input
                                v-if="port.id !== nodeProps.data.outputPorts[nodeProps.data.outputPorts.length - 1]?.id"
                                :value="port.label"
                                class="action-playgrounds-switch__input"
                                type="text"
                                placeholder="Условие"
                                @input="updateOutputPortLabel(String(nodeProps.id), port.id, ($event.target as HTMLInputElement).value)"
                              >
                              <div
                                v-else
                                class="action-playgrounds-switch__else"
                              >
                                {{ port.label }}
                              </div>
                            </div>
                          </div>
                        </template>

                        <template v-else>
                          <div class="action-playgrounds-control">
                            <div class="action-playgrounds-control__summary">
                              {{ getControlSummary(nodeProps.data.variant) }}
                            </div>
                          </div>
                        </template>
                      </div>

                      <div class="action-playgrounds-node__ports">
                        <div
                          v-for="(port, index) in nodeProps.data.outputPorts"
                          :key="`${nodeProps.id}-${port.id}`"
                          class="action-playgrounds-node__port"
                          :class="{ 'action-playgrounds-node__port--centered': nodeProps.data.blockKind === 'action' }"
                        >
                          <span
                            v-if="port.label"
                            class="action-playgrounds-node__port-label"
                          >
                            {{ port.label }}
                          </span>
                          <Handle
                            v-if="nodeProps.data.blockKind !== 'action'"
                            :id="port.id"
                            type="source"
                            :position="Position.Right"
                            class="action-playgrounds-node__handle action-playgrounds-node__handle--source"
                            :style="getOutputHandleStyle(nodeProps.data, index)"
                          />
                        </div>

                        <button
                          v-if="nodeProps.data.blockKind === 'control'"
                          type="button"
                          class="action-playgrounds-node__port-add"
                          @click.stop="addOutputPort(String(nodeProps.id))"
                        >
                          <CirclePlus class="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </template>

                <template #node-entryNode="nodeProps">
                  <TooltipProvider :delay-duration="120">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div
                          class="action-playgrounds-entry"
                          :class="{ 'action-playgrounds-entry--active': selectedNodeId === String(nodeProps.id) }"
                          @click.stop="selectNode(String(nodeProps.id))"
                        >
                          <Handle
                            :id="nodeProps.data.outputPorts[0]?.id ?? 'out'"
                            type="source"
                            :position="Position.Right"
                            class="action-playgrounds-entry__handle"
                          />
                          <div class="action-playgrounds-entry__dot" />
                          <div class="action-playgrounds-entry__label">
                            {{ nodeProps.data.title }}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Начало исполнения
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </template>

                <template #edge-playground="edgeProps">
                  <BaseEdge
                    :path="getEdgePath(edgeProps).path"
                    :marker-end="edgeProps.markerEnd"
                    :style="edgeProps.style"
                    :interaction-width="edgeProps.interactionWidth"
                  />

                  <EdgeLabelRenderer>
                    <div
                      v-if="selectedEdgeId === edgeProps.id"
                      class="action-playgrounds-edge-toolbar nodrag nopan"
                      :style="{
                        transform: `translate(-50%, -50%) translate(${getEdgePath(edgeProps).labelX}px, ${getEdgePath(edgeProps).labelY}px)`,
                      }"
                    >
                      <TooltipProvider :delay-duration="120">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <button
                              type="button"
                              class="action-playgrounds-edge-toolbar__button"
                              @click.stop="reverseEdge(edgeProps.id)"
                            >
                              <RefreshCcw class="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Изменить направление
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger as-child>
                            <button
                              type="button"
                              class="action-playgrounds-edge-toolbar__button action-playgrounds-edge-toolbar__button--danger"
                              @click.stop="removeEdgeById(edgeProps.id)"
                            >
                              <Trash2 class="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Удалить связь
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </EdgeLabelRenderer>
                </template>
              </VueFlow>

              <div
                v-if="nodeContextMenu"
                class="action-playgrounds-node-context-menu-backdrop"
                @click="closeNodeContextMenu"
                @contextmenu.prevent="closeNodeContextMenu"
              />

              <div
                v-if="nodeContextMenu"
                class="action-playgrounds-node-context-menu"
                :style="nodeContextMenuStyle"
              >
                <button
                  type="button"
                  class="action-playgrounds-node-context-menu__item"
                  @click="renameNodeFromContextMenu"
                >
                  Переименовать
                </button>
                <button
                  type="button"
                  class="action-playgrounds-node-context-menu__item"
                  @click="runNodeFromContextMenu"
                >
                  Запустить с текущего
                </button>
                <button
                  type="button"
                  class="action-playgrounds-node-context-menu__item"
                  @click="nodeContextMenu?.nodeId && removeStepById(nodeContextMenu.nodeId)"
                >
                  Удалить блок
                </button>
              </div>
            </div>
          </div>

          <div
            class="action-playgrounds-bottom-panel__resize-handle"
            :class="{ 'action-playgrounds-bottom-panel__resize-handle--active': isBottomPanelResizing }"
            @mousedown="onBottomPanelResizeStart"
          />

          <EndgeFlowBottomPanel
            v-model="bottomPanelTab"
            :has-selected-block="hasSelectedBlock"
            :selected-step-label="selectedStepLabel"
            :height="bottomPanelHeight"
          >
            <template #header-actions>
              <TooltipProvider :delay-duration="120">
                <div class="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        class="size-8"
                        :disabled="!canRunSelectedNode"
                        @click="runSelectedNode"
                      >
                        <StepForward class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Выполнить выбранный блок
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        class="size-8"
                        :disabled="!canRunNextNode"
                        @click="runNextNode"
                      >
                        <ArrowRight class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Перейти к следующему шагу и выполнить его
                    </TooltipContent>
                  </Tooltip>

                  <div class="h-6 w-px bg-border/70" />

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        class="size-8"
                        :disabled="!canManageContextTree"
                        @click="collapseAllContextTree"
                      >
                        <ChevronsDownUp class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Свернуть весь контекст
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        class="size-8"
                        :disabled="!canManageContextTree"
                        @click="expandAllContextTree"
                      >
                        <ChevronsUpDown class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Развернуть весь контекст
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </template>

            <template #block>
              <div
                v-if="!selectedStepNode"
                class="action-playgrounds-bottom-panel__placeholder"
              >
                Блок не выбран.
              </div>

              <template v-else-if="selectedInputField">
                <template v-if="selectedInputField.isArray">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-xs text-muted-foreground">
                      Связь на сущность
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      @click="addSelectedInputArrayItem"
                    >
                      <CirclePlus class="mr-1 size-3.5" />
                      Добавить значение
                    </Button>
                  </div>

                  <div
                    v-if="normalizeArrayValue(getSelectedInputValue()).length === 0"
                    class="action-playgrounds-bottom-panel__placeholder"
                  >
                    Список пуст
                  </div>

                  <div
                    v-for="(item, index) in normalizeArrayValue(getSelectedInputValue())"
                    :key="`input-array-${index}`"
                    class="action-playgrounds-input-panel__array-row"
                  >
                    <div class="action-playgrounds-input-panel__array-row-header">
                      <div class="text-xs font-medium text-muted-foreground">
                        Цель {{ index + 1 }}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        class="size-7"
                        @click="removeSelectedInputArrayItem(index)"
                      >
                        <Trash2 class="size-3.5" />
                      </Button>
                    </div>

                    <template v-if="isReferenceInputField(selectedInputField)">
                      <DomainEntityDropTarget
                        :accept-section-types="selectedInputAcceptSectionTypes"
                        :hint-text="getReferenceHintText()"
                        @update:model-value="value => updateSelectedInputArrayItem(index, String(value))"
                      >
                        <SearchableSelect
                          :model-value="item != null ? String(item) : null"
                          :options="selectedInputReferenceOptions"
                          placeholder="Выберите сущность"
                          trigger-class="w-full h-9"
                          @update:model-value="value => updateSelectedInputArrayItem(index, value != null ? String(value) : null)"
                        />
                      </DomainEntityDropTarget>
                    </template>

                    <template v-else-if="selectedInputIsBoolean">
                      <label class="action-playgrounds-input-panel__checkbox-row">
                        <input
                          :checked="item === true"
                          type="checkbox"
                          @change="updateSelectedInputArrayItem(index, ($event.target as HTMLInputElement).checked)"
                        >
                        <span>Включено</span>
                      </label>
                    </template>

                    <template v-else-if="selectedInputIsNumber">
                      <Input
                        :model-value="item == null ? '' : String(item)"
                        placeholder="Введите число"
                        type="number"
                        @update:model-value="value => updateSelectedInputArrayItem(index, value === '' ? null : Number(value))"
                      />
                    </template>

                    <template v-else-if="selectedInputIsStringLike">
                      <div class="relative">
                        <Input
                          :model-value="item == null ? '' : String(item)"
                          placeholder="Введите значение"
                          @update:model-value="value => updateSelectedInputArrayItem(index, String(value ?? ''))"
                          @input="event => onAutocompleteInput(event, getAutocompleteKey(`array-${index}`))"
                          @keydown="event => onAutocompleteKeydown(event, getAutocompleteKey(`array-${index}`), () => String(item ?? ''), nextValue => updateSelectedInputArrayItem(index, nextValue))"
                          @focus="event => onAutocompleteInput(event, getAutocompleteKey(`array-${index}`))"
                          @blur="closeAutocomplete"
                        />
                        <div
                          v-if="autocompleteState.open && autocompleteState.activeKey === getAutocompleteKey(`array-${index}`)"
                          class="fixed z-[230] overflow-auto rounded-md border bg-popover p-1 text-sm shadow-lg"
                          :style="autocompleteMenuStyle"
                        >
                          <div class="px-2 py-1 text-[11px] text-muted-foreground">
                            Контекст
                          </div>
                          <button
                            v-for="(itemValue, itemIndex) in autocompleteState.items"
                            :key="`ctx-${itemValue}`"
                            type="button"
                            class="flex w-full items-center rounded px-2 py-1 text-left hover:bg-accent"
                            :class="{ 'bg-accent': itemIndex === autocompleteState.index }"
                            @mouseenter="autocompleteState.index = itemIndex"
                            @mousedown.prevent="applyAutocompleteSelectionAt(itemIndex, getAutocompleteKey(`array-${index}`), () => String(item ?? ''), nextValue => updateSelectedInputArrayItem(index, nextValue))"
                          >
                            {{ itemValue }}
                          </button>
                          <div
                            v-if="autocompleteState.items.length === 0"
                            class="px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            Контекст пока не сформирован
                          </div>
                        </div>
                      </div>
                    </template>

                    <template v-else>
                      <div class="action-playgrounds-bottom-panel__placeholder">
                        Для этого типа пока доступен только JSON-предпросмотр значения.
                      </div>
                    </template>
                  </div>
                </template>

                <template v-else>
                  <template v-if="isReferenceInputField(selectedInputField)">
                    <div class="text-xs text-muted-foreground">
                      Связь на сущность
                    </div>
                    <DomainEntityDropTarget
                      :accept-section-types="selectedInputAcceptSectionTypes"
                      :hint-text="getReferenceHintText()"
                      @update:model-value="value => updateSelectedInputValue(String(value))"
                    >
                      <SearchableSelect
                        :model-value="getSelectedInputValue() != null ? String(getSelectedInputValue()) : null"
                        :options="selectedInputReferenceOptions"
                        placeholder="Выберите сущность"
                        trigger-class="w-full h-9"
                        @update:model-value="value => updateSelectedInputValue(value != null ? String(value) : null)"
                      />
                    </DomainEntityDropTarget>
                  </template>

                  <template v-else-if="selectedInputIsBoolean">
                    <div class="text-xs text-muted-foreground">
                      Прямое значение
                    </div>
                    <label class="action-playgrounds-input-panel__checkbox-row">
                      <input
                        :checked="getSelectedInputValue() === true"
                        type="checkbox"
                        @change="updateSelectedInputValue(($event.target as HTMLInputElement).checked)"
                      >
                      <span>Включено</span>
                    </label>
                  </template>

                  <template v-else-if="selectedInputIsNumber">
                    <div class="text-xs text-muted-foreground">
                      Прямое значение
                    </div>
                    <Input
                      :model-value="normalizeScalarValue(getSelectedInputValue())"
                      placeholder="Введите число"
                      type="number"
                      @update:model-value="value => updateSelectedInputValue(value === '' ? null : Number(value))"
                    />
                  </template>

                  <template v-else-if="selectedInputIsStringLike">
                    <div class="text-xs text-muted-foreground">
                      Прямое значение
                    </div>
                    <div class="relative">
                      <Input
                        :model-value="normalizeScalarValue(getSelectedInputValue())"
                        placeholder="Введите значение"
                        @update:model-value="value => updateSelectedInputValue(String(value ?? ''))"
                        @input="event => onAutocompleteInput(event, getAutocompleteKey('scalar'))"
                        @keydown="event => onAutocompleteKeydown(event, getAutocompleteKey('scalar'), () => normalizeScalarValue(getSelectedInputValue()), nextValue => updateSelectedInputValue(nextValue))"
                        @focus="event => onAutocompleteInput(event, getAutocompleteKey('scalar'))"
                        @blur="closeAutocomplete"
                      />
                      <div
                        v-if="autocompleteState.open && autocompleteState.activeKey === getAutocompleteKey('scalar')"
                        class="fixed z-[230] overflow-auto rounded-md border bg-popover p-1 text-sm shadow-lg"
                        :style="autocompleteMenuStyle"
                      >
                        <div class="px-2 py-1 text-[11px] text-muted-foreground">
                          Контекст
                        </div>
                        <button
                          v-for="(itemValue, itemIndex) in autocompleteState.items"
                          :key="`ctx-${itemValue}`"
                          type="button"
                          class="flex w-full items-center rounded px-2 py-1 text-left hover:bg-accent"
                          :class="{ 'bg-accent': itemIndex === autocompleteState.index }"
                          @mouseenter="autocompleteState.index = itemIndex"
                          @mousedown.prevent="applyAutocompleteSelectionAt(itemIndex, getAutocompleteKey('scalar'), () => normalizeScalarValue(getSelectedInputValue()), nextValue => updateSelectedInputValue(nextValue))"
                        >
                          {{ itemValue }}
                        </button>
                        <div
                          v-if="autocompleteState.items.length === 0"
                          class="px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          Контекст пока не сформирован
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="action-playgrounds-bottom-panel__placeholder">
                      Для этого типа пока доступен только JSON-предпросмотр значения.
                    </div>
                  </template>
                </template>
              </template>

              <div
                v-else-if="selectedStepNode?.data.variant === 'watch'"
                class="space-y-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs text-muted-foreground">
                    Пути подписки
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    @click="addSelectedWatchPath"
                  >
                    <CirclePlus class="mr-1 size-3.5" />
                    Добавить значение
                  </Button>
                </div>

                <div
                  v-if="getSelectedWatchPaths().length === 0"
                  class="action-playgrounds-bottom-panel__placeholder"
                >
                  Пути не заданы
                </div>

                <div
                  v-for="(path, index) in getSelectedWatchPaths()"
                  :key="`watch-path-${index}`"
                  class="action-playgrounds-input-panel__array-row"
                >
                  <div class="action-playgrounds-input-panel__array-row-header">
                    <div class="text-xs font-medium text-muted-foreground">
                      Цель {{ index + 1 }}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      @click="removeSelectedWatchPath(index)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>

                  <Input
                    :model-value="path"
                    placeholder="store.users[*]"
                    @update:model-value="value => updateSelectedWatchPath(index, String(value ?? ''))"
                  />
                </div>
              </div>

              <div
                v-else-if="selectedStepNode?.data.variant === 'eventSubscribe'"
                class="space-y-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs text-muted-foreground">
                    Системные ивенты
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    @click="addSelectedEventName"
                  >
                    <CirclePlus class="mr-1 size-3.5" />
                    Добавить значение
                  </Button>
                </div>

                <div
                  v-if="getSelectedEventNames().length === 0"
                  class="action-playgrounds-bottom-panel__placeholder"
                >
                  Ивенты не заданы
                </div>

                <div
                  v-for="(eventName, index) in getSelectedEventNames()"
                  :key="`event-name-${index}`"
                  class="action-playgrounds-input-panel__array-row"
                >
                  <div class="action-playgrounds-input-panel__array-row-header">
                    <div class="text-xs font-medium text-muted-foreground">
                      Цель {{ index + 1 }}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      @click="removeSelectedEventName(index)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>

                  <Input
                    :model-value="eventName"
                    placeholder="app:data:changed"
                    @update:model-value="value => updateSelectedEventName(index, String(value ?? ''))"
                  />
                </div>
              </div>

              <div
                v-else-if="selectedStepNode?.data.variant === 'delay'"
                class="space-y-3"
              >
                <div class="text-xs text-muted-foreground">
                  Задержка, мс
                </div>
                <Input
                  :model-value="getSelectedDelayMs()"
                  placeholder="1000"
                  type="number"
                  @update:model-value="value => updateSelectedDelayMs(String(value ?? ''))"
                />
              </div>

              <div
                v-else-if="selectedStepNode?.data.variant === 'switch'"
                class="space-y-3"
              >
                <div class="text-xs font-medium text-muted-foreground">
                  Режим условия
                </div>
                <div class="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    :variant="getSwitchConditionMode() === 'script' ? 'default' : 'outline'"
                    @click="setSwitchConditionMode('script')"
                  >
                    Скрипт
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    :variant="getSwitchConditionMode() === 'registry' ? 'default' : 'outline'"
                    @click="setSwitchConditionMode('registry')"
                  >
                    Готовые условия
                  </Button>
                </div>

                <template v-if="getSwitchConditionMode() === 'script'">
                  <div class="text-xs text-muted-foreground">
                    Выражение (доступен контекст <code>ctx</code>)
                  </div>
                  <div class="relative">
                    <Input
                      :model-value="getSwitchScriptExpression()"
                      placeholder="{ctx.input.key} или true"
                      class="font-mono text-xs"
                      @update:model-value="setSwitchScriptExpression"
                      @input="event => onAutocompleteInput(event, getAutocompleteKey('switch-script'))"
                      @keydown="event => onAutocompleteKeydown(event, getAutocompleteKey('switch-script'), getSwitchScriptExpression, setSwitchScriptExpression)"
                      @focus="event => onAutocompleteInput(event, getAutocompleteKey('switch-script'))"
                      @blur="closeAutocomplete"
                    />
                    <div
                      v-if="autocompleteState.open && autocompleteState.activeKey === getAutocompleteKey('switch-script')"
                      class="fixed z-[230] overflow-auto rounded-md border bg-popover p-1 text-sm shadow-lg"
                      :style="autocompleteMenuStyle"
                    >
                      <div class="px-2 py-1 text-[11px] text-muted-foreground">
                        Контекст
                      </div>
                      <button
                        v-for="(itemValue, itemIndex) in autocompleteState.items"
                        :key="`ctx-sw-${itemValue}`"
                        type="button"
                        class="flex w-full items-center rounded px-2 py-1 text-left hover:bg-accent font-mono text-xs"
                        :class="{ 'bg-accent': itemIndex === autocompleteState.index }"
                        @mouseenter="autocompleteState.index = itemIndex"
                        @mousedown.prevent="applyAutocompleteSelectionAt(itemIndex, getAutocompleteKey('switch-script'), getSwitchScriptExpression, setSwitchScriptExpression)"
                      >
                        {{ itemValue }}
                      </button>
                      <div
                        v-if="autocompleteState.items.length === 0"
                        class="px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        Контекст пока не сформирован
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="text-xs text-muted-foreground">
                    Ветки (первая выполненная условие выбирает порт)
                  </div>
                  <div
                    v-for="(branch, branchIdx) in getSwitchBranches()"
                    :key="`switch-branch-${branch.portId}-${branchIdx}`"
                    class="rounded-md border border-slate-200 bg-slate-50/80 p-3 space-y-2"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium text-slate-600">Ветка {{ branchIdx + 1 }}</span>
                      <SearchableSelect
                        :model-value="branch.conditionId || null"
                        :options="flowRegistryConditions.map(c => ({ value: c.id, label: c.title }))"
                        placeholder="Выберите условие"
                        trigger-class="flex-1 min-w-0 h-8 text-xs"
                        @update:model-value="v => updateSwitchBranchCondition(branchIdx, v ?? '')"
                      />
                    </div>
                    <template v-if="branch.conditionId">
                      <template
                        v-for="param in (flowRegistryConditions.find(c => c.id === branch.conditionId)?.inputParams ?? [])"
                        :key="param.name"
                      >
                        <div
                          v-if="param.acceptSectionTypes?.includes(DomainSectionType.Vocabs)"
                          class="space-y-1"
                        >
                          <div class="text-[11px] text-muted-foreground">
                            {{ param.label }}
                          </div>
                          <DomainEntityDropTarget
                            :accept-section-types="[DomainSectionType.Vocabs]"
                            hint-text="Перетащите словарь сюда"
                            @update:model-value="v => updateSwitchBranchParam(branchIdx, param.name, v != null ? String(v) : null)"
                          >
                            <SearchableSelect
                              :model-value="branch.params[param.name] != null ? String(branch.params[param.name]) : null"
                              :options="vocabOptionsForSwitch"
                              placeholder="Выберите словарь"
                              trigger-class="w-full h-8 text-xs"
                              @update:model-value="v => updateSwitchBranchParam(branchIdx, param.name, v != null ? String(v) : null)"
                            />
                          </DomainEntityDropTarget>
                        </div>
                        <div
                          v-else
                          class="space-y-1"
                        >
                          <div class="text-[11px] text-muted-foreground">
                            {{ param.label }}
                          </div>
                          <Input
                            :model-value="branch.params[param.name] != null ? String(branch.params[param.name]) : ''"
                            class="h-8 text-xs"
                            @update:model-value="v => updateSwitchBranchParam(branchIdx, param.name, v ?? '')"
                          />
                        </div>
                      </template>
                    </template>
                  </div>
                </template>
              </div>

              <div
                v-else
                class="action-playgrounds-bottom-panel__placeholder"
              >
                У выбранного блока нет настраиваемых входных параметров.
              </div>
            </template>

            <template #context>
              <EndgeFlowContextTree
                ref="contextTreeRef"
                :state="currentExecutionState"
              />
            </template>
          </EndgeFlowBottomPanel>
        </div>
      </CardContent>
    </Card>

    <EndgeFlowPalette
      :is-collapsed="isPaletteCollapsed"
      :sections="paletteSections"
      :can-run-selected-node="canRunSelectedNode"
      :can-run-next-node="canRunNextNode"
      :get-variant-badge-meta="getVariantBadgeMeta"
      @toggle-collapsed="togglePaletteCollapsed"
      @run-whole-flow="runWholeFlow"
      @run-selected-node="runSelectedNode"
      @run-next-node="runNextNode"
      @auto-layout="autoLayout"
      @show-payload="showGeneratedCode = true"
      @palette-drag-start="onPaletteDragStart"
    />

    <EndgeFlowPayloadDialog
      v-model:open="showGeneratedCode"
      :payload="generatedPayload"
    />
  </div>
  <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
</template>
