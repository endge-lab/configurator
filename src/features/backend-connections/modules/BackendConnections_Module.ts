import type {
  BackendConnection,
  BackendConnectionCatalog,
  BackendConnectionCatalogState,
  BackendConnectionsService,
} from '@/features/backend-connections/domain/types/backend-connection.type'

import { BackendConnectionStorage, normalizeBackendURL } from '@/features/backend-connections/services/backend-connection-storage'

/** Владелец primary/active target, каталога и per-backend Workspace. */
export class BackendConnections_Module {
  public readonly primaryBackendURL: string
  private _activeBackendURL: string
  private _state: BackendConnectionCatalogState = { status: 'idle' }
  private _loadPromise: Promise<BackendConnectionCatalog> | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(
    primaryBackendURL: string,
    private readonly _service: BackendConnectionsService,
    private readonly _storage = new BackendConnectionStorage(),
    private readonly _reload: () => void = () => undefined,
  ) {
    this.primaryBackendURL = normalizeBackendURL(primaryBackendURL)
    this._activeBackendURL = this._storage.readActiveBackend(this.primaryBackendURL)
  }

  public get activeBackendURL(): string {
    return this._activeBackendURL
  }

  public get isPrimaryActive(): boolean {
    return this._activeBackendURL === this.primaryBackendURL
  }

  public get state(): BackendConnectionCatalogState {
    return this._state
  }

  public get catalog(): BackendConnectionCatalog | null {
    return this._state.status === 'ready' ? this._state.catalog : null
  }

  public async load(): Promise<BackendConnectionCatalog> {
    if (this._loadPromise) {
      return this._loadPromise
    }
    this._setState({ status: 'loading' })
    this._loadPromise = this._service.list()
      .then((response) => {
        const catalog = this._normalizeCatalog(response.items, response.canManage)
        this._setState({ status: 'ready', catalog })
        return catalog
      })
      .catch((error: unknown) => {
        const value = error as { code?: string, message?: string }
        this._setState({
          status: 'error',
          code: value.code ?? 'backend_catalog_unavailable',
          message: value.message ?? 'Backend connection catalog is unavailable',
        })
        throw error
      })
      .finally(() => {
        this._loadPromise = null
      })
    return this._loadPromise
  }

  public async create(name: string, baseURL: string): Promise<void> {
    await this._service.create(name.trim(), normalizeBackendURL(baseURL))
    await this.load()
  }

  public async delete(id: string): Promise<void> {
    const active = this.catalog?.items.find(item => item.id === id)?.baseUrl === this.activeBackendURL
    await this._service.delete(id)
    if (active) {
      this.fallbackToPrimary()
      return
    }
    await this.load()
  }

  public hasActiveConnection(catalog: BackendConnectionCatalog): boolean {
    return catalog.items.some(item => item.baseUrl === this.activeBackendURL)
  }

  public switchBackend(backendURL: string): void {
    const normalized = normalizeBackendURL(backendURL)
    if (normalized === this._activeBackendURL) {
      return
    }
    if (normalized !== this.primaryBackendURL && !this.catalog?.items.some(item => item.baseUrl === normalized)) {
      throw new Error('Backend connection is not present in the primary catalog')
    }
    this._storage.writeActiveBackend(normalized)
    this._activeBackendURL = normalized
    this._reload()
  }

  public fallbackToPrimary(): void {
    if (this.isPrimaryActive) {
      return
    }
    this._storage.writeActiveBackend(this.primaryBackendURL)
    this._activeBackendURL = this.primaryBackendURL
    this._reload()
  }

  public readWorkspace(): string | null {
    return this._storage.readWorkspace(this.activeBackendURL)
  }

  public readWorkspaceFor(backendURL: string): string | null {
    return this._storage.readWorkspace(normalizeBackendURL(backendURL))
  }

  public selectWorkspace(workspaceIdentity: string): void {
    this._storage.writeWorkspace(this.activeBackendURL, workspaceIdentity)
    this._reload()
  }

  public seedWorkspace(workspaceIdentity: string): void {
    this._storage.writeWorkspace(this.activeBackendURL, workspaceIdentity)
  }

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _normalizeCatalog(
    values: Array<{ id: string, name?: string, baseUrl: string, createdBy?: string, createdAt?: string }>,
    canManage: boolean,
  ): BackendConnectionCatalog {
    const byURL = new Map<string, BackendConnection>()
    byURL.set(this.primaryBackendURL, {
      id: 'primary',
      name: 'Основной',
      baseUrl: this.primaryBackendURL,
      primary: true,
    })
    for (const value of values) {
      try {
        const baseUrl = normalizeBackendURL(value.baseUrl)
        if (!byURL.has(baseUrl)) {
          byURL.set(baseUrl, { ...value, name: value.name?.trim() || baseUrl, baseUrl, primary: false })
        }
      }
      catch {
        // Некорректная legacy-строка не становится доступным target.
      }
    }
    const items = [...byURL.values()].sort((left, right) => {
      if (left.primary !== right.primary) {
        return left.primary ? -1 : 1
      }
      return left.name.localeCompare(right.name) || left.baseUrl.localeCompare(right.baseUrl)
    })
    return { items, total: items.length, canManage }
  }

  private _setState(state: BackendConnectionCatalogState): void {
    this._state = state
    for (const listener of this._listeners) {
      listener()
    }
  }
}
