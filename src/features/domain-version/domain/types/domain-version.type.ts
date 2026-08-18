export interface DomainStatus {
  workspace: string
  state: 'clean' | 'dirty'
  domainVersion?: string
  lastCommittedDomainVersion?: string
  commitId: string
  commitMessage: string
  committedAt: string
  pendingRevisionCount: number
}

export interface DomainVersionTarget {
  backendURL: string
  workspace: string
}

export type DomainVersionTargetState
  = | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready', value: DomainStatus, loadedAt: number }
    | { status: 'error', code: string, message: string, loadedAt: number }
