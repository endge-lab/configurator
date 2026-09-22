export type ConnectedServiceVersionStatus = 'available' | 'unavailable'

export interface ConnectedServiceVersion {
  service: string
  version?: string
  env?: string
  status: ConnectedServiceVersionStatus
}

export interface BackendVersion {
  service: string
  version: string
  env: string
  services: readonly ConnectedServiceVersion[]
}

export type BackendVersionState
  = | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready', value: BackendVersion, loadedAt: number }
    | { status: 'error', code: string, message: string, loadedAt: number }
