export interface BackendVersion {
  service: string
  version: string
  env: string
}

export type BackendVersionState
  = | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready', value: BackendVersion, loadedAt: number }
    | { status: 'error', code: string, message: string, loadedAt: number }
