export interface LegacyWorkspaceFoldersRebuildRequest {
  workspaceIdentity: string
  confirmation: string
  signal?: AbortSignal
}

export interface LegacyWorkspaceFoldersRebuildResult {
  foldersDeleted: number
  foldersCreated: number
  documentsRelinked: number
}

/** Transport временной backend-миграции Workspace-проекции. */
export interface ServiceBackendLegacyWorkspaceFoldersAdapter {
  rebuildFromFrontend: (request: LegacyWorkspaceFoldersRebuildRequest) => Promise<LegacyWorkspaceFoldersRebuildResult>
}

/** Изолирует browser reload от Workspace module. */
export interface EndgeIDEPageNavigationAdapter {
  reload: () => void
}
