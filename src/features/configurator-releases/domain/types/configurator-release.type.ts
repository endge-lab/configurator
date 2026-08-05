export interface ConfiguratorRelease {
  id: string
  identity: string
  displayName: string
  sourceCommitId: string
  headSequence: number
  createdAt: string
}

export interface ConfiguratorCommit {
  id: string
  headSequence: number
}

export interface ConfiguratorCommitPlan {
  headSequence: number
  revisionCount: number
}
