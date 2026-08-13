import type {
  AccessControlUser,
  AccessGrant,
  AccessScopeType,
  BulkAccessGrantInput,
  BulkAccessGrantResult,
  CursorPage,
  PutAccessGrantInput,
} from '@/features/access-control/domain/types/access-control.type'

export class AccessControl_Service {
  public constructor(private readonly _baseURL: string) {}

  public searchUsers(query: string, workspaceIdentity: string | undefined, cursor = '', signal?: AbortSignal): Promise<CursorPage<AccessControlUser>> {
    const params = new URLSearchParams({ q: query, limit: '20' })
    if (workspaceIdentity) {
      params.set('workspaceIdentity', workspaceIdentity)
    }
    if (cursor) {
      params.set('cursor', cursor)
    }
    return this._request(`/api/v1/service-users/search?${params}`, { signal })
  }

  public listGrants(scopeType: AccessScopeType, workspaceIdentity?: string, query = '', cursor = '', userId = ''): Promise<CursorPage<AccessGrant>> {
    const params = new URLSearchParams({ scopeType, limit: '50' })
    if (workspaceIdentity) {
      params.set('workspaceIdentity', workspaceIdentity)
    }
    if (query) {
      params.set('q', query)
    }
    if (cursor) {
      params.set('cursor', cursor)
    }
    if (userId) {
      params.set('userId', userId)
    }
    return this._request(`/api/v1/access-grants?${params}`)
  }

  public putGrant(input: PutAccessGrantInput): Promise<AccessGrant> {
    return this._request('/api/v1/access-grants', { method: 'PUT', body: JSON.stringify(input) })
  }

  public async deleteGrant(id: string): Promise<void> {
    await this._request(`/api/v1/access-grants/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  public bulkWorkspaceGrants(input: BulkAccessGrantInput): Promise<BulkAccessGrantResult> {
    return this._request('/api/v1/access-grants/bulk-workspaces', { method: 'POST', body: JSON.stringify(input) })
  }

  private async _request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this._baseURL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
    if (response.status === 204) {
      return undefined as T
    }
    const payload = await response.json().catch(() => ({})) as { code?: string, message?: string }
    if (!response.ok) {
      const error = new Error(payload.message || `Access control request failed with ${response.status}`) as Error & { code?: string, status?: number }
      error.code = payload.code
      error.status = response.status
      throw error
    }
    return payload as T
  }
}
