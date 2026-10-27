import type {
  AgentAccessActor,
  AgentAccessOwnerFilter,
  AgentAccessToken,
  AgentAccessTokenList,
  CreateAgentAccessTokenInput,
  CreatedAgentAccessToken,
} from '@/features/agent-access/domain/types/agent-access.type'

type RecordValue = Record<string, unknown>

// Сырая ревизия документа: только поля, нужные истории.
export interface AgentAccessRevisionRecord {
  id: string
  revisionNumber: number
  operation: string
  createdAt: string
  createdBy: AgentAccessActor
  accessTokenId?: string
  // Имя токена из backend (`accessTokenName`), если токен ещё существует.
  accessTokenName?: string
}

// Страница истории ревизий: `total` — общее число ревизий документа.
export interface AgentAccessRevisionPage {
  items: AgentAccessRevisionRecord[]
  total: number
}

/**
 * Ошибка backend персональных токенов с машинным кодом ответа.
 */
export class AgentAccessError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details: RecordValue = {},
  ) {
    super(message)
    this.name = 'AgentAccessError'
  }
}

/**
 * HTTP transport персональных токенов агентов и истории ревизий документа.
 * Работает cookie-сессией Configurator; секрет токена не логируется.
 */
export class AgentAccessHttp_Adapter {
  private readonly _baseURL: string

  public constructor(baseURL: string) {
    this._baseURL = baseURL.replace(/\/+$/, '')
  }

  public async listTokens(owner: AgentAccessOwnerFilter): Promise<AgentAccessTokenList> {
    const payload = await this._json(`/api/v1/access-tokens?owner=${owner}`, { method: 'GET' })
    const items = Array.isArray(payload.items) ? payload.items.flatMap(normalizeToken) : []
    const maxTtlSeconds = Number(payload.maxTtlSeconds)
    return {
      items,
      maxTtlSeconds: Number.isFinite(maxTtlSeconds) && maxTtlSeconds > 0 ? maxTtlSeconds : null,
    }
  }

  public async createToken(input: CreateAgentAccessTokenInput): Promise<CreatedAgentAccessToken> {
    const payload = await this._json('/api/v1/access-tokens', { method: 'POST', body: input })
    const token = typeof payload.token === 'string' ? payload.token : ''
    const [accessToken] = normalizeToken(payload.accessToken)
    if (!token || !accessToken) {
      throw new AgentAccessError('Backend returned an invalid access token response', 'access_token_response_invalid', 200)
    }
    return { token, accessToken }
  }

  public async revokeToken(id: string): Promise<void> {
    await this._json(`/api/v1/access-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /**
   * Страница истории ревизий без снимков документа (`snapshot=false`), от новых к старым.
   */
  public async listDocumentRevisions(
    workspaceIdentity: string,
    collection: string,
    identity: string,
    page: { limit: number, offset: number },
  ): Promise<AgentAccessRevisionPage> {
    const query = new URLSearchParams({ snapshot: 'false', limit: String(page.limit), offset: String(page.offset) })
    const path = `/api/v1/domain/documents/${encodeURIComponent(collection)}/${encodeURIComponent(identity)}/revisions?${query}`
    const payload = await this._json(path, { method: 'GET', workspaceIdentity })
    const items = Array.isArray(payload.items) ? payload.items.flatMap(normalizeRevision) : []
    const total = Number(payload.total)
    return { items, total: Number.isFinite(total) && total >= 0 ? total : page.offset + items.length }
  }

  private async _json(
    path: string,
    options: { method: 'GET' | 'POST' | 'DELETE', body?: unknown, workspaceIdentity?: string },
  ): Promise<RecordValue> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (options.workspaceIdentity) {
      headers['X-Endge-Workspace'] = options.workspaceIdentity
    }
    let response: Response
    try {
      response = await fetch(`${this._baseURL}${path}`, {
        method: options.method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    }
    catch {
      throw new AgentAccessError('Backend is unavailable', 'service_backend_unavailable', 0)
    }
    if (response.status === 204) {
      return {}
    }
    const payload = await response.json().catch(() => ({})) as RecordValue
    if (!response.ok) {
      throw new AgentAccessError(
        typeof payload.message === 'string' ? payload.message : `Access token request failed with ${response.status}`,
        typeof payload.code === 'string' ? payload.code : '',
        response.status,
        isRecord(payload.details) ? payload.details : {},
      )
    }
    return isRecord(payload) ? payload : {}
  }
}

function normalizeToken(value: unknown): AgentAccessToken[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.tokenPrefix !== 'string') {
    return []
  }
  const scope = value.scope === 'write' ? 'write' : 'read'
  const status = value.status === 'revoked' || value.status === 'expired' ? value.status : 'active'
  return [{
    id: value.id,
    owner: normalizeActor(value.owner),
    workspaceIdentity: stringValue(value.workspaceIdentity),
    workspaceDisplayName: optionalString(value.workspaceDisplayName),
    name: stringValue(value.name),
    description: optionalString(value.description),
    scope,
    commit: value.commit === true,
    delete: value.delete === true,
    tokenPrefix: value.tokenPrefix,
    status,
    createdAt: stringValue(value.createdAt),
    expiresAt: stringValue(value.expiresAt),
    lastUsedAt: optionalString(value.lastUsedAt),
    revokedAt: optionalString(value.revokedAt),
  }]
}

function normalizeRevision(value: unknown): AgentAccessRevisionRecord[] {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return []
  }
  return [{
    id: value.id,
    revisionNumber: Number(value.revisionNumber) || 0,
    operation: stringValue(value.operation),
    createdAt: stringValue(value.createdAt),
    createdBy: normalizeActor(value.createdBy),
    accessTokenId: optionalString(value.accessTokenId),
    accessTokenName: optionalString(value.accessTokenName),
  }]
}

function normalizeActor(value: unknown): AgentAccessActor {
  if (!isRecord(value)) {
    return { id: '' }
  }
  return {
    id: stringValue(value.id),
    username: optionalString(value.username),
    displayName: optionalString(value.displayName),
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}
