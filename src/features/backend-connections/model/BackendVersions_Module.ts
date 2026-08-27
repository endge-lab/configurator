import type { BackendVersionState } from '@/features/backend-connections/domain/types/backend-version.type'
import type { BackendVersionHttp_Adapter } from '@/features/backend-connections/model/adapters/BackendVersionHttp_Adapter'

import { BackendVersionServiceError } from '@/features/backend-connections/model/adapters/BackendVersionHttp_Adapter'
import { normalizeBackendURL } from '@/features/backend-connections/model/backend-connection-storage'

const cacheLifetimeMs = 20_000

export class BackendVersions_Module {
  private readonly _states = new Map<string, BackendVersionState>()
  private readonly _requests = new Map<string, Promise<void>>()
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: BackendVersionHttp_Adapter) {}

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  public state(backendURL: string): BackendVersionState {
    return this._states.get(normalizeBackendURL(backendURL)) ?? { status: 'idle' }
  }

  public async refresh(backendURL: string, force = false): Promise<void> {
    const key = normalizeBackendURL(backendURL)
    const current = this._states.get(key)
    if (!force && current?.status === 'ready' && Date.now() - current.loadedAt < cacheLifetimeMs) {
      return
    }
    const pending = this._requests.get(key)
    if (pending) {
      return pending
    }

    if (current?.status !== 'ready') {
      this._states.set(key, { status: 'loading' })
      this._notify()
    }
    const request = this._service.get(key)
      .then((value) => {
        this._states.set(key, { status: 'ready', value, loadedAt: Date.now() })
      })
      .catch((error: unknown) => {
        const value = error instanceof BackendVersionServiceError
          ? error
          : new BackendVersionServiceError('request_failed', error instanceof Error ? error.message : String(error), 0)
        this._states.set(key, {
          status: 'error',
          code: value.code,
          message: value.message,
          loadedAt: Date.now(),
        })
      })
      .finally(() => {
        this._requests.delete(key)
        this._notify()
      })
    this._requests.set(key, request)
    return request
  }

  public async refreshMany(backendURLs: string[], force = false): Promise<void> {
    await Promise.allSettled(backendURLs.map(backendURL => this.refresh(backendURL, force)))
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}
