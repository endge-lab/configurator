import type { ShallowRef } from 'vue'
import type { CatalogModule, ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'

import { shallowRef } from 'vue'

type CatalogState
  = | { status: 'idle' | 'loading' | 'ready', entries: readonly CatalogModule[] }
    | { status: 'error', entries: readonly CatalogModule[], message: string }

export class EndgeIDEModuleCatalog_Module {
  private readonly _state = shallowRef<CatalogState>({ status: 'idle', entries: [] })
  private _request: AbortController | undefined
  private _generation = 0

  public readonly state: Readonly<ShallowRef<CatalogState>> = this._state

  public constructor(private readonly _transport: ServiceBackendModulesHttpAdapter) {}

  public get transport(): ServiceBackendModulesHttpAdapter {
    return this._transport
  }

  public async refresh(): Promise<void> {
    this._request?.abort()
    const request = new AbortController()
    this._request = request
    const entries = this._state.value.entries
    this._state.value = { status: 'loading', entries }
    try {
      const fresh = await this._transport.list(request.signal)
      if (!request.signal.aborted) {
        this._state.value = { status: 'ready', entries: fresh }
      }
    }
    catch (error) {
      if (!request.signal.aborted) {
        this._state.value = { status: 'error', entries, message: error instanceof Error ? error.message : String(error) }
      }
    }
    finally {
      if (this._request === request) {
        this._request = undefined
      }
    }
  }

  public async create(input: Pick<CatalogModule, 'identity' | 'name' | 'description'>, archive: File) {
    const generation = this._generation
    const entry = await this._transport.create(input, archive)
    if (generation === this._generation) {
      void this.refresh()
    }
    return entry
  }

  public async edit(input: CatalogModule) {
    const generation = this._generation
    const entry = await this._transport.patch(input)
    if (generation === this._generation) {
      void this.refresh()
    }
    return entry
  }

  public listArchived() {
    return this._transport.listArchived()
  }

  public async softDelete(input: CatalogModule): Promise<void> {
    const generation = this._generation
    await this._transport.softDelete(input)
    if (generation === this._generation) {
      const state = this._state.value
      this._state.value = { ...state, entries: state.entries.filter(entry => entry.identity !== input.identity) }
      void this.refresh()
    }
  }

  public async restore(input: Pick<CatalogModule, 'identity' | 'revision'>): Promise<void> {
    const generation = this._generation
    await this._transport.restore(input)
    if (generation === this._generation) {
      void this.refresh()
    }
  }

  public reset(): void {
    this._generation += 1
    this._request?.abort()
    this._request = undefined
    this._state.value = { status: 'idle', entries: [] }
  }
}
