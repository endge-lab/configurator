<script setup lang="ts">
import type {
  FrontendNeed,
  FrontendNeedChoiceOption,
  FrontendNeedOpenDocumentOption,
  FrontendRequest,
} from '@/features/endge-ide/model/agent/agent-frontend-request'

import {
  Bot,
  Lightbulb,
  MessageSquare,
  Send,
  Square,
  Trash2,
} from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  applyDomainOps,
  parseDomainOpsFromMessage,
} from '@/features/endge-ide/model/agent/agent-domain-ops'
import {
  applyFrontendRequest,
  executeCreateRuntime,
  executeOpenDocumentChoice,
  getRequestEntitiesFilter,
  iterateUserActionToFrontendRequest,
  normalizeFrontendRequest,
  normalizeNeedEntityTypeToSliceKey,
  parseFrontendRequestFromMessage,
} from '@/features/endge-ide/model/agent/agent-frontend-request'
import { runLocalAgentOrchestrator } from '@/features/endge-ide/model/agent/agent-local-orchestrator'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

/** Опционально: родитель может передать функцию, возвращающую снимок домена для retrieval (большой домен не уходит целиком в модель). */
const getDomainSnapshot = inject<() => object | Promise<object>>(
  'agentDomainSnapshot',
  () => ({}),
)

/** Ключи коллекций в снимке домена (соответствуют бэкенду). */
const DOMAIN_SLICE_KEYS = [
  'projects',
  'types',
  'queries',
  'components',
  'folders',
  'filters',
  'actions',
  'integrations',
  'environments',
  'tenants',
  'policies',
  'styles',
  'parameters',
  'converters',
  'vocabs',
  'navigations',
  'page-templates',
  'pages',
  'i18n-bundles',
  'auth-profiles',
] as const

interface EntityRef {
  type: string
  identity: string
}

/** Максимальный размер каталога для первичного запроса (сводка домена), байт. */
const CATALOG_MAX_BYTES = 18 * 1024

/** Строит сводку домена для итеративного режима: массив { type, identity, name, documentType } по каждой сущности. */
function buildDomainCatalog(
  domain: Record<string, unknown>,
  maxBytes: number = CATALOG_MAX_BYTES,
): string {
  const root
    = (domain as { domain?: Record<string, unknown> }).domain ?? domain
  const list: Array<{
    type: string
    identity: string
    name: string
    documentType: string
  }> = []
  let size = 2
  for (const type of DOMAIN_SLICE_KEYS) {
    const arr = (root as Record<string, unknown>)[type]
    if (!Array.isArray(arr)) {
      continue
    }
    for (const e of arr) {
      const rec = e as Record<string, unknown>
      const identity = String(rec.identity ?? rec.id ?? '')
      const name = String(rec.name ?? rec.displayName ?? '')
      const documentType = getDocumentType(type, rec)
      const entry = { type, identity, name, documentType }
      const approx = JSON.stringify(entry).length + 2
      if (maxBytes > 0 && size + approx > maxBytes) {
        return JSON.stringify(list)
      }
      list.push(entry)
      size += approx
    }
  }
  return JSON.stringify(list)
}

/** Маппинг documentType (вкладка) → ключ среза домена для контекста. */
const DOCUMENT_TYPE_TO_SLICE: Record<string, string> = {
  'component-table': 'components',
  'component-dsl': 'components',
  'query-gql': 'queries',
  'query-rest': 'queries',
  'query-custom': 'queries',
  'type': 'types',
  'primitive': 'types',
  'action': 'actions',
  'default-parameter': 'parameters',
  'default-filter': 'filters',
  'converter': 'converters',
  'integration': 'integrations',
  'environment': 'environments',
  'tenant': 'tenants',
  'policy': 'policies',
  'style': 'styles',
  'vocabs': 'vocabs',
  'i18n-bundles': 'i18n-bundles',
  'auth-profile': 'auth-profiles',
  'page': 'pages',
  'page-template': 'page-templates',
  'navigation': 'navigations',
  'project': 'projects',
}

/** Маппинг: ключ коллекции → documentType для open_document. Для components и queries берётся из сущности при наличии. */
function getDocumentType(
  sliceKey: string,
  rec: Record<string, unknown>,
): string {
  if (sliceKey === 'queries') {
    const t = String(rec.type ?? rec.kind ?? 'gql').toLowerCase()
    if (t.includes('rest')) { return 'query-rest' }
    if (t.includes('custom')) { return 'query-custom' }
    return 'query-gql'
  }
  if (sliceKey === 'components') {
    const t = String(rec.type ?? rec.kind ?? '').toLowerCase()
    if (
      t.includes('dsl')
      || t.includes('jsx')
      || t.includes('component.jsx')
      || t.includes('component-dsl')
    ) {
      return 'component-dsl'
    }
    if (t.includes('table') || t.includes('component-table')) { return 'component-table' }
    return 'component-table'
  }
  const sliceToDoc: Record<string, string> = {
    'types': 'type',
    'actions': 'action',
    'parameters': 'default-parameter',
    'filters': 'default-filter',
    'converters': 'converter',
    'integrations': 'integration',
    'environments': 'environment',
    'tenants': 'tenant',
    'policies': 'policy',
    'styles': 'style',
    'vocabs': 'vocabs',
    'auth-profiles': 'auth-profile',
    'navigations': 'navigation',
    'page-templates': 'page-template',
    'pages': 'page',
    'projects': 'project',
    'folders': 'project',
  }
  return sliceToDoc[sliceKey] ?? sliceKey
}

/** Фильтрует краткий список сущностей по критериям request_entities (name, documentType, entityType). */
function filterShortDescByRequest(
  list: ShortDescItem[],
  filter: { name?: string, documentType?: string, entityType?: string },
): ShortDescItem[] {
  if (!filter.name && !filter.documentType && !filter.entityType) { return list }
  const nameLower = filter.name?.toLowerCase().trim()
  return list.filter((e) => {
    if (
      nameLower
      && !e.displayName.toLowerCase().includes(nameLower)
      && !e.identity.toLowerCase().includes(nameLower)
    ) {
      return false
    }
    if (filter.documentType && e.documentType !== filter.documentType) { return false }
    if (filter.entityType && e.entityType !== filter.entityType) { return false }
    return true
  })
}

/** Собирает фрагмент домена только по списку сущностей (type + identity). */
function buildDomainFragment(
  domain: Record<string, unknown>,
  refs: EntityRef[],
): Record<string, unknown> {
  if (!refs.length) {
    return {}
  }
  const want = new Set(refs.map(r => `${r.type}:${r.identity}`))
  const root
    = (domain as { domain?: Record<string, unknown> }).domain ?? domain
  const out: Record<string, unknown> = {}
  for (const key of DOMAIN_SLICE_KEYS) {
    const arr = (root as Record<string, unknown>)[key]
    if (!Array.isArray(arr)) {
      continue
    }
    const filtered = arr.filter((e: Record<string, unknown>) =>
      want.has(`${key}:${String(e.identity ?? e.id ?? '')}`),
    )
    if (filtered.length) {
      out[key] = filtered
    }
  }
  return out
}

/** Ключи entities для итеративного режима (совпадают с бэкендом). */
const ITERATE_ENTITY_KEYS = [
  'projects',
  'folders',
  'types',
  'queries',
  'components',
  'actions',
  'parameters',
  'filters',
  'converters',
  'integrations',
  'environments',
  'tenants',
  'policies',
  'styles',
  'vocabs',
  'i18nBundles',
  'authProfiles',
  'pages',
  'pageTemplates',
  'navigations',
] as const

/** Маппинг ключа среза домена → ключ в entities-short-desc (camelCase). */
const SLICE_TO_CONTEXT_KEY: Record<string, string> = {
  'projects': 'projects',
  'folders': 'folders',
  'types': 'types',
  'queries': 'queries',
  'components': 'components',
  'actions': 'actions',
  'parameters': 'parameters',
  'filters': 'filters',
  'converters': 'converters',
  'integrations': 'integrations',
  'environments': 'environments',
  'tenants': 'tenants',
  'policies': 'policies',
  'styles': 'styles',
  'vocabs': 'vocabs',
  'i18n-bundles': 'i18nBundles',
  'auth-profiles': 'authProfiles',
  'pages': 'pages',
  'page-templates': 'pageTemplates',
  'navigations': 'navigations',
}

interface ShortDescItem {
  id?: number | string
  identity: string
  displayName: string
  documentType: string
  entityType: string
}

/** Собирает краткое описание сущностей по срезам для контекста при каждом запросе. */
function buildEntitiesShortDesc(
  domain: Record<string, unknown>,
): Record<string, ShortDescItem[]> {
  const root
    = (domain as { domain?: Record<string, unknown> }).domain ?? domain
  const out: Record<string, ShortDescItem[]> = {}
  for (const key of ITERATE_ENTITY_KEYS) {
    out[key] = []
  }
  for (const sliceKey of DOMAIN_SLICE_KEYS) {
    const contextKey = SLICE_TO_CONTEXT_KEY[sliceKey] ?? sliceKey
    const arr = (root as Record<string, unknown>)[sliceKey]
    if (!Array.isArray(arr)) { continue }
    const items: ShortDescItem[] = arr.map((e: Record<string, unknown>) => ({
      id:
        typeof e.id === 'number' || typeof e.id === 'string'
          ? e.id
          : typeof e.identity === 'number' || typeof e.identity === 'string'
            ? e.identity
            : undefined,
      identity: String(e.identity ?? e.id ?? ''),
      displayName: String(e.name ?? e.displayName ?? e.identity ?? ''),
      documentType: getDocumentType(sliceKey, e),
      entityType: contextKey,
    }))
    if (out[contextKey]) { out[contextKey] = items }
  }
  return out
}

/** Преобразует entities-short-desc в плоский массив для фильтрации request_entities. */
function flattenEntitiesShortDesc(
  shortDesc: Record<string, ShortDescItem[]>,
): ShortDescItem[] {
  const list: ShortDescItem[] = []
  for (const key of ITERATE_ENTITY_KEYS) {
    const arr = shortDesc[key]
    if (!Array.isArray(arr)) { continue }
    for (const item of arr) { list.push(item) }
  }
  return list
}

/** Пустая структура entities для итеративного режима. */
function buildEmptyEntities(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  for (const key of ITERATE_ENTITY_KEYS) {
    out[key] = []
  }
  return out
}

/** Текущий открытый документ из активной вкладки для userContext. */
function getActiveDocumentFromTab(): {
  documentType: string
  identity: string
  id: number | string
  name: string
} | null {
  const tab = EndgeIDE.tabs.activeTab.value
  const payload = tab?.payload as
    | {
      documentType?: string
      documentId?: string
      identity?: string
      id?: number | string
      name?: string
    }
    | undefined
  if (!payload?.documentType) { return null }
  return {
    documentType: payload.documentType,
    identity: payload.identity ?? payload.documentId ?? '',
    id: payload.id ?? 0,
    name: payload.name ?? '',
  }
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

function renderMarkdown(text: string): string {
  if (!text?.trim()) {
    return ''
  }
  return md.render(text)
}

const AGENT_LLM_LOG_PREFIX = '[Agent/LLM]'

function logLlm(event: string, payload?: unknown): void {
  if (payload === undefined) {
    console.log(`${AGENT_LLM_LOG_PREFIX} ${event}`)
    return
  }
  console.log(`${AGENT_LLM_LOG_PREFIX} ${event}`, payload)
}

/** Адрес сервиса ассистента (LLM). Без переменной в .env не подключаемся. */
const assistanceApiUrl
  = (import.meta.env.VITE_ASSISTANCE_API_URL as string | undefined)?.trim() ?? ''
const isAssistanceConfigured = computed(() => assistanceApiUrl.length > 0)

type AgentStatus = 'not-configured' | 'checking' | 'online' | 'offline'
const agentStatus = ref<AgentStatus>(
  assistanceApiUrl ? 'checking' : 'not-configured',
)

const CHECK_INTERVAL_MS = 5000
let checkTimer: ReturnType<typeof setInterval> | null = null

async function checkAgentConnection(): Promise<void> {
  if (!assistanceApiUrl) {
    return
  }
  try {
    const res = await fetch(`${assistanceApiUrl}/health`, { method: 'GET' })
    agentStatus.value = res.ok ? 'online' : 'offline'
  }
  catch {
    agentStatus.value = 'offline'
  }
}

onMounted(() => {
  loadSessionMessages()
  if (!assistanceApiUrl) {
    return
  }
  void checkAgentConnection()
  checkTimer = setInterval(checkAgentConnection, CHECK_INTERVAL_MS)
})

onBeforeUnmount(() => {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
})

function onTextareaKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter') {
    return
  }
  if (e.shiftKey) {
    return
  } // Shift+Enter — новая строка
  e.preventDefault()
  void send(undefined)
}

const input = ref('')
const sending = ref(false)
let abortController: AbortController | null = null
/** Сообщение чата. */
interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}
const messages = ref<ChatMessage[]>([])
const chatSessionId = ref<string>('')

const CHAT_SESSION_ID_LS_KEY = 'endge:agent:session-id'
const CHAT_MESSAGES_LS_PREFIX = 'endge:agent:messages:'
const MAX_PERSISTED_CHAT_MESSAGES = 80

function buildMessagesStorageKey(sessionId: string): string {
  return `${CHAT_MESSAGES_LS_PREFIX}${sessionId}`
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') { return crypto.randomUUID() }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function ensureSessionId(): string {
  if (chatSessionId.value) { return chatSessionId.value }
  try {
    const stored = localStorage.getItem(CHAT_SESSION_ID_LS_KEY)?.trim()
    if (stored) {
      chatSessionId.value = stored
      return stored
    }
    const created = generateSessionId()
    chatSessionId.value = created
    localStorage.setItem(CHAT_SESSION_ID_LS_KEY, created)
    return created
  }
  catch {
    const fallback = generateSessionId()
    chatSessionId.value = fallback
    return fallback
  }
}

function loadSessionMessages(): void {
  const sessionId = ensureSessionId()
  try {
    const raw = localStorage.getItem(buildMessagesStorageKey(sessionId))
    if (!raw) { return }
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) { return }
    const restored = parsed
      .map((item) => {
        const rec = item as { role?: string, text?: string }
        if (
          (rec.role !== 'user' && rec.role !== 'assistant')
          || typeof rec.text !== 'string'
        ) {
          return null
        }
        return { role: rec.role, text: rec.text } as ChatMessage
      })
      .filter(Boolean) as ChatMessage[]
    messages.value = restored.slice(-MAX_PERSISTED_CHAT_MESSAGES)
  }
  catch {
    // ignore localStorage parse errors
  }
}

function persistSessionMessages(): void {
  const sessionId = ensureSessionId()
  try {
    localStorage.setItem(
      buildMessagesStorageKey(sessionId),
      JSON.stringify(messages.value.slice(-MAX_PERSISTED_CHAT_MESSAGES)),
    )
  }
  catch {
    // ignore localStorage write errors
  }
}

/** Потребности из последнего frontend-request (для кнопки «Отправить контекст»). */
const pendingFrontendRequest = ref<FrontendRequest | null>(null)

/** Фильтр запроса сущностей от модели (request_entities): подставляется в следующий userContext.requestedEntities. */
const requestedEntitiesFilter = ref<{
  name?: string
  documentType?: string
  entityType?: string
} | null>(null)

/** По умолчанию используем двухконтурный режим resolve -> stream. */
const useIterateMode
  = (import.meta.env.VITE_ASSISTANCE_ITERATE_MODE as string | undefined)
    ?.trim()
    .toLowerCase() === 'true'

/** Модели выбираются только на бэкенде (env). В списке один пункт — «Авто», на запросы не влияет. */
const MODEL_OPTIONS = [{ value: 'auto', label: 'Авто' }] as const
const selectedModel = ref<string>('auto')

/** Режим: чат или автоматические подсказки по открытой вкладке. */
type ViewMode = 'chat' | 'hints'
const viewMode = ref<ViewMode>('chat')

/** Тип открытого документа (из активной вкладки) для контекстных подсказок. */
const activeDocumentType = computed(() => {
  const tab = EndgeIDE.tabs.activeTab.value
  const payload = tab?.payload as { documentType?: string } | undefined
  return payload?.documentType ?? null
})

/** Подсказки, которые агент может выполнить, в зависимости от типа открытого документа. */
const CONTEXT_HINTS = computed<Array<{ label: string, text: string }>>(() => {
  const docType = activeDocumentType.value
  const base = [
    {
      label: 'Что такое Endge?',
      text: 'Что такое Endge и для чего эта система?',
    },
  ]
  if (docType === 'component-table' || docType === 'component-dsl') {
    return [
      {
        label: 'Объяснить структуру компонента',
        text: 'Объясни структуру этого компонента и как он связан с данными.',
      },
      {
        label: 'Какие поля запроса подходят для колонок',
        text: 'По текущему компоненту таблицы: какие поля из запроса логично подставить в колонки и как их связать?',
      },
      {
        label: 'Подставить dataPaths через LLM',
        text: 'В инспекторе таблицы есть кнопка «Подставить через LLM» — она подставит привязки данных по ответу запроса и полям компонента. Кратко объясни, как ей пользоваться.',
      },
      ...base,
    ]
  }
  if (docType === 'query-gql' || docType === 'query-rest') {
    return [
      {
        label: 'Как заполнить subField и путь выборки',
        text: 'Как правильно заполнить subField и путь к данным в ответе запроса?',
      },
      ...base,
    ]
  }
  return base
})

watch(selectedModel, () => {
  messages.value = []
})

watch(
  messages,
  () => {
    persistSessionMessages()
  },
  { deep: true },
)

function stopRequest(): void {
  if (abortController) {
    abortController.abort()
  }
}

/** Быстрые вопросы при пустом чате */
const SUGGESTED_PROMPTS = [
  {
    label: 'Что такое Endge?',
    text: 'Что такое Endge и для чего эта система?',
  },
  {
    label: 'Как начать?',
    text: 'Как начать работу с системой? С чего начать?',
  },
  {
    label: 'Основные сущности',
    text: 'Какие основные сущности и понятия есть в системе?',
  },
]

const isChatEmpty = computed(() => messages.value.length === 0)

function sendSuggested(promptText: string): void {
  if (!assistanceApiUrl || sending.value) {
    return
  }
  viewMode.value = 'chat'
  void send(promptText)
}

function clearHistoryAndStartNewSession(): void {
  if (sending.value) {
    return
  }
  const prevSessionId = chatSessionId.value || ensureSessionId()
  const nextSessionId = generateSessionId()
  try {
    localStorage.removeItem(buildMessagesStorageKey(prevSessionId))
    localStorage.setItem(CHAT_SESSION_ID_LS_KEY, nextSessionId)
    localStorage.removeItem(buildMessagesStorageKey(nextSessionId))
  }
  catch {
    // ignore localStorage errors
  }
  chatSessionId.value = nextSessionId
  messages.value = []
  input.value = ''
  pendingFrontendRequest.value = null
  requestedEntitiesFilter.value = null
  toast.success('История очищена', {
    description: 'Создана новая сессия чата.',
  })
}

async function send(overrideMessage?: string): Promise<void> {
  if (!assistanceApiUrl) {
    return
  }
  const text = overrideMessage ?? input.value.trim()
  if (!text || sending.value) {
    return
  }
  const sessionId = ensureSessionId()
  if (!overrideMessage) {
    input.value = ''
  }
  pendingFrontendRequest.value = null
  messages.value.push({ role: 'user', text })
  sending.value = true
  abortController = new AbortController()
  const assistantIndex = messages.value.length
  messages.value.push({ role: 'assistant', text: '…' })

  try {
    const domainSnapshot = await (typeof getDomainSnapshot === 'function'
      ? getDomainSnapshot()
      : Promise.resolve({}))
    const hasDomain
      = domainSnapshot
        && typeof domainSnapshot === 'object'
        && Object.keys(domainSnapshot as object).length > 0
    const activeDocument = hasDomain ? getActiveDocumentFromTab() : null
    const entitiesShortDesc = hasDomain
      ? buildEntitiesShortDesc(domainSnapshot as Record<string, unknown>)
      : null

    console.log(
      '[Agent] Домен для запроса:',
      hasDomain
        ? `есть (ключей: ${Object.keys(domainSnapshot as object).length})`
        : 'нет — будет один запрос без двух шагов',
    )

    if (hasDomain && entitiesShortDesc) {
      const local = runLocalAgentOrchestrator({
        message: text,
        entities: flattenEntitiesShortDesc(entitiesShortDesc),
        activeDocument: activeDocument
          ? {
              documentType: activeDocument.documentType,
              identity: activeDocument.identity,
            }
          : null,
      })
      if (local) {
        const localRequest = normalizeFrontendRequest(local.request) ?? local.request
        logLlm('local-orchestrator.request', localRequest)
        let localActionsExecuted = 0
        const localErrors: string[] = []
        if (localRequest.actions?.length) {
          const result = await applyFrontendRequest(localRequest)
          localActionsExecuted = result.actionsExecuted
          localErrors.push(...result.errors)
          if (result.actionsExecuted > 0) {
            toast.success(`Выполнено действий: ${result.actionsExecuted}`)
          }
          if (result.errors.length) {
            toast.warning(result.errors.slice(0, 2).join('; '))
          }
        }
        pendingFrontendRequest.value = localRequest.needs?.length
          ? localRequest
          : null
        const summary
          = local.summary?.trim()
            || (localRequest.needs?.length
              ? 'Выберите подходящий вариант ниже.'
              : localActionsExecuted > 0
                ? 'Готово.'
                : '')
        messages.value[assistantIndex]!.text
          = localErrors.length && !localActionsExecuted
            ? localErrors.slice(0, 2).join('; ')
            : `${summary || 'Готово.'}${localErrors.length ? `\n\nВнимание: ${localErrors.slice(0, 1).join('; ')}` : ''}`
        return
      }
    }

    let streamBody: {
      message: string
      sessionId?: string
      userContext?: object
      history?: Array<{ role: string, content: string }>
      question?: string
      entities?: string
      domain?: object
    } = { message: text, sessionId }

    if (useIterateMode && hasDomain && entitiesShortDesc) {
      const filter = requestedEntitiesFilter.value
      const userContext: {
        'activeDocument': unknown
        'entities-short-desc': Record<string, ShortDescItem[]>
        'entities': Record<string, unknown[]>
        'requestedEntities'?: ShortDescItem[]
      } = {
        'activeDocument': activeDocument ?? null,
        'entities-short-desc': entitiesShortDesc,
        'entities': buildEmptyEntities(),
      }
      if (filter) {
        const requested = filterShortDescByRequest(
          flattenEntitiesShortDesc(entitiesShortDesc),
          filter,
        )
        userContext.requestedEntities = requested
        requestedEntitiesFilter.value = null
        console.log(
          '[Agent] Контекст request_entities:',
          filter,
          'записей:',
          requested.length,
        )
      }
      streamBody = {
        message: text,
        sessionId,
        userContext,
        history: messages.value
          .slice(0, Math.max(0, messages.value.length - 2))
          .map(m => ({ role: m.role, content: m.text })),
      }
      console.log(
        '[Agent] Итеративный режим, контекст заново: entities-short-desc',
        Object.keys(entitiesShortDesc).length,
      )
    }
    else if (hasDomain) {
      const catalog = buildDomainCatalog(
        domainSnapshot as Record<string, unknown>,
      )
      const catalogCount = (JSON.parse(catalog) as unknown[]).length
      console.log(
        '[Agent] Шаг 1/2 — resolve, записей в каталоге:',
        catalogCount,
      )
      logLlm('resolve.request', {
        sessionId,
        message: text,
        catalogBytes: catalog.length,
        catalogCount,
      })
      const resolveRes = await fetch(
        `${assistanceApiUrl}/api/v1/chat/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, catalog, sessionId }),
          signal: abortController.signal,
        },
      )
      if (resolveRes.ok) {
        const resolveRaw = (await resolveRes.json()) as unknown
        logLlm('resolve.response.ok', resolveRaw)
        const resolveData = (resolveRaw ?? {}) as {
          entities?: EntityRef[]
          question?: string
          simpleResponse?: string
          frontendRequest?: FrontendRequest
        }
        const entities = resolveData.entities ?? []
        const question = (resolveData.question ?? '').trim()
        const simpleResponse = resolveData.simpleResponse?.trim()
        const frontendReq = normalizeFrontendRequest(resolveData.frontendRequest)
        logLlm('resolve.frontendRequest.normalized', frontendReq)
        pendingFrontendRequest.value = frontendReq?.needs?.length
          ? frontendReq
          : null

        // Всегда применяем действия из resolve, если они есть (открытие документа и т.д.)
        if (frontendReq?.actions?.length) {
          const result = await applyFrontendRequest(frontendReq)
          logLlm('resolve.frontendRequest.apply-result', result)
          if (result.actionsExecuted > 0) {
            toast.success(`Выполнено: ${result.actionsExecuted}`)
          }
          if (result.errors.length) {
            toast.warning(result.errors.slice(0, 2).join('; '))
          }
        }

        const hasResolveFrontendReq = Boolean(
          frontendReq?.actions?.length || frontendReq?.needs?.length,
        )
        if (
          question === ''
          && (simpleResponse || hasResolveFrontendReq)
          && !entities.length
        ) {
          messages.value[assistantIndex]!.text
            = simpleResponse
              || (frontendReq?.needs?.length ? 'Выберите вариант ниже.' : 'Готово.')
          sending.value = false
          abortController = null
          return
        }

        console.log(
          '[Agent] Шаг 1/2 завершён. entities =',
          entities.length,
          ', question =',
          question,
        )
        const fragment = buildDomainFragment(
          domainSnapshot as Record<string, unknown>,
          entities,
        )
        streamBody = {
          message: text,
          sessionId,
          question: question || text,
          entities: JSON.stringify(fragment),
        }
      }
      else {
        const resolveErrBody = await resolveRes
          .text()
          .catch(() => '<no-body>')
        logLlm(`resolve.response.error:${resolveRes.status}`, resolveErrBody)
        streamBody = {
          message: text,
          sessionId,
          domain: domainSnapshot as object,
        }
      }
    }

    const bodySent = JSON.stringify(streamBody)
    console.log('[Agent] Отправленный JSON:', streamBody)
    logLlm('stream.request', streamBody)
    const res = await fetch(`${assistanceApiUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodySent,
      signal: abortController.signal,
    })
    if (!res.ok) {
      const errorRaw = await res.text().catch(() => '')
      logLlm(`stream.response.error:${res.status}`, errorRaw || '<no-body>')
      let data: { message?: string } = {}
      try {
        data = JSON.parse(errorRaw) as { message?: string }
      }
      catch {
        data = {}
      }
      const msg = data.message ?? ''
      messages.value[assistantIndex]!.text
        = msg === 'internal error' || res.status === 500
          ? 'Сервис ассистента или модель временно недоступны. Проверьте, что запущены сервис и Ollama.'
          : msg || `Ошибка ${res.status}`
      return
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) {
      messages.value[assistantIndex]!.text = 'Нет потока ответа.'
      return
    }
    let buffer = ''
    let iterateRawContent = ''
    let iterateParsedApplied = false
    let iterateActionsApplied = 0
    let iterateRequestedEntities = false
    const applyIterateParsed = async (p: {
      userAction?: Array<{ action: string, payload?: Record<string, unknown> }>
      isFinal?: boolean
      summary?: string
    }): Promise<void> => {
      logLlm('stream.parsed', p)
      const reqFilter = getRequestEntitiesFilter(p.userAction)
      if (reqFilter) {
        logLlm('stream.request-entities.filter', reqFilter)
        requestedEntitiesFilter.value = reqFilter
        iterateRequestedEntities = true
        toast.info('Контекст запрошен', {
          description:
            'Отправьте сообщение ещё раз — будет подставлен список сущностей по запросу.',
        })
      }
      const req = iterateUserActionToFrontendRequest(p.userAction)
      logLlm('stream.userAction.as-frontend-request', req)
      if (req) {
        const result = await applyFrontendRequest(req)
        logLlm('stream.userAction.apply-result', result)
        iterateActionsApplied += result.actionsExecuted
        if (result.actionsExecuted > 0) {
          toast.success(`Выполнено: ${result.actionsExecuted}`)
        }
        if (result.errors.length) {
          toast.warning(result.errors.slice(0, 2).join('; '))
        }
      }
      const summary = (p.summary ?? '').trim()
      if (summary) {
        messages.value[assistantIndex]!.text = summary
      }
      else if (iterateActionsApplied > 0) {
        messages.value[assistantIndex]!.text = 'Готово.'
      }
      else if (iterateRequestedEntities) {
        messages.value[assistantIndex]!.text
          = 'Нужен дополнительный контекст. Отправьте сообщение ещё раз.'
      }
      else if (p.isFinal) {
        messages.value[assistantIndex]!.text = 'Готово.'
      }
      pendingFrontendRequest.value = null
    }
    let streamDone = false
    while (!streamDone) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          logLlm('stream.sse.data', payload)
          if (payload === '[DONE]') {
            streamDone = true
            break
          }
          try {
            const data = JSON.parse(payload) as {
              content?: string
              thinking?: string
              parsed?: {
                userAction?: Array<{
                  action: string
                  payload?: Record<string, unknown>
                }>
                isFinal?: boolean
                summary?: string
              }
            }
            logLlm('stream.sse.parsed-json', data)
            if (data.content) {
              if (streamBody.userContext) {
                iterateRawContent += data.content
              }
              else {
                const current = messages.value[assistantIndex]!.text
                messages.value[assistantIndex]!.text
                  = current === '…' ? data.content : current + data.content
              }
            }
            if (data.parsed) {
              const p = data.parsed
              iterateParsedApplied = true
              await applyIterateParsed(p)
            }
          }
          catch {
            // игнорируем невалидную строку
          }
        }
      }
    }
    if (
      streamBody.userContext
      && !iterateParsedApplied
      && iterateRawContent.trim()
    ) {
      const normalized = iterateRawContent.trim()
      console.log('[Agent] Получен сырой JSON content:', normalized)
      const jsonBody = normalized.startsWith('```')
        ? normalized
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/\s*```$/, '')
            .trim()
        : normalized
      try {
        const parsedFallback = JSON.parse(jsonBody) as {
          userAction?: Array<{
            action: string
            payload?: Record<string, unknown>
          }>
          isFinal?: boolean
          summary?: string
        }
        logLlm('stream.fallback-parsed', parsedFallback)
        await applyIterateParsed(parsedFallback)
        iterateParsedApplied = true
      }
      catch {
        logLlm('stream.fallback-parse-failed', normalized)
        messages.value[assistantIndex]!.text = normalized
      }
    }
    if (
      !messages.value[assistantIndex]!.text
      || messages.value[assistantIndex]!.text === '…'
    ) {
      messages.value[assistantIndex]!.text = 'Нет ответа.'
    }
    else if (!streamBody.userContext) {
      const content = messages.value[assistantIndex]!.text ?? ''
      logLlm('stream.final-assistant-content', content)
      const ops = parseDomainOpsFromMessage(content)
      if (ops?.length) {
        const result = applyDomainOps(ops)
        if (result.applied > 0) {
          toast.success(`Применено изменений домена: ${result.applied}`)
        }
        if (result.errors.length) {
          toast.warning(result.errors.slice(0, 3).join('; '))
        }
      }
      const frontendReq = parseFrontendRequestFromMessage(content)
      logLlm('stream.frontend-request.parsed', frontendReq)
      if (frontendReq) {
        const result = await applyFrontendRequest(frontendReq)
        logLlm('stream.frontend-request.apply-result', result)
        if (result.actionsExecuted > 0) {
          toast.success(`Выполнено действий: ${result.actionsExecuted}`)
        }
        if (result.errors.length) {
          toast.warning(result.errors.slice(0, 2).join('; '))
        }
        pendingFrontendRequest.value = frontendReq.needs?.length
          ? frontendReq
          : null
      }
      else {
        pendingFrontendRequest.value = null
      }
    }
  }
  catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      messages.value[assistantIndex]!.text
        = messages.value[assistantIndex]!.text === '…'
          || !messages.value[assistantIndex]!.text
          ? 'Запрос остановлен.'
          : `${messages.value[assistantIndex]!.text}\n\n[Запрос остановлен]`
    }
    else {
      const err = e instanceof Error ? e.message : String(e)
      messages.value[assistantIndex]!.text
        = `Ошибка запроса: ${err}. Проверьте, что сервис ассистента запущен (${assistanceApiUrl}).`
    }
  }
  finally {
    sending.value = false
    abortController = null
  }
}

/** Запуск runtime по выбору пользователя (кнопка из choiceOptions в чате). */
function runCreateRuntimeChoice(option: FrontendNeedChoiceOption): void {
  const res = executeCreateRuntime(option.entityType, option.identity)
  if (res.ok) {
    toast.success('Runtime запущен', {
      description: option.label ?? res.message,
    })
    messages.value.push({
      role: 'user',
      text: option.label ? `Запускаю: ${option.label}` : 'Запускаю runtime.',
    })
  }
  else {
    toast.error('Не удалось запустить runtime', { description: res.message })
  }
}

/** Открытие документа по выбору пользователя (кнопка из openDocumentChoiceOptions в чате). */
function runOpenDocumentChoice(option: FrontendNeedOpenDocumentOption): void {
  const res = executeOpenDocumentChoice(option)
  if (res.ok) {
    toast.success('Документ открыт', {
      description: option.label ?? option.identity,
    })
    messages.value.push({
      role: 'user',
      text: option.label
        ? `Открываю: ${option.label}`
        : `Открываю ${option.documentType}: ${option.identity}`,
    })
  }
  else {
    toast.error('Не удалось открыть документ', { description: res.message })
  }
}

/** Отправляет контекст по потребностям из frontend-request (сущности домена) и получает продолжение ответа. При отсутствии сущностей в needs подставляет текущий открытый документ. */
async function sendContextForNeeds(): Promise<void> {
  const req = pendingFrontendRequest.value
  if (!req?.needs?.length || !assistanceApiUrl || sending.value) {
    return
  }
  let refs: EntityRef[] = req.needs.flatMap((n: FrontendNeed) =>
    (n.identities ?? []).map((id: string) => {
      const normalizedType = normalizeNeedEntityTypeToSliceKey(
        n.entityType ?? '',
      )
      return {
        type: normalizedType ?? 'queries',
        identity: id,
      }
    }),
  )
  if (!refs.length) {
    const tab = EndgeIDE.tabs.activeTab.value
    const payload = tab?.payload as
      | { documentId?: string, identity?: string, documentType?: string }
      | undefined
    const documentId = payload?.documentId ?? payload?.identity
    const documentType = payload?.documentType
    if (documentId && documentType) {
      const sliceKey = DOCUMENT_TYPE_TO_SLICE[documentType]
      if (sliceKey) {
        refs = [{ type: sliceKey, identity: documentId }]
      }
    }
    if (!refs.length) {
      toast.info('Нет открытого документа для отправки контекста.')
      return
    }
  }
  const domainSnapshot = await (typeof getDomainSnapshot === 'function'
    ? getDomainSnapshot()
    : Promise.resolve({}))
  const fragment = buildDomainFragment(
    domainSnapshot as Record<string, unknown>,
    refs,
  )
  const entitiesJson = JSON.stringify(fragment)
  const question
    = 'Продолжи ответ на основе переданного контекста (сущности по твоему запросу).'
  const sessionId = ensureSessionId()
  pendingFrontendRequest.value = null
  logLlm('send-context.refs', refs)
  logLlm('send-context.fragment', fragment)
  messages.value.push({
    role: 'user',
    text: 'Отправляю контекст по запросу агента.',
  })
  const assistantIndex = messages.value.length
  messages.value.push({ role: 'assistant', text: '…' })
  sending.value = true
  abortController = new AbortController()
  try {
    logLlm('send-context.stream.request', { question, sessionId, entitiesJson })
    const res = await fetch(`${assistanceApiUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, entities: entitiesJson, sessionId }),
      signal: abortController.signal,
    })
    if (!res.ok) {
      const errorRaw = await res.text().catch(() => '')
      logLlm(`send-context.stream.error:${res.status}`, errorRaw || '<no-body>')
      messages.value[assistantIndex]!.text = `Ошибка ${res.status}`
      return
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) {
      messages.value[assistantIndex]!.text = 'Нет потока ответа.'
      return
    }
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          logLlm('send-context.stream.sse.data', payload)
          if (payload === '[DONE]') {
            break
          }
          try {
            const data = JSON.parse(payload) as {
              content?: string
              thinking?: string
            }
            logLlm('send-context.stream.sse.parsed-json', data)
            if (data.content) {
              messages.value[assistantIndex]!.text
                = (messages.value[assistantIndex]!.text === '…'
                  ? ''
                  : messages.value[assistantIndex]!.text) + data.content
            }
          }
          catch {
            /* ignore */
          }
        }
      }
    }
    const content = messages.value[assistantIndex]!.text ?? ''
    logLlm('send-context.stream.final-assistant-content', content)
    if (content && content !== '…') {
      const ops = parseDomainOpsFromMessage(content)
      if (ops?.length) {
        const result = applyDomainOps(ops)
        if (result.applied > 0) {
          toast.success(`Применено изменений: ${result.applied}`)
        }
      }
      const frontendReq = parseFrontendRequestFromMessage(content)
      logLlm('send-context.stream.frontend-request.parsed', frontendReq)
      if (frontendReq) {
        const result = await applyFrontendRequest(frontendReq)
        logLlm('send-context.stream.frontend-request.apply-result', result)
        pendingFrontendRequest.value = frontendReq.needs?.length
          ? frontendReq
          : null
      }
    }
  }
  catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      messages.value[assistantIndex]!.text
        = `${messages.value[assistantIndex]!.text === '…' ? '' : messages.value[assistantIndex]!.text}\n\n[Остановлено]`
    }
    else {
      messages.value[assistantIndex]!.text
        = `Ошибка: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  finally {
    sending.value = false
    abortController = null
  }
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Статус + выбор модели (фон прозрачный) -->
    <div
      class="shrink-0 px-2 py-0.5 flex items-center gap-2 rounded-t-md border-b border-border text-[11px] font-medium bg-transparent"
    >
      <span
        v-if="agentStatus === 'online'"
        class="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0"
        aria-hidden
      />
      <span
        v-else-if="agentStatus === 'offline'"
        class="size-1.5 rounded-full bg-red-500 dark:bg-red-400 shrink-0"
        aria-hidden
      />
      <span
        v-else-if="agentStatus === 'checking'"
        class="size-1.5 rounded-full bg-muted-foreground/50 shrink-0"
        aria-hidden
      />
      <span
        class="truncate"
        :class="{
          'text-emerald-600 dark:text-emerald-400': agentStatus === 'online',
          'text-red-600 dark:text-red-400': agentStatus === 'offline',
          'text-muted-foreground':
            agentStatus === 'not-configured' || agentStatus === 'checking',
        }"
      >
        {{
          agentStatus === "online"
            ? "онлайн"
            : agentStatus === "offline"
              ? "не онлайн"
              : agentStatus === "checking"
                ? "проверка…"
                : "не настроено"
        }}
      </span>
      <select
        v-if="isAssistanceConfigured"
        v-model="selectedModel"
        class="ml-auto h-6 min-w-0 max-w-[120px] rounded border-0 bg-transparent text-[11px] font-medium text-foreground focus:ring-1 focus:ring-ring"
      >
        <option
          v-for="opt in MODEL_OPTIONS"
          :key="opt.value || 'default'"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
      <Tooltip v-if="isAssistanceConfigured">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            :class="
              viewMode === 'hints'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground'
            "
            aria-label="Режим подсказок"
            @click="viewMode = viewMode === 'hints' ? 'chat' : 'hints'"
          >
            <Lightbulb v-if="viewMode === 'chat'" class="size-4" />
            <MessageSquare v-else class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {{
            viewMode === "hints"
              ? "Переключить в чат"
              : "Подсказки по открытой вкладке"
          }}
        </TooltipContent>
      </Tooltip>
    </div>

    <!-- Режим подсказок: список действий агента по контексту вкладки -->
    <ScrollArea v-if="viewMode === 'hints'" class="flex-1 min-h-0 p-3">
      <div class="space-y-3">
        <p class="text-xs font-medium text-muted-foreground">
          Что может сделать агент
          <span v-if="activeDocumentType" class="normal-case">
            (открыт: {{ activeDocumentType }})</span>
        </p>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="(item, idx) in CONTEXT_HINTS"
            :key="idx"
            type="button"
            class="text-left rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm hover:bg-accent hover:border-primary/30 hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            :disabled="sending || !assistanceApiUrl"
            @click="sendSuggested(item.text)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </ScrollArea>

    <ScrollArea v-else class="flex-1 min-h-0 p-3">
      <div class="space-y-4">
        <!-- Быстрые вопросы при пустом чате -->
        <div
          v-if="
            isAssistanceConfigured && isChatEmpty && agentStatus === 'online'
          "
          class="rounded-lg border border-border/80 bg-muted/30 p-3"
        >
          <p class="text-xs font-medium text-muted-foreground mb-2.5">
            Быстрые вопросы
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="(item, idx) in SUGGESTED_PROMPTS"
              :key="idx"
              type="button"
              class="text-left rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm hover:bg-accent hover:border-primary/30 hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :disabled="sending"
              @click="sendSuggested(item.text)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="flex gap-2"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="msg.role === 'assistant'"
            class="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0"
          >
            <Bot class="size-3.5 text-primary" />
          </div>
          <div
            class="ChatMessage max-w-[85%] rounded-lg px-3 py-2 text-sm"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground ChatMessage--user'
                : 'bg-muted border ChatMessage--assistant'
            "
          >
            <div
              class="ChatMessage-body markdown-inline"
              v-html="renderMarkdown(msg.text)"
            />
          </div>
        </div>
      </div>
    </ScrollArea>

    <!-- Потребности из frontend-request: агент просит контекст или выбор варианта (create_runtime) -->
    <div
      v-if="
        viewMode === 'chat'
          && pendingFrontendRequest?.needs?.length
          && isAssistanceConfigured
      "
      class="shrink-0 px-3 py-2 border-t border-amber-500/40 bg-amber-500/5"
    >
      <p class="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1.5">
        Агент запрашивает
      </p>
      <template
        v-for="(need, idx) in pendingFrontendRequest.needs"
        :key="need.id || idx"
      >
        <div class="text-xs text-muted-foreground mb-2">
          {{ need.description }}
          <span
            v-if="
              need.entityType
                && need.identities?.length
                && !need.choiceOptions?.length
                && !need.openDocumentChoiceOptions?.length
            "
            class="text-[10px] opacity-80"
          >
            ({{ need.entityType }}: {{ need.identities.join(", ") }})
          </span>
        </div>
        <!-- Варианты выбора: что открыть (вид / таблица / запрос) -->
        <div
          v-if="need.openDocumentChoiceOptions?.length"
          class="flex flex-wrap gap-1.5 mb-2"
        >
          <Button
            v-for="(opt, oidx) in need.openDocumentChoiceOptions"
            :key="`doc-${oidx}`"
            size="sm"
            variant="outline"
            class="h-7 text-xs"
            @click="runOpenDocumentChoice(opt)"
          >
            {{ opt.label || `${opt.documentType}: ${opt.identity}` }}
          </Button>
        </div>
        <!-- Варианты выбора: что запустить в runtime -->
        <div
          v-else-if="need.choiceOptions?.length"
          class="flex flex-wrap gap-1.5 mb-2"
        >
          <Button
            v-for="(opt, oidx) in need.choiceOptions"
            :key="`rt-${oidx}`"
            size="sm"
            variant="outline"
            class="h-7 text-xs"
            @click="runCreateRuntimeChoice(opt)"
          >
            {{ opt.label || `${opt.entityType}: ${opt.identity}` }}
          </Button>
        </div>
      </template>
      <Button
        v-if="
          pendingFrontendRequest.needs.some(
            (n: FrontendNeed) =>
              !n.choiceOptions?.length && !n.openDocumentChoiceOptions?.length,
          )
        "
        size="sm"
        variant="secondary"
        class="h-7 text-xs"
        :disabled="sending"
        @click="sendContextForNeeds"
      >
        Отправить контекст
      </Button>
    </div>

    <div
      v-if="isAssistanceConfigured"
      class="shrink-0 p-3 border-t bg-background"
    >
      <div class="flex gap-2">
        <textarea
          v-model="input"
          placeholder="Опишите задачу или вопрос..."
          class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          rows="3"
          @keydown="onTextareaKeydown"
        />
        <div class="flex flex-col gap-1 shrink-0 self-end">
          <Button
            size="icon"
            class="size-9"
            :disabled="!input.trim() && !sending"
            :title="sending ? 'Остановить' : 'Отправить'"
            @click="sending ? stopRequest() : send(undefined)"
          >
            <Square v-if="sending" class="size-4" />
            <Send v-else class="size-4" />
          </Button>
          <Button
            size="icon"
            class="size-9"
            variant="outline"
            :disabled="sending"
            title="Очистить историю и начать новую сессию"
            @click="clearHistoryAndStartNewSession"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </div>
      <p class="text-[10px] text-muted-foreground mt-1.5">
        Enter — отправить, Shift+Enter — новая строка
      </p>
    </div>
  </div>
</template>

<style scoped>
.markdown-inline {
  line-height: 1.5;
  word-break: break-word;
}
.markdown-inline :deep(p) {
  margin: 0.35em 0;
}
.markdown-inline :deep(p:first-child) {
  margin-top: 0;
}
.markdown-inline :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-inline :deep(ul),
.markdown-inline :deep(ol) {
  margin: 0.35em 0;
  padding-left: 1.25em;
}
.markdown-inline :deep(ul) {
  list-style-type: disc;
}
.markdown-inline :deep(ol) {
  list-style-type: decimal;
}
.markdown-inline :deep(li) {
  margin: 0.15em 0;
}
.markdown-inline :deep(strong) {
  font-weight: 600;
}
.markdown-inline :deep(em) {
  font-style: italic;
}
.markdown-inline :deep(code) {
  font-size: 0.9em;
  padding: 0.15em 0.35em;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.08);
}
.dark .markdown-inline :deep(code) {
  background: rgba(255, 255, 255, 0.12);
}
.ChatMessage--user .markdown-inline :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}
.markdown-inline :deep(pre) {
  margin: 0.5em 0;
  padding: 0.6em 0.75em;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.06);
}
.dark .markdown-inline :deep(pre) {
  background: rgba(255, 255, 255, 0.08);
}
.ChatMessage--user .markdown-inline :deep(pre) {
  background: rgba(255, 255, 255, 0.15);
}
.markdown-inline :deep(pre code) {
  padding: 0;
  background: none;
}
.markdown-inline :deep(h1),
.markdown-inline :deep(h2),
.markdown-inline :deep(h3) {
  font-weight: 600;
  margin: 0.5em 0 0.25em;
  line-height: 1.3;
}
.markdown-inline :deep(h1) {
  font-size: 1.15em;
}
.markdown-inline :deep(h2) {
  font-size: 1.05em;
}
.markdown-inline :deep(h3) {
  font-size: 1em;
}
.markdown-inline :deep(a) {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-inline :deep(a:hover) {
  text-decoration: none;
}
.ChatMessage--user .markdown-inline :deep(a) {
  opacity: 0.95;
}
.markdown-inline :deep(blockquote) {
  margin: 0.35em 0;
  padding-left: 0.75em;
  border-left: 3px solid currentColor;
  opacity: 0.85;
}
</style>
