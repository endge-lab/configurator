export interface ReleaseBuildMetadata {
  version: 1
  programId: string
  compilerVersion: string
  profile?: { identity: string, displayName: string, revision: number }
  runtime: 'ts-browser'
  scope: 'complete-model'
  contextMode: 'effective-context'
  context: unknown
  includeAst: boolean
  fileFormat: 'gzip'
  sizeBytes?: number
  checksum?: string
}

export interface ReleaseBuildSource {
  workspaceId: string
  workspaceIdentity: string
  generation: string
  headSequence: number
}

export interface CreateBuiltRelease {
  identity: string
  displayName: string
  description?: string
  sourceCommitId?: string
  commitMessage?: string
  source: ReleaseBuildSource
  buildMetadata: ReleaseBuildMetadata
}
