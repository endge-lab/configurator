<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'

import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MarkerType, Position, VueFlow } from '@vue-flow/core'
import { computed, ref } from 'vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'

interface DiagramMeta {
  title: string
  description: string
  kind: 'federation' | 'module'
}

interface ModuleSpec {
  title: string
  description: string
}

interface ArchitectureFlowSection {
  id: string
  title: string
  text: string[]
  nodes: Node[]
  edges: Edge[]
  minHeight?: number
}

interface FederationLayout {
  frameId: string
  frameTitle: string
  federationId: string
  frameY: number
  frameHeight: number
  modulesStartY: number
}

const federationMetaByNodeId: Record<string, DiagramMeta> = {
  'f-endge': {
    title: 'Федерация ENDGE',
    description: 'Статическая федерация ядра. Регистрирует core-модули через configureFederation и предоставляет единый API Endge.*.',
    kind: 'federation',
  },
  'f-endge-vue': {
    title: 'Федерация ENDGE VUE',
    description: 'Интеграционный слой @endge/ui-vue: привязка рендеров и реактивных фаз к ядру Endge.',
    kind: 'federation',
  },
  'f-appcore': {
    title: 'APPCORE',
    description: 'Прикладная точка запуска: создает boot context, инициализирует Endge и подключает EndgeVue.',
    kind: 'federation',
  },
}

const endgeModules: ModuleSpec[] = [
  { title: 'context', description: 'Текущий проект, среда и локаль.' },
  { title: 'diagnostics', description: 'Системная диагностика, мониторинг и structured records.' },
  { title: 'debug', description: 'Трассировка операций и диагностика.' },
  { title: 'domain', description: 'Доменная модель и CRUD сущностей.' },
  { title: 'vocabs', description: 'Загрузка словарей по namespace.' },
  { title: 'runtime', description: 'Выполнение runtime-фаз и вычислений.' },
  { title: 'vars', description: 'Переменные и интерполяции.' },
  { title: 'query', description: 'Единая точка запуска запросов.' },
  { title: 'auth', description: 'Авторизация и токены.' },
  { title: 'schema', description: 'Слой хранения схемы/документов.' },
  { title: 'flow', description: 'Движок исполнения действий.' },
  { title: 'updates', description: 'Обновления и синхронизация состояния.' },
  { title: 'events', description: 'Событийная шина.' },
  { title: 'sse', description: 'Server-Sent Events канал.' },
  { title: 'ui', description: 'UI-состояние и утилиты интерфейса.' },
  { title: 'bind', description: 'Программная подмена кода у converter/action/runtime step.' },
  { title: 'console', description: 'Команды dev-консоли.' },
  { title: 'runtimeDebugger', description: 'Инструменты runtime-debugger.' },
  { title: 'styles', description: 'Стили, CSS токены и применение style-документов.' },
]

const endgeVueModules: ModuleSpec[] = [
  { title: 'SFC adapter', description: 'Native Vue renderer adapter for ComponentSFC.' },
  { title: 'raph: watch phase', description: 'Фаза watch для синхронизации reactive ref с Raph.' },
]

const appCoreModules: ModuleSpec[] = [
  { title: 'boot: Endge', description: 'Запуск ядра через Endge.boot(ctx).' },
  { title: 'plugin: EndgeVue', description: 'Подключение слоя EndgeVue через Endge.use.' },
]

function createModuleNodes(
  prefix: string,
  modules: readonly ModuleSpec[],
  startX: number,
  startY: number,
  columns: number,
  metaByNodeId: Record<string, DiagramMeta>,
): Node[] {
  return modules.map((module, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const id = `${prefix}-${index}`
    metaByNodeId[id] = {
      title: module.title,
      description: module.description,
      kind: 'module',
    }
    return {
      id,
      type: 'module',
      position: { x: startX + col * 380, y: startY + row * 120 },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      data: { title: module.title },
    }
  })
}

const federationLayouts: FederationLayout[] = [
  {
    frameId: 'frame-endge',
    frameTitle: 'Федерация ENDGE',
    federationId: 'f-endge',
    frameY: 20,
    frameHeight: 1340,
    modulesStartY: 120,
  },
  {
    frameId: 'frame-endge-vue',
    frameTitle: 'Федерация ENDGE VUE',
    federationId: 'f-endge-vue',
    frameY: 1400,
    frameHeight: 620,
    modulesStartY: 1500,
  },
  {
    frameId: 'frame-appcore',
    frameTitle: 'APPCORE',
    federationId: 'f-appcore',
    frameY: 2060,
    frameHeight: 500,
    modulesStartY: 2160,
  },
]

const frameNodes: Node[] = federationLayouts.map(layout => ({
  id: layout.frameId,
  type: 'frame',
  draggable: false,
  selectable: false,
  position: { x: 24, y: layout.frameY },
  data: {
    title: layout.frameTitle,
    width: 1720,
    height: layout.frameHeight,
  },
}))

const federationNodes: Node[] = [
  {
    id: 'f-endge',
    type: 'federation',
    position: { x: 72, y: 130 },
    sourcePosition: Position.Bottom,
    data: { title: 'Федерация ENDGE', subtitle: 'Реестр модулей ядра (configureFederation)' },
  },
  {
    id: 'f-endge-vue',
    type: 'federation',
    position: { x: 72, y: 1510 },
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
    data: { title: 'ENDGE VUE PLUGIN', subtitle: 'EndgeVueModule перед runtime' },
  },
  {
    id: 'f-appcore',
    type: 'federation',
    position: { x: 72, y: 2170 },
    targetPosition: Position.Top,
    sourcePosition: Position.Right,
    data: { title: 'APPCORE', subtitle: 'Boot/integration orchestration' },
  },
]

const diagramMetaByNodeId: Record<string, DiagramMeta> = { ...federationMetaByNodeId }

const endgeModuleNodes = createModuleNodes('eng', endgeModules, 470, 120, 2, diagramMetaByNodeId)
const endgeVueModuleNodes = createModuleNodes('engvue', endgeVueModules, 470, 1500, 2, diagramMetaByNodeId)
const appCoreModuleNodes = createModuleNodes('appcore', appCoreModules, 470, 2160, 2, diagramMetaByNodeId)

const nodes = ref<Node[]>([
  ...frameNodes,
  ...federationNodes,
  ...endgeModuleNodes,
  ...endgeVueModuleNodes,
  ...appCoreModuleNodes,
])

const edges = ref<Edge[]>([
  {
    id: 'federation-link-endge-endge-vue',
    source: 'f-endge',
    target: 'f-endge-vue',
    markerEnd: MarkerType.ArrowClosed,
    label: 'ядро -> рендеринг и UI',
    animated: true,
  },
  {
    id: 'federation-link-endge-vue-appcore',
    source: 'f-endge-vue',
    target: 'f-appcore',
    markerEnd: MarkerType.ArrowClosed,
    label: 'UI runtime -> оркестрация',
    animated: true,
  },
  {
    id: 'cross-endge-render-to-vue-render',
    source: 'eng-7',
    target: 'engvue-0',
    markerEnd: MarkerType.ArrowClosed,
    label: 'render API',
  },
  {
    id: 'cross-endge-runtime-to-appcore-runtime',
    source: 'eng-10',
    target: 'appcore-4',
    markerEnd: MarkerType.ArrowClosed,
    label: 'runtime',
  },
  {
    id: 'cross-endge-domain-to-appcore-domain',
    source: 'eng-4',
    target: 'appcore-0',
    markerEnd: MarkerType.ArrowClosed,
    label: 'domain',
  },
])

const selectedNodeId = ref<string | null>(null)
const selectedMeta = computed<DiagramMeta | null>(() => {
  if (!selectedNodeId.value)
    return null
  return diagramMetaByNodeId[selectedNodeId.value] ?? null
})

const activeTab = useSmartTabSelection(
  'architecture.active-tab',
  'federation',
  ['federation', 'communication', 'events', 'dispatch', 'example', 'landscape', 'raph', 'nova'] as const,
)

function createFlowNode(
  id: string,
  title: string,
  subtitle: string,
  x: number,
  y: number,
  tone: 'source' | 'core' | 'config' | 'runtime' | 'action' = 'core',
): Node {
  return {
    id,
    type: 'process',
    position: { x, y },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { title, subtitle, tone },
  }
}

function createFlowFrame(
  id: string,
  title: string,
  width: number,
  height: number,
  x: number,
  y: number,
): Node {
  return {
    id,
    type: 'frame',
    draggable: false,
    selectable: false,
    position: { x, y },
    data: {
      title,
      width,
      height,
    },
  }
}

function createFlowEdge(
  id: string,
  source: string,
  target: string,
  label: string,
  animated = false,
): Edge {
  return {
    id,
    source,
    target,
    label,
    animated,
    markerEnd: MarkerType.ArrowClosed,
  }
}

const architectureSections: ArchitectureFlowSection[] = [
  {
    id: 'landscape',
    title: 'Жизненный цикл и карта сущностей',
    text: [
      'Проект является верхнеуровневым контейнером: в нём живут страницы, окружения, навигация и стили.',
      'Страница обычно собирается из нескольких источников: она может быть связана с шаблоном страницы, использовать навигацию и стили, а в областях напрямую размещать поддерживаемые компоненты.',
      'Runtime-граф Filter → Query → Component описывает Composition: orchestration без layout и rendering. Actions and the event bus remain independent runtime mechanisms.',
    ],
    nodes: [
      createFlowNode('behavior-actions', 'Действия', 'Поведенческая логика и сценарии', 680, 40, 'action'),
      createFlowNode('behavior-bus', 'Шина Endge.events', 'Транспорт runtime-событий и наблюдаемость', 1140, 40, 'runtime'),

      createFlowNode('project-root', 'Проект', 'Корневой контейнер конфигурации и поведения', 900, 230, 'core'),
      createFlowNode('page-template', 'Шаблон страницы', 'Структурная заготовка и layout области', 240, 430, 'config'),
      createFlowNode('navigation', 'Навигация', 'Связи переходов и меню проекта', 700, 430, 'config'),
      createFlowNode('styles', 'Стили', 'Токены, наборы стилей и оформление', 1160, 430, 'config'),
      createFlowNode('page', 'Страница', 'Конкретная точка входа и lifecycle страницы', 900, 650, 'source'),
      createFlowNode('composition', 'Composition', 'Runtime graph и orchestration', 1460, 900, 'core'),
      createFlowNode('component', 'Компонент', 'UI и визуальная композиция', 340, 1130, 'source'),
      createFlowNode('query', 'Запрос', 'Источник данных для runtime-графа', 900, 1130, 'source'),
      createFlowNode('filter', 'Фильтр', 'Предобработка и ограничения данных', 1460, 1130, 'source'),
      createFlowNode('runtime-user', 'Пользователь / Runtime', 'Источник взаимодействий и триггеров', 900, 1360, 'runtime'),
    ],
    edges: [
      createFlowEdge('ls-3', 'behavior-actions', 'behavior-bus', 'действия могут публиковать события'),
      createFlowEdge('ls-6', 'behavior-bus', 'runtime-user', 'runtime сообщения и наблюдаемость'),

      createFlowEdge('ls-7', 'project-root', 'page-template', 'использует шаблоны'),
      createFlowEdge('ls-8', 'project-root', 'navigation', 'хранит навигацию'),
      createFlowEdge('ls-9', 'project-root', 'styles', 'хранит стили'),
      createFlowEdge('ls-10', 'project-root', 'page', 'содержит страницы'),

      createFlowEdge('ls-11', 'page-template', 'page', 'структура / layout'),
      createFlowEdge('ls-12', 'navigation', 'page', 'маршрут / переход'),
      createFlowEdge('ls-13', 'styles', 'page', 'оформление'),
      createFlowEdge('ls-18', 'runtime-user', 'page', 'mounted / route / interactions'),
    ],
  },
  {
    id: 'raph',
    title: 'Как работает Raph',
    text: [
      'Raph — это реактивный граф и единый источник истины по данным. Runtime-сущности не должны хранить альтернативную копию состояния: они читают изменения из Raph и реагируют на них.',
      'Каждый runtime-host живёт на своей `RaphNode`, у которой есть `meta`, связи в графе и набор track-подписок на пути вроде `filters.<id>.<space>` или `${basePath}.*`.',
      'Когда данные меняются, Raph помечает узлы как dirty, прогоняет фазы и вызывает логику конкретного слоя: например, phase `queries` уведомляет query runtime, phase `tables` — table runtime.',
      'Уже после этого runtime-host испускает своё каноническое событие, а ядро может связать его с contracts, bindings, actions и глобальной шиной `Endge.events`.',
    ],
    nodes: [
      createFlowNode('raph-store', 'Raph data store', 'Реактивные данные и канонические пути', 80, 80, 'runtime'),
      createFlowNode('raph-change', 'Изменение данных', 'set / patch / update в Raph', 520, 80, 'runtime'),
      createFlowNode('raph-dirty', 'Dirty nodes', 'Raph помечает затронутые узлы', 980, 80, 'runtime'),
      createFlowNode('raph-node', 'RaphNode', 'Узел runtime-сущности с meta и track', 80, 320, 'core'),
      createFlowNode('raph-track', 'Track paths', 'Например: filters.* или basePath.*', 520, 320, 'core'),
      createFlowNode('raph-phases', 'Фазы Raph', 'tables / queries / другие phase handlers', 980, 320, 'core'),
      createFlowNode('raph-runtime', 'Runtime host', 'Query/Table/Action и далее Page', 1440, 320, 'source'),
      createFlowNode('raph-contract', 'Contracts + Bindings', 'Диспетчер ищет реакции на событие', 980, 560, 'config'),
      createFlowNode('raph-actions', 'Действия', 'Выполнение бизнес-логики', 1440, 560, 'action'),
      createFlowNode('raph-bus', 'Endge.events', 'Наблюдаемость и cross-module transport', 1440, 780, 'runtime'),
    ],
    edges: [
      createFlowEdge('rp-1', 'raph-store', 'raph-change', 'данные изменяются'),
      createFlowEdge('rp-2', 'raph-change', 'raph-dirty', 'Raph вычисляет dirty'),
      createFlowEdge('rp-3', 'raph-node', 'raph-track', 'узел подписан на пути'),
      createFlowEdge('rp-4', 'raph-track', 'raph-dirty', 'track связывает путь и узел'),
      createFlowEdge('rp-5', 'raph-dirty', 'raph-phases', 'dirty попадает в phases', true),
      createFlowEdge('rp-6', 'raph-phases', 'raph-runtime', 'phase уведомляет runtime host'),
      createFlowEdge('rp-7', 'raph-runtime', 'raph-contract', 'host испускает каноническое событие'),
      createFlowEdge('rp-8', 'raph-contract', 'raph-actions', 'resolver запускает действия'),
      createFlowEdge('rp-9', 'raph-runtime', 'raph-bus', 'опционально публикует runtime message'),
      createFlowEdge('rp-10', 'raph-actions', 'raph-bus', 'действие тоже может эмитить события'),
    ],
  },
  {
    id: 'nova',
    title: 'Как работает Nova',
    text: [
      'Nova - это canvas-движок с двумя путями работы: сценовый runtime (`NovaApp -> Surface -> Node`) и декларативный schema-путь (`NovaSchema`, JSX/DSL, table-model).',
      'Внутри сценового runtime Nova опирается на собственный фазовый граф: dirty-узлы проходят через фазы `preupdate -> update -> matrix -> render -> flush`, а слои (`Surface`) сначала рисуются в свои canvas, а затем композятся в основной canvas.',
      'События не живут в DOM-дереве компонентов. `NovaEvents` принимает события canvas/window, делает hit-test по interactive nodes с учётом матрицы трансформации и маршрутизирует их в нужные scene-узлы.',
      'В текущем приложении чаще используется именно декларативный schema/rendering path, но для понимания движка важно видеть обе ветки вместе: scene runtime и schema pipeline.',
    ],
    nodes: [
      createFlowNode('nova-ui', 'UI / Playground', 'Места, где Nova используется в приложении', 80, 80, 'source'),
      createFlowNode('nova-schema', 'NovaSchema / JSX / DSL', 'Декларативное описание canvas-примитивов', 620, 80, 'config'),
      createFlowNode('nova-runtime', 'NovaApp', 'Главный runtime-объект canvas-движка', 1180, 80, 'core'),
      createFlowNode('nova-events', 'NovaEvents', 'DOM events -> hit-test -> handlers', 1740, 80, 'runtime'),

      createFlowNode('nova-graph', 'RaphApp / NovaGraph', 'Dirty scheduler и фазовый граф Nova', 620, 360, 'core'),
      createFlowNode('nova-phases', 'Фазы Nova', 'preupdate -> update -> matrix -> render -> flush', 1180, 360, 'core'),
      createFlowNode('nova-scene', 'Scene Tree', 'root -> Surface -> Node', 1740, 360, 'source'),

      createFlowNode('nova-surface', 'NovaSurface', 'Отдельный слой с собственным canvas', 620, 660, 'source'),
      createFlowNode('nova-renderer', 'NovaRenderer2D / WebGL', 'Рисование примитивов и schema', 1180, 660, 'action'),
      createFlowNode('nova-flush', 'Flush в основной canvas', 'Композиция всех surfaces в один холст', 1740, 660, 'runtime'),
    ],
    edges: [
      createFlowEdge('nv-1', 'nova-ui', 'nova-schema', 'формирует schema'),
      createFlowEdge('nv-2', 'nova-ui', 'nova-runtime', 'или поднимает runtime NovaApp'),
      createFlowEdge('nv-3', 'nova-schema', 'nova-renderer', 'schema -> drawing commands'),
      createFlowEdge('nv-4', 'nova-runtime', 'nova-events', 'подключает input router'),
      createFlowEdge('nv-5', 'nova-runtime', 'nova-graph', 'создаёт граф и scheduler'),
      createFlowEdge('nv-6', 'nova-graph', 'nova-phases', 'грязные узлы проходят фазы', true),
      createFlowEdge('nv-7', 'nova-phases', 'nova-scene', 'обновляет scene nodes'),
      createFlowEdge('nv-8', 'nova-scene', 'nova-surface', 'узлы живут на surfaces'),
      createFlowEdge('nv-9', 'nova-surface', 'nova-renderer', 'surface рендерит содержимое'),
      createFlowEdge('nv-10', 'nova-renderer', 'nova-flush', 'готовые offscreen слои'),
      createFlowEdge('nv-11', 'nova-events', 'nova-scene', 'hover / drag / click маршрутизация'),
      createFlowEdge('nv-12', 'nova-surface', 'nova-flush', 'все слои собираются вместе'),
    ],
  },
]

function onNodeClick(payload: unknown, maybeNode?: Node): void {
  const nodeFromPayloadObject = (
    payload
    && typeof payload === 'object'
    && 'node' in payload
    && (payload as { node?: unknown }).node
  ) as Node | undefined

  const nodeFromPayloadDirect = (
    payload
    && typeof payload === 'object'
    && 'id' in payload
    ? payload
    : undefined
  ) as Node | undefined

  const nodeCandidate = maybeNode ?? nodeFromPayloadObject ?? nodeFromPayloadDirect

  const nodeId = nodeCandidate?.id != null ? String(nodeCandidate.id) : ''
  if (!nodeId || !diagramMetaByNodeId[nodeId])
    return
  selectedNodeId.value = nodeId
}
</script>

<template>
  <div class="h-full min-h-0 p-4">
    <Tabs v-model="activeTab" class="h-full min-h-0 flex flex-col gap-4">
      <TabsList class="w-fit">
        <TabsTrigger value="federation">Федерации</TabsTrigger>
        <TabsTrigger value="communication">Коммуникация</TabsTrigger>
        <TabsTrigger value="events">Контракты и шина</TabsTrigger>
        <TabsTrigger value="dispatch">Поток mounted</TabsTrigger>
        <TabsTrigger value="example">Owner и Target</TabsTrigger>
        <TabsTrigger value="landscape">Карта сущностей</TabsTrigger>
        <TabsTrigger value="raph">Как работает Raph</TabsTrigger>
        <TabsTrigger value="nova">Как работает Nova</TabsTrigger>
      </TabsList>

      <TabsContent value="federation" class="flex-1 min-h-0 m-0">
        <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div class="h-full min-h-[2580px] rounded-xl border bg-muted/20 overflow-hidden">
            <VueFlow
              v-model:nodes="nodes"
              v-model:edges="edges"
              class="architecture-flow"
              :fit-view-on-init="true"
              :nodes-connectable="false"
              :elements-selectable="true"
              :edges-updatable="false"
              :min-zoom="0.28"
              :max-zoom="1.3"
              @node-click="onNodeClick"
            >
              <Background :gap="22" :size="1" pattern-color="rgba(14,165,233,0.12)" />
              <Controls position="bottom-left" />

              <template #node-federation="nodeProps">
                <div class="federation-node" :title="nodeProps.data.subtitle">
                  <div class="federation-title">{{ nodeProps.data.title }}</div>
                  <div class="federation-subtitle">{{ nodeProps.data.subtitle }}</div>
                </div>
              </template>

              <template #node-frame="nodeProps">
                <div
                  class="frame-node"
                  :style="{ width: `${nodeProps.data.width}px`, height: `${nodeProps.data.height}px` }"
                >
                  <div class="frame-label">{{ nodeProps.data.title }}</div>
                </div>
              </template>

              <template #node-module="nodeProps">
                <div class="module-node">
                  {{ nodeProps.data.title }}
                </div>
              </template>

              <template #node-process="nodeProps">
                <div class="process-node" :data-tone="nodeProps.data.tone">
                  <div class="process-title">{{ nodeProps.data.title }}</div>
                  <div class="process-subtitle">{{ nodeProps.data.subtitle }}</div>
                </div>
              </template>
            </VueFlow>
          </div>

          <div class="h-full min-h-0 flex flex-col gap-4">
            <div class="rounded-xl border bg-background flex-1 min-h-[320px] overflow-auto">
              <div v-if="selectedMeta" class="p-4">
                <div class="mb-3 text-sm font-semibold">
                  {{ selectedMeta.title }}
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ selectedMeta.description }}
                </p>
              </div>
              <div v-else class="p-4 text-sm text-muted-foreground">
                Выберите ноду на диаграмме.
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        v-for="section in architectureSections"
        :key="section.id"
        :value="section.id"
        class="flex-1 min-h-0 m-0"
      >
        <div class="h-full min-h-0 overflow-auto rounded-xl border bg-background">
          <div class="space-y-6 p-5">
            <div class="space-y-3">
              <h2 class="text-base font-semibold">{{ section.title }}</h2>
              <div class="grid gap-3">
                <div
                  v-for="(paragraph, index) in section.text"
                  :key="`${section.id}-${index}`"
                  class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                >
                  {{ paragraph }}
                </div>
              </div>
            </div>

            <div class="rounded-xl border bg-muted/20 overflow-hidden">
              <VueFlow
                :nodes="section.nodes"
                :edges="section.edges"
                class="architecture-flow architecture-flow--doc"
                :style="{ minHeight: `${section.minHeight ?? 920}px` }"
                :fit-view-on-init="true"
                :nodes-connectable="false"
                :elements-selectable="false"
                :nodes-draggable="false"
                :edges-updatable="false"
                :min-zoom="0.45"
                :max-zoom="1.2"
              >
                <Background :gap="22" :size="1" pattern-color="rgba(14,165,233,0.12)" />
                <Controls position="bottom-left" />

                <template #node-frame="nodeProps">
                  <div
                    class="frame-node"
                    :style="{ width: `${nodeProps.data.width}px`, height: `${nodeProps.data.height}px` }"
                  >
                    <div class="frame-label">{{ nodeProps.data.title }}</div>
                  </div>
                </template>

                <template #node-process="nodeProps">
                  <div class="process-node" :data-tone="nodeProps.data.tone">
                    <div class="process-title">{{ nodeProps.data.title }}</div>
                    <div class="process-subtitle">{{ nodeProps.data.subtitle }}</div>
                  </div>
                </template>
              </VueFlow>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
:deep(.architecture-flow.vue-flow) {
  background: transparent;
}

:deep(.architecture-flow .vue-flow__edge-path) {
  stroke: rgba(2, 132, 199, 0.76);
  stroke-width: 2.2;
}

:deep(.architecture-flow .vue-flow__edge-text) {
  fill: rgb(71, 85, 105);
  font-size: 12px;
  font-weight: 600;
}

:deep(.architecture-flow .vue-flow__edge-textbg) {
  fill: rgba(255, 255, 255, 0.96);
  stroke: rgba(148, 163, 184, 0.28);
  stroke-width: 1;
}

:deep(.architecture-flow .vue-flow__controls) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
}

:deep(.architecture-flow .vue-flow__node.selected > div) {
  outline: 2px solid rgba(59, 130, 246, 0.55);
  outline-offset: 2px;
}

:deep(.architecture-flow--doc.vue-flow) {
  min-height: 920px;
}

.federation-node {
  width: 340px;
  border-radius: 18px;
  border: 1px solid rgba(2, 132, 199, 0.35);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.95) 0%, rgba(224, 242, 254, 0.95) 100%);
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.15);
  padding: 14px 16px;
}

.federation-title {
  font-size: 15px;
  font-weight: 700;
  color: rgb(3, 105, 161);
}

.federation-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: rgb(71, 85, 105);
}

.module-node {
  min-width: 320px;
  border-radius: 14px;
  border: 1px solid rgba(100, 116, 139, 0.28);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(15, 23, 42);
  text-align: center;
}

.process-node {
  width: 290px;
  border-radius: 16px;
  border: 1px solid rgba(100, 116, 139, 0.24);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  padding: 14px 16px;
}

.process-node[data-tone='source'] {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.98), rgba(220, 252, 231, 0.98));
  border-color: rgba(34, 197, 94, 0.28);
}

.process-node[data-tone='core'] {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(224, 242, 254, 0.98));
  border-color: rgba(14, 165, 233, 0.3);
}

.process-node[data-tone='config'] {
  background: linear-gradient(180deg, rgba(250, 245, 255, 0.98), rgba(243, 232, 255, 0.98));
  border-color: rgba(168, 85, 247, 0.28);
}

.process-node[data-tone='runtime'] {
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(255, 237, 213, 0.98));
  border-color: rgba(249, 115, 22, 0.28);
}

.process-node[data-tone='action'] {
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.98), rgba(254, 226, 226, 0.98));
  border-color: rgba(239, 68, 68, 0.28);
}

.process-title {
  font-size: 14px;
  font-weight: 700;
  color: rgb(15, 23, 42);
}

.process-subtitle {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: rgb(71, 85, 105);
}

.frame-node {
  border-radius: 18px;
  border: 1px solid rgba(14, 165, 233, 0.25);
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.5), rgba(248, 250, 252, 0.35));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

.frame-label {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(14, 116, 144);
  opacity: 0.85;
}
</style>
