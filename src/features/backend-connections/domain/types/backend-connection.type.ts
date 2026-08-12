export interface BackendConnection {
  id: string
  baseUrl: string
  createdBy?: string
  createdAt?: string
  primary: boolean
}

export interface BackendConnectionCatalog {
  items: BackendConnection[]
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
    baseUrl: string
    createdBy?: string
    createdAt?: string
  }>
  total: number
  canManage: boolean
}

export interface BackendConnectionsService {
  list: () => Promise<BackendConnectionListResponse>
  create: (baseURL: string) => Promise<void>
  delete: (id: string) => Promise<void>
}
