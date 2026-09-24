import type { BackendConnectionListResponse, BackendConnectionsService } from '@/features/backend-connections/domain/types/backend-connection.type'

import { normalizeBackendURL } from '@/features/backend-connections/services/backend-connection-storage'

export class BackendConnectionServiceError extends Error {
  public constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message)
    this.name = 'BackendConnectionServiceError'
  }
}

/**
 * Единственный сетевой adapter каталога выбранной среды.
 */
export class BackendConnectionsHttp_Adapter implements BackendConnectionsService {
  public constructor(private readonly _fixedBackendURL?: string) {}

  public async list(backendURL?: string): Promise<BackendConnectionListResponse> {
    return this._request<BackendConnectionListResponse>(backendURL, '/api/v1/backend-connections')
  }

  public async create(name: string, baseUrl: string, backendURL?: string): Promise<void> {
    await this._request(backendURL, '/api/v1/backend-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, baseUrl }),
    })
  }

  public async delete(id: string, backendURL?: string): Promise<void> {
    await this._request(backendURL, `/api/v1/backend-connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  private async _request<T = void>(backendURL: string | undefined, path: string, init: RequestInit = {}): Promise<T> {
    const baseURL = normalizeBackendURL(backendURL ?? this._fixedBackendURL)
    let response: Response
    try {
      response = await fetch(`${baseURL}${path}`, {
        ...init,
        credentials: 'include',
        headers: { Accept: 'application/json', ...init.headers },
      })
    }
    catch (error) {
      throw new BackendConnectionServiceError(
        'backend_catalog_unavailable',
        error instanceof Error ? error.message : 'Backend connection catalog is unavailable',
        0,
      )
    }
    if (response.ok) {
      if (response.status === 204) {
        return undefined as T
      }
      return await response.json() as T
    }
    const payload = await readError(response)
    throw new BackendConnectionServiceError(
      payload.code || 'backend_catalog_request_failed',
      payload.message || `Backend connection catalog request failed with ${response.status}`,
      response.status,
    )
  }
}

async function readError(response: Response): Promise<{ code: string, message: string }> {
  try {
    const payload = await response.json() as Record<string, unknown>
    return {
      code: typeof payload.code === 'string' ? payload.code : '',
      message: typeof payload.message === 'string' ? payload.message : '',
    }
  }
  catch {
    return { code: '', message: '' }
  }
}
