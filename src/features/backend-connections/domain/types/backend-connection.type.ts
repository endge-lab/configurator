export interface BackendConnection {
  id: string
  name: string
  baseUrl: string
  createdBy?: string
  createdAt?: string
  primary: boolean
  source: 'default' | 'local' | 'environment'
}

export interface BackendConnectionCatalog {
  items: BackendConnection[]
  localItems: BackendConnection[]
  environmentItems: BackendConnection[]
  total: number
  canManage: boolean
}

export type BackendConnectionCatalogState
  = | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready', catalog: BackendConnectionCatalog }
    | { status: 'error', code: string, message: string }

export interface BackendConnectionListResponse {
  items: Array<{
    id: string
    name?: string
    baseUrl: string
    createdBy?: string
    createdAt?: string
  }>
  total: number
  canManage: boolean
}

export interface BackendConnectionsService {
  list: (backendURL?: string) => Promise<BackendConnectionListResponse>
  create: (name: string, baseURL: string, backendURL?: string) => Promise<void>
  delete: (id: string, backendURL?: string) => Promise<void>
}

/** Минимальные данные нового рабочего пространства выбранного backend. */
export interface WorkspaceCreateInput {
  identity: string
  displayName: string
  description?: string
}

export interface ArchivedWorkspace {
  type: 'workspace'
  identity: string
  displayName: string
  description?: string
  deletedAt: string
  revision: number
  role: string
}
