import type { AICapabilities, AIConversation, AIMessage } from '@/features/ai-assistant/domain/types'

import { computed, reactive, readonly } from 'vue'

import { createWidgetInstance, getWidget, registerWidget, unregisterWidget } from '@/components/layouts/grid'
import { AIWorkbench_HTTP_Adapter } from '@/features/ai-assistant/adapters/AIWorkbench_HTTP_Adapter'
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
}

class AIWorkbench_Module {
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
  })

  public readonly state = readonly(this._state)
  public readonly enabledModels = computed(() => this._state.capabilities?.models.filter(model => model.enabled) ?? [])

  public get service(): AIWorkbench_HTTP_Adapter {
    if (!this._service) {
      throw new Error('AI Workbench is not initialized')
    }
    return this._service
  }

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
    unregisterWidget(AI_AGENT_WIDGET_ID)
    this._initialized = false
    this._service = null
    Object.assign(this._state, { capabilities: null, conversation: null, messages: [], previousCursor: '', streamingText: '', loading: false, running: false, error: '', selectedModelId: '' })
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
        unregisterWidget(AI_AGENT_WIDGET_ID)
      }
    }
    catch {
      this._state.capabilities = null
      this._stream?.abort()
      unregisterWidget(AI_AGENT_WIDGET_ID)
    }
  }

  public async loadConversation(): Promise<void> {
    this._state.loading = true
    this._state.error = ''
    try {
      this._state.conversation = await this.service.activeConversation()
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
      const page = await this.service.messages(this._state.conversation.id, this._state.previousCursor)
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
      this._state.conversation = await this.service.updateConversationModel(this._state.conversation.id, modelProfileId)
    }
  }

  public async newConversation(): Promise<void> {
    if (!this._state.selectedModelId) {
      return
    }
    this._state.conversation = await this.service.resetConversation(this._state.conversation?.id ?? null, this._state.selectedModelId)
    this._state.messages = []
    this._state.previousCursor = ''
    this._state.streamingText = ''
  }

  public async send(prompt: string): Promise<void> {
    const text = prompt.trim()
    if (!text || !this._state.selectedModelId || this._state.running) {
      return
    }
    this._state.error = ''
    try {
      if (!this._state.conversation) {
        this._state.conversation = await this.service.createConversation(this._state.selectedModelId)
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
      await this.service.run(this._state.conversation.id, {
        requestId: crypto.randomUUID(),
        modelProfileId: this._state.selectedModelId,
        prompt: text,
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

  private async _loadLatestMessages(): Promise<void> {
    if (!this._state.conversation) {
      this._state.messages = []
      this._state.previousCursor = ''
      return
    }
    const page = await this.service.messages(this._state.conversation.id)
    this._state.messages = page.items
    this._state.previousCursor = page.nextCursor ?? ''
  }

  private _acceptEvent(event: { type: string, delta?: string, errorMessage?: string }): void {
    if (event.type === 'content_delta') {
      this._state.streamingText += event.delta ?? ''
    }
    if (event.type === 'failed') {
      this._state.error = event.errorMessage || 'Не удалось получить ответ'
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
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

export const AIWorkbench = new AIWorkbench_Module()
