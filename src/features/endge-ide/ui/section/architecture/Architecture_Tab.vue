<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'

import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MarkerType, Position, VueFlow } from '@vue-flow/core'
import { computed, ref } from 'vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import MarkdownViewer from '@/features/endge-ide/ui/components/MarkdownViewer.vue'

interface DiagramMeta {
  title: string
  description: string
  docId: string
  kind: 'federation' | 'module'
}

interface ModuleSpec {
  title: string
  description: string
  docId: string
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
    docId: 'submodules-federation',
    kind: 'federation',
  },
  'f-endge-vue': {
    title: 'Федерация ENDGE VUE',
    description: 'Интеграционный слой @endge/vue: привязка рендеров и реактивных фаз к ядру Endge.',
    docId: 'submodules-endge-vue',
    kind: 'federation',
  },
  'f-appcore': {
    title: 'APPCORE',
    description: 'Прикладная точка запуска: создает boot context, инициализирует Endge и подключает EndgeVue.',
    docId: 'submodules-app-core',
    kind: 'federation',
  },
}

const endgeModules: ModuleSpec[] = [
  { title: 'context', description: 'Текущий проект, среда и локаль.', docId: 'submodules-context' },
  { title: 'diagnostics', description: 'Системная диагностика, мониторинг и structured records.', docId: 'submodules-diagnostics' },
  { title: 'debug', description: 'Трассировка операций и диагностика.', docId: 'submodules-debug' },
  { title: 'domain', description: 'Доменная модель и CRUD сущностей.', docId: 'submodules-domain' },
  { title: 'vocabs', description: 'Загрузка словарей по namespace.', docId: 'submodules-vocabs' },
  { title: 'extract', description: 'Извлечение и нормализация данных.', docId: 'submodules-extract' },
  { title: 'store', description: 'Рантайм-хранилище состояния.', docId: 'submodules-store' },
  { title: 'runtime', description: 'Выполнение runtime-фаз и вычислений.', docId: 'submodules-runtime' },
  { title: 'vars', description: 'Переменные и интерполяции.', docId: 'submodules-vars' },
  { title: 'query', description: 'Единая точка запуска запросов.', docId: 'submodules-query' },
  { title: 'auth', description: 'Авторизация и токены.', docId: 'submodules-auth' },
  { title: 'schema', description: 'Слой хранения схемы/документов.', docId: 'submodules-schema' },
  { title: 'flow', description: 'Движок исполнения действий.', docId: 'submodules-flow' },
  { title: 'updates', description: 'Обновления и синхронизация состояния.', docId: 'submodules-updates' },
  { title: 'events', description: 'Событийная шина.', docId: 'submodules-events' },
  { title: 'sse', description: 'Server-Sent Events канал.', docId: 'submodules-sse' },
  { title: 'ui', description: 'UI-состояние и утилиты интерфейса.', docId: 'submodules-ui' },
  { title: 'behaviorBindings', description: 'Declarative behavior bindings, resolver и dispatch реакций.', docId: 'submodules-bindings' },
  { title: 'bind', description: 'Программная подмена кода у converter/action/runtime step.', docId: 'submodules-bind' },
  { title: 'console', description: 'Команды dev-консоли.', docId: 'submodules-console' },
  { title: 'runtimeDebugger', description: 'Инструменты runtime-debugger.', docId: 'submodules-runtime-debugger' },
  { title: 'styles', description: 'Стили, CSS токены и применение style-документов.', docId: 'submodules-styles' },
]

const endgeVueModules: ModuleSpec[] = [
  { title: 'SFC adapter', description: 'Native Vue renderer adapter for ComponentSFC.', docId: 'submodules-endge-vue' },
  { title: 'raph: watch phase', description: 'Фаза watch для синхронизации reactive ref с Raph.', docId: 'submodules-endge-vue' },
]

const appCoreModules: ModuleSpec[] = [
  { title: 'boot: Endge', description: 'Запуск ядра через Endge.boot(ctx).', docId: 'submodules-app-core-bootstrap' },
  { title: 'plugin: EndgeVue', description: 'Подключение слоя EndgeVue через Endge.use.', docId: 'submodules-app-core-integration' },
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
      docId: module.docId,
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

const docs = EndgeIDE.docs
const selectedNodeId = ref<string | null>(null)
const selectedMeta = computed<DiagramMeta | null>(() => {
  if (!selectedNodeId.value)
    return null
  return diagramMetaByNodeId[selectedNodeId.value] ?? null
})

const selectedDocId = computed(() => selectedMeta.value?.docId ?? null)
const selectedDocFile = computed(() => {
  if (!selectedDocId.value)
    return null
  const entry = docs.getEntryById(selectedDocId.value)
  return entry?.file ?? null
})

const activeTab = ref<'federation' | 'communication' | 'events' | 'dispatch' | 'example' | 'landscape' | 'raph' | 'nova'>('federation')

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
    id: 'communication',
    title: 'Слои коммуникации',
    text: [
      'Коммуникация в системе разделена на три уровня. Нижний уровень — Raph: он следит только за изменениями данных, dirty-узлами и фазами перерасчёта.',
      'Над ним живёт событийный semantic-слой: runtime host испускает канонический факт, event contract задаёт его смысл, Endge.behaviorBindings подбирает реакции, а Endge.events работает как transport-шина для подписчиков из кода.',
      'На верхнем уровне находятся доменные runtime-сущности проекта: Project, Page, View, Component, Query и Action. Они одновременно потребляют data-reactivity снизу и публикуют lifecycle/interaction события наверх.',
      'Такое разделение делает архитектуру production-ready: Raph не загрязняется временными lifecycle-фактами, а событийный слой не зависит от внутренней механики dirty-path и фаз графа.',
    ],
    minHeight: 1180,
    nodes: [
      createFlowFrame('comm-frame-raph', 'Слой 1. Raph и данные', 2220, 260, 40, 30),
      createFlowFrame('comm-frame-events', 'Слой 2. Semantic events и bindings', 2220, 330, 40, 330),
      createFlowFrame('comm-frame-domain', 'Слой 3. Доменные runtime-сущности', 2220, 360, 40, 720),

      createFlowNode('comm-store', 'Raph Store', 'Канонические пути и текущее состояние данных', 120, 110, 'runtime'),
      createFlowNode('comm-dirty', 'Dirty / Track', 'Какие пути изменились и какие ноды затронуты', 640, 110, 'runtime'),
      createFlowNode('comm-phases', 'Фазы Raph', 'queries / tables / другие phase handlers', 1160, 110, 'core'),
      createFlowNode('comm-runtimes', 'RaphNode + Runtime host', 'Нода получает апдейт от графа', 1680, 110, 'core'),

      createFlowNode('comm-fact', 'Канонический runtime-факт', 'Например: page.mounted или query.loaded', 120, 430, 'source'),
      createFlowNode('comm-contracts', 'Event Contracts', 'Что это за событие, scope и допустимость binding', 640, 430, 'config'),
      createFlowNode('comm-bindings', 'Endge.behaviorBindings', 'Resolver, inheritance, environment, priority, mode', 1160, 430, 'config'),
      createFlowNode('comm-actions', 'Endge.flow', 'Исполнение action/script по matched bindings', 1680, 430, 'action'),
      createFlowNode('comm-bus', 'Endge.events', 'Transport-шина для кодовых подписчиков', 1680, 570, 'runtime'),

      createFlowNode('comm-project', 'Project / Page', 'Lifecyle верхнего уровня проекта и страниц', 120, 830, 'source'),
      createFlowNode('comm-view', 'View', 'Legacy/presentation entity', 640, 830, 'source'),
      createFlowNode('comm-composition', 'Composition', 'Runtime graph и orchestration без rendering', 1160, 830, 'source'),
      createFlowNode('comm-component', 'Component', 'UI interactions, mounted, click, input', 1160, 830, 'source'),
      createFlowNode('comm-query', 'Query / Action', 'Данные, загрузка, шаги исполнения и эффекты', 1680, 830, 'source'),
    ],
    edges: [
      createFlowEdge('comm-1', 'comm-store', 'comm-dirty', 'изменение данных'),
      createFlowEdge('comm-2', 'comm-dirty', 'comm-phases', 'dirty идёт в phase'),
      createFlowEdge('comm-3', 'comm-phases', 'comm-runtimes', 'phase уведомляет host', true),

      createFlowEdge('comm-4', 'comm-runtimes', 'comm-fact', 'host сообщает факт в ядро'),
      createFlowEdge('comm-5', 'comm-fact', 'comm-contracts', 'semantic интерпретация'),
      createFlowEdge('comm-6', 'comm-contracts', 'comm-bindings', 'контракт разрешает binding'),
      createFlowEdge('comm-7', 'comm-bindings', 'comm-actions', 'исполнение реакций'),
      createFlowEdge('comm-8', 'comm-fact', 'comm-bus', 'публикация в bus'),

      createFlowEdge('comm-9', 'comm-project', 'comm-view', 'рендерит / содержит'),
      createFlowEdge('comm-10', 'comm-view', 'comm-component', 'визуальный слой'),
      createFlowEdge('comm-11', 'comm-view', 'comm-query', 'данные и сценарии'),
      createFlowEdge('comm-12', 'comm-project', 'comm-fact', 'page/project lifecycle'),
      createFlowEdge('comm-13', 'comm-component', 'comm-fact', 'interaction / mounted'),
      createFlowEdge('comm-14', 'comm-query', 'comm-fact', 'loaded / error / step'),
      createFlowEdge('comm-15', 'comm-phases', 'comm-query', 'data-driven апдейты'),
      createFlowEdge('comm-16', 'comm-bus', 'comm-project', 'кодовые реакции и наблюдаемость'),
    ],
  },
  {
    id: 'events',
    title: 'Контракты, биндинги и шина',
    text: [
      'Контракты описывают допустимые доменные события сущностей: кто является owner/target, можно ли вешать binding и какие варианты вообще поддерживаются.',
      'Binding хранит декларативную реакцию: на какое событие, у какого owner/target, какой action нужно выполнить, с каким mode/priority/environment.',
      'Endge.events не хранит эти правила. Это транспортная шина runtime-сообщений, на которую код может подписываться вручную для технических реакций и наблюдаемости.',
    ],
    nodes: [
      createFlowNode('contracts', 'Контракты', 'Какие события вообще допустимы', 40, 80, 'config'),
      createFlowNode('bindings', 'Endge.behaviorBindings', 'Какие действия привязаны к контрактам', 560, 80, 'config'),
      createFlowNode('dispatcher', 'Диспетчер биндингов', 'Единая точка резолва и исполнения', 1180, 80, 'core'),
      createFlowNode('actions', 'Действия', 'Исполняемая логика из папки Действия', 1800, 80, 'action'),
      createFlowNode('bus', 'Шина Endge.events', 'Транспорт runtime-сообщений', 1180, 430, 'runtime'),
      createFlowNode('subscribers', 'Кодовые подписчики', 'Подписки через Endge.events.on(...)', 1800, 430, 'runtime'),
    ],
    edges: [
      createFlowEdge('ec-1', 'contracts', 'bindings', 'контракт разрешает binding'),
      createFlowEdge('ec-2', 'bindings', 'dispatcher', 'resolver читает bindings'),
      createFlowEdge('ec-3', 'dispatcher', 'actions', 'запуск действий'),
      createFlowEdge('ec-4', 'dispatcher', 'bus', 'публикация runtime-события', true),
      createFlowEdge('ec-5', 'bus', 'subscribers', 'доставка подписчикам'),
    ],
  },
  {
    id: 'dispatch',
    title: 'Что происходит при mounted',
    text: [
      'Runtime-источник (например, page/view-компонент) не должен сам перебирать bindings. Его задача - сообщить ядру, что произошёл канонический факт события.',
      'Дальше ядро через dispatcher/resolver находит подходящие owner/target bindings, применяет inheritance/env/mode и запускает actions.',
      'Публикация в Endge.events лучше делать после нормализации события в ядре: это даёт единый формат события и не раздувает логику на стороне UI-компонентов.',
    ],
    nodes: [
      createFlowNode('source-view', 'View/Page-компонент', 'Монтируется в UI/runtime', 40, 100, 'source'),
      createFlowNode('source-module', 'Модуль Page/Project', 'Сообщает в ядро о факте события', 520, 100, 'source'),
      createFlowNode('core-event', 'Каноническое событие', 'Например: page.mounted', 1080, 100, 'core'),
      createFlowNode('resolver', 'Resolver биндингов', 'Ищет owner/target совпадения', 1640, 100, 'core'),
      createFlowNode('action-runner', 'Исполнитель действий', 'Выполняет подобранные actions', 2200, 100, 'action'),
      createFlowNode('runtime-bus', 'Шина Endge.events', 'Лента runtime-событий и подписки', 1640, 430, 'runtime'),
    ],
    edges: [
      createFlowEdge('df-1', 'source-view', 'source-module', 'lifecycle mounted'),
      createFlowEdge('df-2', 'source-module', 'core-event', 'передача факта в ядро'),
      createFlowEdge('df-3', 'core-event', 'resolver', 'диспетчеризация', true),
      createFlowEdge('df-4', 'resolver', 'action-runner', 'выполнение действий'),
      createFlowEdge('df-5', 'core-event', 'runtime-bus', 'публикация в шину'),
    ],
  },
  {
    id: 'example',
    title: 'Одно событие, две реакции',
    text: [
      'Факт page.mounted в реальности один: конкретная page смонтировалась. Scope не создаёт два разных факта мира.',
      'Этот один факт может быть интерпретирован разными контрактами: для самой Page как owner-событие и для Project как target-событие на дочерней page.',
      'Поэтому правильная модель - одно canonical event occurrence, а затем несколько matched bindings с разными scope и owner/target контекстом.',
    ],
    nodes: [
      createFlowNode('fact', 'Каноническое событие', 'page.mounted у Page#42', 80, 160, 'core'),
      createFlowNode('page-contract', 'Контракт Page', 'scope = owner', 470, 60, 'config'),
      createFlowNode('project-contract', 'Контракт Project', 'scope = target для page.mounted', 470, 260, 'config'),
      createFlowNode('page-binding', 'Биндинг Page', 'owner = page, event = mounted', 900, 60, 'config'),
      createFlowNode('project-binding', 'Биндинг Project', 'owner = project, target = page', 900, 260, 'config'),
      createFlowNode('page-action', 'Действие A', 'Например: аналитика страницы', 1330, 60, 'action'),
      createFlowNode('project-action', 'Действие B', 'Например: реакция проекта', 1330, 260, 'action'),
    ],
    edges: [
      createFlowEdge('ex-1', 'fact', 'page-contract', 'owner-интерпретация'),
      createFlowEdge('ex-2', 'fact', 'project-contract', 'target-интерпретация'),
      createFlowEdge('ex-3', 'page-contract', 'page-binding', 'разрешает binding'),
      createFlowEdge('ex-4', 'project-contract', 'project-binding', 'разрешает binding'),
      createFlowEdge('ex-5', 'page-binding', 'page-action', 'выполнение'),
      createFlowEdge('ex-6', 'project-binding', 'project-action', 'выполнение'),
    ],
  },
  {
    id: 'landscape',
    title: 'Жизненный цикл и карта сущностей',
    text: [
      'Проект является верхнеуровневым контейнером: в нём живут страницы, окружения, навигация, стили и общие поведенческие правила.',
      'Страница обычно собирается из нескольких источников: она может быть связана с шаблоном страницы, использовать навигацию и стили, а внутри содержать view как рабочую runtime-область.',
      'View остаётся legacy/presentation entity. Новый runtime-граф Filter → Query → Component описывает Composition: orchestration без layout и rendering. Поверх обеих структур работают contracts, bindings, actions и шина событий.',
    ],
    nodes: [
      createFlowNode('behavior-contracts', 'Контракты', 'Какие события допустимы у сущностей', 220, 40, 'config'),
      createFlowNode('behavior-bindings', 'Биндинги', 'Какие действия привязаны к событиям', 680, 40, 'config'),
      createFlowNode('behavior-actions', 'Действия', 'Поведенческая логика и сценарии', 1140, 40, 'action'),
      createFlowNode('behavior-bus', 'Шина Endge.events', 'Транспорт runtime-событий и наблюдаемость', 1600, 40, 'runtime'),

      createFlowNode('project-root', 'Проект', 'Корневой контейнер конфигурации и поведения', 900, 230, 'core'),
      createFlowNode('page-template', 'Шаблон страницы', 'Структурная заготовка и layout области', 240, 430, 'config'),
      createFlowNode('navigation', 'Навигация', 'Связи переходов и меню проекта', 700, 430, 'config'),
      createFlowNode('styles', 'Стили', 'Токены, наборы стилей и оформление', 1160, 430, 'config'),
      createFlowNode('page', 'Страница', 'Конкретная точка входа и lifecycle страницы', 900, 650, 'source'),
      createFlowNode('view', 'View', 'Legacy/presentation entity страницы', 900, 900, 'core'),
      createFlowNode('composition', 'Composition', 'Runtime graph и orchestration', 1460, 900, 'core'),
      createFlowNode('component', 'Компонент', 'UI и визуальная композиция', 340, 1130, 'source'),
      createFlowNode('query', 'Запрос', 'Источник данных для view', 900, 1130, 'source'),
      createFlowNode('filter', 'Фильтр', 'Предобработка и ограничения данных', 1460, 1130, 'source'),
      createFlowNode('runtime-user', 'Пользователь / Runtime', 'Источник взаимодействий и триггеров', 900, 1360, 'runtime'),
    ],
    edges: [
      createFlowEdge('ls-1', 'behavior-contracts', 'behavior-bindings', 'контракт разрешает binding'),
      createFlowEdge('ls-2', 'behavior-bindings', 'behavior-actions', 'binding запускает action'),
      createFlowEdge('ls-3', 'behavior-actions', 'behavior-bus', 'действия могут публиковать события'),
      createFlowEdge('ls-4', 'behavior-contracts', 'project-root', 'правила уровня проекта'),
      createFlowEdge('ls-5', 'behavior-bindings', 'page', 'реакции страницы и target-связи'),
      createFlowEdge('ls-6', 'behavior-bus', 'runtime-user', 'runtime сообщения и наблюдаемость'),

      createFlowEdge('ls-7', 'project-root', 'page-template', 'использует шаблоны'),
      createFlowEdge('ls-8', 'project-root', 'navigation', 'хранит навигацию'),
      createFlowEdge('ls-9', 'project-root', 'styles', 'хранит стили'),
      createFlowEdge('ls-10', 'project-root', 'page', 'содержит страницы'),

      createFlowEdge('ls-11', 'page-template', 'page', 'структура / layout'),
      createFlowEdge('ls-12', 'navigation', 'page', 'маршрут / переход'),
      createFlowEdge('ls-13', 'styles', 'page', 'оформление'),
      createFlowEdge('ls-14', 'page', 'view', 'рендерит view'),

      createFlowEdge('ls-15', 'view', 'component', 'визуальный слой'),
      createFlowEdge('ls-16', 'view', 'query', 'источник данных'),
      createFlowEdge('ls-17', 'view', 'filter', 'ограничения / трансформация'),
      createFlowEdge('ls-18', 'runtime-user', 'page', 'mounted / route / interactions'),
      createFlowEdge('ls-19', 'runtime-user', 'view', 'input / runtime события'),
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
      createFlowNode('raph-runtime', 'Runtime host', 'Query/Table/Action и далее Page/View', 1440, 320, 'source'),
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
      createFlowNode('nova-ui', 'UI / Playground / Документация', 'Места, где Nova используется в приложении', 80, 80, 'source'),
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

function openDocsByNodeId(nodeId: string): void {
  const meta = diagramMetaByNodeId[nodeId]
  if (!meta)
    return
  docs.selectEntry(meta.docId)
}

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
  openDocsByNodeId(nodeId)
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
              <div v-if="selectedDocFile" class="p-4">
                <div class="mb-3 text-sm font-semibold">
                  {{ selectedMeta?.title }}
                </div>
                <MarkdownViewer :src="selectedDocFile" />
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
