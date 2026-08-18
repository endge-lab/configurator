export interface ConfiguratorVersionActor {
  id: string
  username?: string
  displayName?: string
}

export interface ConfiguratorRelease {
  id: string
  identity: string
  displayName: string
  description?: string
  sourceCommitId: string
  headSequence: number
  createdBy: ConfiguratorVersionActor
  createdAt: string
}

export interface ConfiguratorCommit {
  id: string
  parentCommitId?: string
  baseSequence: number
  headSequence: number
  message: string
  revisionPolicy: 'preserve' | 'squash'
  operation: string
  domainVersion?: string
  createdBy: ConfiguratorVersionActor
  createdAt: string
  changes: ConfiguratorCommitChange[]
}

export interface ConfiguratorCommitChange {
  documentType: string
  documentId: string
  documentIdentity: string
  beforeRevisionId?: string
  afterRevisionId?: string
  operation: string
}

export interface ConfiguratorCommitPlan {
  baseSequence: number
  headSequence: number
  revisionCount: number
  documentCount: number
  contributors: ConfiguratorVersionActor[]
  shared: boolean
}

export interface ConfiguratorRestorePlan {
  valid: boolean
  creates: number
  updates: number
  restores: number
  deletes: number
  expectedHeadSequence: number
}
