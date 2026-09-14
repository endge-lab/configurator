import type {
  ArchivedWorkspace,
  BackendConnection,
  BackendConnectionCatalog,
  BackendConnectionCatalogState,
  BackendConnectionsService,
  WorkspaceCreateInput,
} from '@/features/backend-connections/domain/types/backend-connection.type'

import { BackendConnectionStorage, normalizeBackendURL } from '@/features/backend-connections/services/backend-connection-storage'

/** Владелец default/active target, локального каталога, каталога среды и per-backend Workspace. */
export class BackendConnections_Module {
  public readonly defaultBackendURL: string | null
  private _activeBackendURL: string | null
  private _catalog: BackendConnectionCatalog
  private _environmentItems: BackendConnection[] = []
  private _state: BackendConnectionCatalogState
  private _loadPromise: Promise<BackendConnectionCatalog> | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(
    defaultBackendURL: string | null,
    private readonly _service: BackendConnectionsService,
    private readonly _storage = new BackendConnectionStorage(),
    private readonly _reload: () => void = () => undefined,
  ) {
    this.defaultBackendURL = defaultBackendURL ? normalizeBackendURL(defaultBackendURL) : null
    this._activeBackendURL = this._storage.readActiveBackend()
    this._catalog = this._buildCatalog(false)
    this._state = { status: 'ready', catalog: this._catalog }
  }

  /** Возвращает явно выбранный backend; до выбора transport отсутствует. */
  public get activeBackendURL(): string {
    if (!this._activeBackendURL) {
      throw new Error('Backend connection is not selected')
    }
    return this._activeBackendURL
  }

  public get activeBackendURLOrNull(): string | null {
    return this._activeBackendURL
  }

  public get hasActiveBackend(): boolean {
    return this._activeBackendURL !== null
  }

  public get state(): BackendConnectionCatalogState {
    return this._state
  }

  public get catalog(): BackendConnectionCatalog {
    return this._catalog
  }

  /** Загружает общий каталог именно из выбранной среды, не блокируя локальный каталог. */
  public async load(): Promise<BackendConnectionCatalog> {
    if (!this._activeBackendURL) {
      return this._catalog
    }
    if (this._loadPromise) {
      return this._loadPromise
    }
    this._setState({ status: 'loading' })
    this._loadPromise = this._service.list(this._activeBackendURL)
      .then((response) => {
        this._environmentItems = this._normalizeEnvironmentConnections(response.items)
        this._catalog = this._buildCatalog(response.canManage)
        this._setState({ status: 'ready', catalog: this._catalog })
        return this._catalog
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

  public async create(name: string, baseURL: string, saveLocally = true): Promise<void> {
    if (saveLocally) {
      this.createLocal(name, baseURL)
      return
    }
    await this.createInEnvironment(name, baseURL)
  }

  public createLocal(name: string, baseURL: string): void {
    const normalizedName = normalizeConnectionName(name)
    const normalizedURL = normalizeBackendURL(baseURL)
    this._storage.writeLocalConnection({ name: normalizedName, baseUrl: normalizedURL })
    this._catalog = this._buildCatalog(this._catalog.canManage)
    this._setState({ status: 'ready', catalog: this._catalog })
  }

  public async createInEnvironment(name: string, baseURL: string): Promise<void> {
    if (!this._catalog.canManage) {
      throw new Error('Platform Admin role is required')
    }
    await this._service.create(
      normalizeConnectionName(name),
      normalizeBackendURL(baseURL),
      this.activeBackendURL,
    )
    await this.load()
  }

  /** Создаёт Workspace в выбранном backend, сохраняя текущий выбор пространства. */
  public async createWorkspace(input: WorkspaceCreateInput): Promise<void> {
    const response = await fetch(`${this.activeBackendURL}/api/v1/workspaces`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        identity: input.identity.trim(),
        displayName: input.displayName.trim(),
        description: input.description?.trim() || undefined,
      }),
    })
    if (!response.ok) {
      throw new Error(response.status === 409
        ? 'workspace_identity_conflict'
        : response.status === 403
          ? 'workspace_creation_forbidden'
          : 'workspace_creation_failed')
    }
  }

  /** Мягко удаляет Workspace в выбранном backend с optimistic concurrency. */
  public async deleteWorkspace(workspaceIdentity: string): Promise<void> {
    const url = `${this.activeBackendURL}/api/v1/workspaces/${encodeURIComponent(workspaceIdentity)}`
    const current = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const revision = current.headers.get('ETag')
    if (!current.ok || !revision) {
      throw new Error(current.status === 403 ? 'workspace_deletion_forbidden' : 'workspace_deletion_failed')
    }
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'If-Match': revision },
    })
    if (!response.ok) {
      throw new Error(response.status === 403
        ? 'workspace_deletion_forbidden'
        : response.status === 409
          ? 'workspace_revision_conflict'
          : 'workspace_deletion_failed')
    }
  }

  /** Возвращает доступные tombstones Workspace независимо от active Workspace. */
  public async listArchivedWorkspaces(): Promise<ArchivedWorkspace[]> {
    const response = await fetch(`${this.activeBackendURL}/api/v1/workspaces/archive`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error('workspace_archive_failed')
    }
    const payload: unknown = await response.json()
    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      throw new Error('workspace_archive_invalid')
    }
    return payload.items.map((item) => {
      if (!isRecord(item)
        || !stringValue(item.identity)
        || !stringValue(item.displayName)
        || !stringValue(item.deletedAt)
        || !Number.isInteger(item.revision)
        || Number(item.revision) <= 0) {
        throw new Error('workspace_archive_invalid')
      }
      return {
        type: 'workspace' as const,
        identity: stringValue(item.identity),
        displayName: stringValue(item.displayName),
        ...(stringValue(item.description) ? { description: stringValue(item.description) } : {}),
        deletedAt: stringValue(item.deletedAt),
        revision: Number(item.revision),
        role: stringValue(item.role),
      }
    })
  }

  /** Восстанавливает Workspace tombstone по revision из архива. */
  public async restoreWorkspace(workspace: ArchivedWorkspace): Promise<void> {
    const response = await fetch(`${this.activeBackendURL}/api/v1/workspaces/${encodeURIComponent(workspace.identity)}/restore`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'If-Match': `"${workspace.revision}"` },
    })
    if (!response.ok) {
      throw new Error(response.status === 403
        ? 'workspace_restore_forbidden'
        : response.status === 409
          ? 'workspace_revision_conflict'
          : 'workspace_restore_failed')
    }
  }

  public deleteLocal(baseURL: string): void {
    this._storage.removeLocalConnection(baseURL)
    this._catalog = this._buildCatalog(this._catalog.canManage)
    this._setState({ status: 'ready', catalog: this._catalog })
  }

  public async delete(id: string): Promise<void> {
    await this._service.delete(id, this.activeBackendURL)
    await this.load()
  }

  public switchBackend(backendURL: string): void {
    const normalized = normalizeBackendURL(backendURL)
    if (normalized === this._activeBackendURL) {
      return
    }
    if (!this._catalog.items.some(item => item.baseUrl === normalized)) {
      throw new Error('Backend connection is not present in the available catalogs')
    }
    this._storage.writeActiveBackend(normalized)
    this._activeBackendURL = normalized
    this._reload()
  }

  /** Сбрасывает выбор и возвращает приложение к локальному gate подключений. */
  public clearActiveBackend(): void {
    this._storage.removeActiveBackend()
    this._activeBackendURL = null
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

  /** Удаляет сохранённый выбор текущего Workspace и перезапускает bootstrap. */
  public clearWorkspaceAndReload(): void {
    this._storage.removeWorkspace(this.activeBackendURL)
    this._reload()
  }

  public seedWorkspace(workspaceIdentity: string): void {
    this._storage.writeWorkspace(this.activeBackendURL, workspaceIdentity)
  }

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _normalizeEnvironmentConnections(
    values: Array<{ id: string, name?: string, baseUrl: string, createdBy?: string, createdAt?: string }>,
  ): BackendConnection[] {
    const byURL = new Map<string, BackendConnection>()
    for (const value of values) {
      try {
        const baseUrl = normalizeBackendURL(value.baseUrl)
        if (!byURL.has(baseUrl)) {
          byURL.set(baseUrl, {
            ...value,
            name: value.name?.trim() || baseUrl,
            baseUrl,
            primary: false,
            source: 'environment',
          })
        }
      }
      catch {
        // Некорректная legacy-строка не становится доступным target.
      }
    }
    return sortConnections([...byURL.values()])
  }

  private _buildCatalog(canManage: boolean): BackendConnectionCatalog {
    const localByURL = new Map<string, BackendConnection>()
    if (this.defaultBackendURL) {
      localByURL.set(this.defaultBackendURL, {
        id: 'default',
        name: 'Основной',
        baseUrl: this.defaultBackendURL,
        primary: true,
        source: 'default',
      })
    }
    for (const value of this._storage.readLocalConnections()) {
      if (!localByURL.has(value.baseUrl)) {
        localByURL.set(value.baseUrl, {
          id: `local:${value.baseUrl}`,
          name: value.name,
          baseUrl: value.baseUrl,
          primary: false,
          source: 'local',
        })
      }
    }
    const localItems = [...localByURL.values()].sort((left, right) => {
      if (left.primary !== right.primary) {
        return left.primary ? -1 : 1
      }
      return compareConnections(left, right)
    })
    const items = [...localItems]
    const visibleURLs = new Set(localItems.map(item => item.baseUrl))
    for (const connection of this._environmentItems) {
      if (!visibleURLs.has(connection.baseUrl)) {
        items.push(connection)
        visibleURLs.add(connection.baseUrl)
      }
    }
    return {
      items,
      localItems,
      environmentItems: this._environmentItems,
      total: items.length,
      canManage,
    }
  }

  private _setState(state: BackendConnectionCatalogState): void {
    this._state = state
    for (const listener of this._listeners) {
      listener()
    }
  }
}

function normalizeConnectionName(value: string): string {
  const name = value.trim()
  if (!name) {
    throw new Error('Connection name is required')
  }
  if ([...name].length > 160) {
    throw new Error('Connection name must not exceed 160 characters')
  }
  return name
}

function sortConnections(values: BackendConnection[]): BackendConnection[] {
  return values.sort(compareConnections)
}

function compareConnections(left: BackendConnection, right: BackendConnection): number {
  return left.name.localeCompare(right.name) || left.baseUrl.localeCompare(right.baseUrl)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
