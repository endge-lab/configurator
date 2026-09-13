import type { BuildProfileSettings, BuildProfileTransport, BuildProfileVisibility } from '@/features/endge-ide/domain/entities/RBuildProfile'

export interface BuildProfilePatch {
  displayName?: string
  visibility?: BuildProfileVisibility
  settings?: BuildProfileSettings
}

export interface BuildProfileAdapter {
  list: (workspaceIdentity: string, signal?: AbortSignal) => Promise<BuildProfileTransport[]>
  create: (workspaceIdentity: string, visibility: BuildProfileVisibility, settings: BuildProfileSettings) => Promise<BuildProfileTransport>
  patch: (workspaceIdentity: string, identity: string, revision: number, patch: BuildProfilePatch) => Promise<BuildProfileTransport>
  delete: (workspaceIdentity: string, identity: string, revision: number) => Promise<void>
}
