import type {
  EndgeWorkspaceStateBatchResult,
  EndgeWorkspaceStateEntry,
  EndgeWorkspaceStateOperation,
} from '@endge/core'

export interface UserSettingsContext {
  partition: string
  facets: Record<string, string>
  labels: Record<string, { facet: string, document: string }>
  driver: string
}

export interface UserSettingDefinition {
  key: string
  description: { ru: string, en: string }
  schema: { type: 'integer' | 'string' | 'object', minimum?: number, maximum?: number, enum?: string[], properties?: Record<string, unknown>, required?: string[] }
  default: number | string | null
}

export interface UserSettingsPerson {
  id: string
  username: string
  displayName: string
  count: number
}

export interface UserSettingsSnapshot {
  partition: string
  resetRevision: number
  entries: (EndgeWorkspaceStateEntry & { updatedAt: string })[]
}

export class UserSettingsHttpAdapter {
  public constructor(
    private readonly _baseUrl: string,
    private readonly _workspace: string,
  ) {}

  public context(facets: Readonly<Record<string, string>>, signal: AbortSignal): Promise<{
    current: UserSettingsContext | null
    catalog: UserSettingDefinition[]
  }> {
    return this._request('contexts', facets, signal)
  }

  public users(facets: Record<string, string>, search: string, after: string, signal: AbortSignal): Promise<{
    items: UserSettingsPerson[]
    next?: string
  }> {
    return this._request('users', facets, signal, { q: search, after })
  }

  public read(facets: Record<string, string>, user: string, signal: AbortSignal): Promise<UserSettingsSnapshot> {
    return this._request(`users/${encodeURIComponent(user)}`, facets, signal)
  }

  public save(facets: Record<string, string>, user: string, snapshot: UserSettingsSnapshot, operations: EndgeWorkspaceStateOperation[], signal: AbortSignal): Promise<EndgeWorkspaceStateBatchResult> {
    return this._request(`users/${encodeURIComponent(user)}`, facets, signal, {}, 'PATCH', { partition: snapshot.partition, resetRevision: snapshot.resetRevision, operations })
  }

  public reset(context: UserSettingsContext, userId: string | null, signal: AbortSignal): Promise<{ deleted: number }> {
    return this._request('reset', context.facets, signal, {}, 'POST', {
      partition: context.partition,
      ...(userId ? { userId } : {}),
      confirmation: userId ? 'reset-user' : 'reset-all',
    })
  }

  private async _request<T>(
    path: string,
    facets: Readonly<Record<string, string>>,
    signal: AbortSignal,
    params: Record<string, string> = {},
    method = 'GET',
    data?: unknown,
  ): Promise<T> {
    const query = new URLSearchParams({ facets: JSON.stringify(facets), ...params })
    const url = `${this._baseUrl.replace(/\/+$/, '')}/api/v1/user-state/admin/${path}?${query}`
    const response = await fetch(url, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: {
        'Accept': 'application/json',
        'X-Endge-Workspace': this._workspace,
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { code?: string } | null
      throw new Error(error?.code ?? `http_${response.status}`)
    }
    return response.json() as Promise<T>
  }
}
