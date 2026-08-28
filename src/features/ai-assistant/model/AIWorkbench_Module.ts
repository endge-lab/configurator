import type {
  AIAdapter,
  AICapabilities,
  AIClarification,
  AIClarificationCandidate,
  AIConversation,
  AICreateConnectionWithModel,
  AIMessage,
  AIModelProfile,
  AIProviderConnection,
  AIVisibility,
} from '@/features/ai-assistant/domain/types'

import { computed, reactive, readonly } from 'vue'

import { createWidgetInstance, getWidget, hideWidget, registerWidget, unregisterWidget } from '@/components/layouts/grid'
import { AIWorkbench_HTTP_Adapter } from '@/features/ai-assistant/adapters/AIWorkbench_HTTP_Adapter'
import { buildClarificationRunLinkage } from '@/features/ai-assistant/model/clarification'
import { AI_AGENT_WIDGET_DEFINITION, AI_AGENT_WIDGET_ID } from '@/features/ai-assistant/model/widget'

interface State {
  capabilities: AICapabilities | null
  conversation: AIConversation | null
  messages: AIMessage[]
  previousCursor: string
  streamingText: string
  loading: boolean
  running: boolean
  error: string
  selectedModelId: string
  managementOpen: boolean
  openClarification: AIClarification | null
}

class AIWorkbench_Module {
  /** Transport, resources и mutable state принадлежат модулю. */
  private _service: AIWorkbench_HTTP_Adapter | null = null
  private _timer: ReturnType<typeof setInterval> | null = null
  private _stream: AbortController | null = null
  private _initialized = false
  private readonly _state = reactive<State>({
    capabilities: null,
    conversation: null,
    messages: [],
    previousCursor: '',
    streamingText: '',
    loading: false,
    running: false,
    error: '',
    selectedModelId: '',
    managementOpen: false,
    openClarification: null,
  })

  /** Readonly reactive views для UI. */
  public readonly state = readonly(this._state)
  public readonly enabledModels = computed(() => this._state.capabilities?.models.filter(model => model.enabled) ?? [])

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  public async init(baseURL: string, workspaceIdentity: string): Promise<void> {
    if (this._initialized) {
      return
    }
    this._initialized = true
    this._service = new AIWorkbench_HTTP_Adapter(baseURL, workspaceIdentity)
    await this.refreshCapabilities()
    this._timer = setInterval(() => void this.refreshCapabilities(), 15_000)
  }

  public reset(): void {
    if (this._timer) {
      clearInterval(this._timer)
    }
    this._timer = null
    this._stream?.abort()
    this._stream = null
    this._unregisterWidget()
    this._initialized = false
    this._service = null
    Object.assign(this._state, { capabilities: null, conversation: null, messages: [], previousCursor: '', streamingText: '', loading: false, running: false, error: '', selectedModelId: '', managementOpen: false, openClarification: null })
  }

  public async refreshCapabilities(): Promise<void> {
    if (!this._service) {
      return
    }
    try {
      const previousAvailable = this._state.capabilities?.available === true
      const value = await this._service.capabilities()
      this._state.capabilities = value
      if (value.available && value.canView) {
        if (!this._state.conversation && !value.models.some(model => model.enabled && model.id === this._state.selectedModelId)) {
          const fallback = value.models.find(model => model.enabled && model.isDefault) ?? value.models.find(model => model.enabled)
          this._state.selectedModelId = fallback?.id ?? ''
        }
        this._registerWidget()
        if (!previousAvailable && !this._state.conversation) {
          await this.loadConversation()
        }
      }
      else {
        this._stream?.abort()
        this._unregisterWidget()
      }
    }
    catch {
      this._state.capabilities = null
      this._stream?.abort()
      this._unregisterWidget()
    }
  }

  public async loadConversation(): Promise<void> {
    this._state.loading = true
    this._state.error = ''
    try {
      this._state.conversation = await this._transport.activeConversation()
      const fallback = this.enabledModels.value.find(model => model.isDefault) ?? this.enabledModels.value[0]
      this._state.selectedModelId = this._state.conversation?.model.profileId ?? fallback?.id ?? ''
      await this._loadLatestMessages()
    }
    catch (error) {
      this._state.error = messageOf(error)
    }
    finally {
      this._state.loading = false
    }
  }

  public async loadPrevious(): Promise<void> {
    if (!this._state.conversation || !this._state.previousCursor || this._state.loading) {
      return
    }
    this._state.loading = true
    try {
      const page = await this._transport.messages(this._state.conversation.id, this._state.previousCursor)
      this._state.messages = [...page.items, ...this._state.messages]
      this._state.previousCursor = page.nextCursor ?? ''
    }
    finally {
      this._state.loading = false
    }
  }

  public async setModel(modelProfileId: string): Promise<void> {
    this._state.selectedModelId = modelProfileId
    if (this._state.conversation && this._state.conversation.messageCount === 0) {
      this._state.conversation = await this._transport.updateConversationModel(this._state.conversation.id, modelProfileId)
    }
  }

  public async newConversation(): Promise<void> {
    if (!this._state.selectedModelId) {
      return
    }
    this._state.conversation = await this._transport.resetConversation(this._state.conversation?.id ?? null, this._state.selectedModelId)
    this._state.messages = []
    this._state.previousCursor = ''
    this._state.streamingText = ''
    this._state.openClarification = null
  }

  public async send(prompt: string, selectedCandidate?: AIClarificationCandidate): Promise<void> {
    const text = prompt.trim()
    if (!text || !this._state.selectedModelId || this._state.running) {
      return
    }
    this._state.error = ''
    try {
      if (!this._state.conversation) {
        this._state.conversation = await this._transport.createConversation(this._state.selectedModelId)
      }
      this._state.messages.push({
        id: crypto.randomUUID(),
        conversationId: this._state.conversation.id,
        role: 'user',
        content: text,
        sequence: Number.MAX_SAFE_INTEGER - 1,
        createdAt: new Date().toISOString(),
      })
      this._state.running = true
      this._state.streamingText = ''
      this._stream = new AbortController()
      await this._transport.run(this._state.conversation.id, {
        requestId: crypto.randomUUID(),
        modelProfileId: this._state.selectedModelId,
        prompt: text,
        ...buildClarificationRunLinkage(this._state.openClarification, selectedCandidate),
      }, event => this._acceptEvent(event), this._stream.signal)
      await this._loadLatestMessages()
    }
    catch (error) {
      if (!this._stream?.signal.aborted) {
        this._state.error = messageOf(error)
      }
    }
    finally {
      this._state.running = false
      this._state.streamingText = ''
      this._stream = null
    }
  }

  public answerClarification(candidate: AIClarificationCandidate): Promise<void> {
    return this.send(candidate.displayName || candidate.identity, candidate)
  }

  public startIndependentQuestion(): void {
    this._state.openClarification = null
    this._state.error = ''
  }

  /** Открывает общее окно настройки public/private AI connections. */
  public openManagement(): void {
    this._state.managementOpen = true
  }

  /** Закрывает окно настройки AI connections. */
  public closeManagement(): void {
    this._state.managementOpen = false
  }

  /** Загружает доступные provider adapters для management UI. */
  public listProviderAdapters(): Promise<{ items: AIAdapter[] }> {
    return this._transport.adapters()
  }

  /** Загружает provider connections для management UI. */
  public listProviderConnections(): Promise<{ items: AIProviderConnection[], total: number }> {
    return this._transport.connections()
  }

  /** Загружает model profiles для management UI. */
  public listModelProfiles(): Promise<{ items: AIModelProfile[], total: number }> {
    return this._transport.models()
  }

  /** Создаёт provider connection через transport adapter. */
  public createProviderConnection(value: { name: string, adapter: AIAdapter, baseUrl: string, credential: string, visibility: AIVisibility, enabled: boolean }): Promise<AIProviderConnection> {
    return this._transport.createConnection(value)
  }

  /** Атомарно создаёт provider connection и первый model profile. */
  public createProviderConnectionWithModel(value: AICreateConnectionWithModel): Promise<{ connection: AIProviderConnection, model: AIModelProfile }> {
    return this._transport.createConnectionWithModel(value)
  }

  /** Изменяет provider connection через transport adapter. */
  public updateProviderConnection(id: string, value: { name?: string, baseUrl?: string, enabled?: boolean }): Promise<AIProviderConnection> {
    return this._transport.patchConnection(id, value)
  }

  /** Заменяет credential provider connection. */
  public replaceProviderCredential(id: string, credential: string): Promise<AIProviderConnection> {
    return this._transport.replaceCredential(id, credential)
  }

  /** Удаляет provider connection. */
  public deleteProviderConnection(id: string): Promise<void> {
    return this._transport.deleteConnection(id)
  }

  /** Создаёт model profile через transport adapter. */
  public createModelProfile(value: { connectionId: string, providerModelId: string, displayName: string, enabled: boolean, isDefault: boolean }): Promise<AIModelProfile> {
    return this._transport.createModel(value)
  }

  /** Изменяет model profile через transport adapter. */
  public updateModelProfile(id: string, value: { providerModelId?: string, displayName?: string, enabled?: boolean, isDefault?: boolean }): Promise<AIModelProfile> {
    return this._transport.patchModel(id, value)
  }

  /** Удаляет model profile. */
  public deleteModelProfile(id: string): Promise<void> {
    return this._transport.deleteModel(id)
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  private async _loadLatestMessages(): Promise<void> {
    if (!this._state.conversation) {
      this._state.messages = []
      this._state.previousCursor = ''
      this._state.openClarification = null
      return
    }
    const page = await this._transport.messages(this._state.conversation.id)
    this._state.messages = page.items
    this._state.previousCursor = page.nextCursor ?? ''
    this._state.openClarification = page.openClarification ?? null
  }

  private _acceptEvent(event: { type: string, delta?: string, errorMessage?: string, clarification?: AIClarification }): void {
    if (event.type === 'content_delta') {
      this._state.streamingText += event.delta ?? ''
    }
    if (event.type === 'failed') {
      this._state.error = event.errorMessage || 'Не удалось получить ответ'
    }
    if (event.type === 'clarification_required') {
      this._state.openClarification = event.clarification ?? null
    }
  }

  private _registerWidget(): void {
    const widget = getWidget(AI_AGENT_WIDGET_ID)
    if (widget?.instances.length) {
      return
    }
    if (!widget) {
      registerWidget(AI_AGENT_WIDGET_DEFINITION)
    }
    createWidgetInstance(AI_AGENT_WIDGET_ID, {}, { activate: false })
  }

  /** Сворачивает dock-area перед удалением недоступного AI-виджета. */
  private _unregisterWidget(): void {
    hideWidget(AI_AGENT_WIDGET_ID)
    unregisterWidget(AI_AGENT_WIDGET_ID)
  }

  /**
   * ----------------------------------------
   * ACCESS
   * ----------------------------------------
   */

  /** Возвращает transport adapter только внутренним operations модуля. */
  private get _transport(): AIWorkbench_HTTP_Adapter {
    if (!this._service) {
      throw new Error('AI Workbench is not initialized')
    }
    return this._service
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

export const AIWorkbench = new AIWorkbench_Module()
