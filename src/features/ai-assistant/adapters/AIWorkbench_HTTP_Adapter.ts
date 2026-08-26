import type {
  AIAdapter,
  AICapabilities,
  AIConversation,
  AIMessage,
  AIModelProfile,
  AIProviderConnection,
  AIRunEvent,
} from '@/features/ai-assistant/domain/types'

export class AIWorkbenchHTTPError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export class AIWorkbench_HTTP_Adapter {
  private readonly _baseURL: string

  public constructor(baseURL: string, private readonly _workspaceIdentity: string) {
    this._baseURL = String(baseURL).replace(/\/+$/, '')
  }

  public capabilities(signal?: AbortSignal): Promise<AICapabilities> {
    return this._json('/api/v1/ai/capabilities', { signal })
  }

  public async activeConversation(): Promise<AIConversation | null> {
    const page = await this._json<{ items: AIConversation[] }>('/api/v1/ai/conversations?limit=50')
    return page.items.find(item => !item.archived) ?? null
  }

  public createConversation(modelProfileId: string): Promise<AIConversation> {
    return this._json('/api/v1/ai/conversations', {
      method: 'POST',
      body: { modelProfileId },
    })
  }

  public resetConversation(currentConversationId: string | null, modelProfileId: string): Promise<AIConversation> {
    return this._json('/api/v1/ai/conversations/reset', {
      method: 'POST',
      body: {
        currentConversationId: currentConversationId ?? '',
        modelProfileId,
      },
    })
  }

  public updateConversationModel(id: string, modelProfileId: string): Promise<AIConversation> {
    return this._json(`/api/v1/ai/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { modelProfileId },
    })
  }

  public messages(id: string, cursor = ''): Promise<{ items: AIMessage[], nextCursor?: string }> {
    const query = new URLSearchParams({ limit: '50' })
    if (cursor) {
      query.set('cursor', cursor)
    }
    return this._json(`/api/v1/ai/conversations/${encodeURIComponent(id)}/messages?${query}`)
  }

  public async run(
    id: string,
    input: { requestId: string, modelProfileId: string, prompt: string },
    onEvent: (event: AIRunEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await this._fetch(`/api/v1/ai/conversations/${encodeURIComponent(id)}/runs`, {
      method: 'POST',
      body: input,
      signal,
      accept: 'text/event-stream',
    })
    if (!response.body) {
      throw new AIWorkbenchHTTPError('ai.stream_invalid', 'Backend did not return an event stream', 502)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
        if (data) {
          onEvent(JSON.parse(data) as AIRunEvent)
        }
        boundary = buffer.indexOf('\n\n')
      }
      if (done) {
        break
      }
    }
  }

  public adapters(): Promise<{ items: AIAdapter[] }> {
    return this._json('/api/v1/ai/provider-adapters')
  }

  public connections(): Promise<{ items: AIProviderConnection[], total: number }> {
    return this._json('/api/v1/ai/provider-connections')
  }

  public models(): Promise<{ items: AIModelProfile[], total: number }> {
    return this._json('/api/v1/ai/model-profiles')
  }

  public createConnection(value: { name: string, adapter: AIAdapter, baseUrl: string, credential: string, enabled: boolean }): Promise<AIProviderConnection> {
    return this._json('/api/v1/ai/provider-connections', { method: 'POST', body: value })
  }

  public patchConnection(id: string, value: { name?: string, baseUrl?: string, enabled?: boolean }): Promise<AIProviderConnection> {
    return this._json(`/api/v1/ai/provider-connections/${encodeURIComponent(id)}`, { method: 'PATCH', body: value })
  }

  public replaceCredential(id: string, credential: string): Promise<AIProviderConnection> {
    return this._json(`/api/v1/ai/provider-connections/${encodeURIComponent(id)}/credential`, {
      method: 'PUT',
      body: { credential },
    })
  }

  public deleteConnection(id: string): Promise<void> {
    return this._empty(`/api/v1/ai/provider-connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  public createModel(value: { connectionId: string, providerModelId: string, displayName: string, enabled: boolean, isDefault: boolean }): Promise<AIModelProfile> {
    return this._json('/api/v1/ai/model-profiles', { method: 'POST', body: value })
  }

  public patchModel(id: string, value: { providerModelId?: string, displayName?: string, enabled?: boolean, isDefault?: boolean }): Promise<AIModelProfile> {
    return this._json(`/api/v1/ai/model-profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: value })
  }

  public deleteModel(id: string): Promise<void> {
    return this._empty(`/api/v1/ai/model-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  private async _empty(path: string, options: RequestOptions): Promise<void> {
    await this._fetch(path, options)
  }

  private async _json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this._fetch(path, options)
    return await response.json() as T
  }

  private async _fetch(path: string, options: RequestOptions): Promise<Response> {
    let response: Response
    try {
      response = await fetch(`${this._baseURL}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        signal: options.signal,
        headers: {
          'accept': options.accept ?? 'application/json',
          'X-Endge-Workspace': this._workspaceIdentity,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
    }
    catch (error) {
      if (options.signal?.aborted) {
        throw error
      }
      throw new AIWorkbenchHTTPError('ai.backend_unavailable', error instanceof Error ? error.message : 'Backend is unavailable', 503)
    }
    if (response.ok) {
      return response
    }
    const payload = await response.json().catch(() => ({})) as { code?: string, message?: string }
    throw new AIWorkbenchHTTPError(payload.code ?? `http_${response.status}`, payload.message ?? `Request failed with ${response.status}`, response.status)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  accept?: string
}
