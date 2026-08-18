import type { BackendVersion } from '@/features/backend-connections/domain/types/backend-version.type'

import { normalizeBackendURL } from '@/features/backend-connections/model/backend-connection-storage'

export class BackendVersionServiceError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'BackendVersionServiceError'
  }
}

export class BackendVersion_Service {
  public async get(backendURL: string): Promise<BackendVersion> {
    const baseURL = normalizeBackendURL(backendURL)
    let response: Response
    try {
      response = await fetch(`${baseURL}/version`, {
        headers: { Accept: 'application/json' },
      })
    }
    catch (error) {
      throw new BackendVersionServiceError(
        'unavailable',
        error instanceof Error ? error.message : 'Backend is unavailable',
        0,
      )
    }

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      throw new BackendVersionServiceError(
        response.status === 404 ? 'unsupported' : 'request_failed',
        typeof payload.message === 'string' ? payload.message : `Backend returned ${response.status}`,
        response.status,
      )
    }

    const version = typeof payload.version === 'string' ? payload.version.trim() : ''
    if (!version) {
      throw new BackendVersionServiceError('invalid_response', 'Backend returned an empty version', response.status)
    }

    return {
      service: typeof payload.service === 'string' ? payload.service : '',
      version,
      env: typeof payload.env === 'string' ? payload.env : '',
    }
  }
}
