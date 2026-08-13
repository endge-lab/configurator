export type AccessScopeType = 'platform' | 'workspace'
export type WorkspaceAccessRole = 'viewer' | 'editor' | 'admin'

export interface AccessControlUser {
  id: string
  providerId: string
  username?: string
  displayName?: string
  active: boolean
}

export interface AccessGrant {
  id: string
  user: AccessControlUser
  scopeType: AccessScopeType
  workspaceIdentity?: string
  workspaceDisplayName?: string
  role: WorkspaceAccessRole
  createdAt: string
  updatedAt: string
}

export interface CursorPage<T> {
  items: T[]
  nextCursor?: string
}

export interface PutAccessGrantInput {
  userId: string
  scopeType: AccessScopeType
  workspaceIdentity?: string
  role: WorkspaceAccessRole
}

export interface BulkAccessGrantInput {
  userId: string
  role: WorkspaceAccessRole
  selection:
    | { type: 'all-active' }
    | { type: 'selected', workspaceIdentities: string[] }
}

export interface BulkAccessGrantResult {
  affected: number
  created: number
  updated: number
}
