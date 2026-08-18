import type { DomainVersionTarget, DomainVersionTargetState } from '@/features/domain-version/domain/types/domain-version.type'
import type { DomainVersion_Service } from '@/features/domain-version/model/DomainVersion_Service'

import { normalizeBackendURL } from '@/features/backend-connections/model/backend-connection-storage'
import { DomainVersionServiceError } from '@/features/domain-version/model/DomainVersion_Service'

const cacheLifetimeMs = 20_000

export class DomainVersions_Module {
  private readonly _states = new Map<string, DomainVersionTargetState>()
  private readonly _requests = new Map<string, Promise<void>>()
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: DomainVersion_Service) {}

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  public state(target: DomainVersionTarget | null): DomainVersionTargetState {
    if (!target?.workspace) {
      return { status: 'error', code: 'workspace_not_selected', message: 'Workspace is not selected', loadedAt: 0 }
    }
    return this._states.get(targetKey(target)) ?? { status: 'idle' }
  }

  public async refresh(target: DomainVersionTarget, force = false): Promise<void> {
    if (!target.workspace) {
      return
    }
    const key = targetKey(target)
    const current = this._states.get(key)
    if (!force && current?.status === 'ready' && Date.now() - current.loadedAt < cacheLifetimeMs) {
      return
    }
    const pending = this._requests.get(key)
    if (pending) {
      return pending
    }
    this._states.set(key, { status: 'loading' })
    this._notify()
    const request = this._service.get(target)
      .then((value) => {
        this._states.set(key, { status: 'ready', value, loadedAt: Date.now() })
      })
      .catch((error: unknown) => {
        const value = error instanceof DomainVersionServiceError
          ? error
          : new DomainVersionServiceError('request_failed', error instanceof Error ? error.message : String(error), 0)
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

  public async refreshMany(targets: DomainVersionTarget[], force = false): Promise<void> {
    await Promise.allSettled(targets.map(target => this.refresh(target, force)))
  }

  public invalidate(target: DomainVersionTarget): void {
    this._states.delete(targetKey(target))
    this._notify()
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}

function targetKey(target: DomainVersionTarget): string {
  return `${normalizeBackendURL(target.backendURL)}\n${target.workspace.trim()}`
}
