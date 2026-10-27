// Уровень прав персонального токена агента.
export type AgentAccessScope = 'read' | 'write'

// Серверный статус токена.
export type AgentAccessTokenStatus = 'active' | 'expired' | 'revoked'

// Фильтр списка токенов: свои или все (только Platform Admin).
export type AgentAccessOwnerFilter = 'me' | 'all'

// Пресет срока действия токена в диалоге.
export type AgentTokenExpiryPreset = '1h' | '1d' | '7d' | 'custom'

export interface AgentAccessActor {
  id: string
  username?: string
  displayName?: string
}

// Проекция токена без секрета, как её возвращает backend.
export interface AgentAccessToken {
  id: string
  owner: AgentAccessActor
  workspaceIdentity: string
  workspaceDisplayName?: string
  name: string
  description?: string
  scope: AgentAccessScope
  commit: boolean
  delete: boolean
  tokenPrefix: string
  status: AgentAccessTokenStatus
  createdAt: string
  expiresAt: string
  lastUsedAt?: string
  revokedAt?: string
}

export interface AgentAccessTokenList {
  items: AgentAccessToken[]
  maxTtlSeconds: number | null
}

export interface CreateAgentAccessTokenInput {
  workspaceIdentity: string
  name: string
  description?: string
  scope: AgentAccessScope
  commit: boolean
  delete: boolean
  expiresAt: string
}

// Результат выпуска: секрет возвращается backend один раз.
export interface CreatedAgentAccessToken {
  token: string
  accessToken: AgentAccessToken
}

// Ревизия документа с отметкой токена агента, если правку сделал агент.
export interface AgentAttributedRevision {
  id: string
  revisionNumber: number
  operation: string
  createdAt: string
  createdBy: AgentAccessActor
  agent: { tokenId: string, name: string | null } | null
}

// Страница истории ревизий; `total` — общее число ревизий документа.
export interface AgentAttributedRevisionPage {
  items: AgentAttributedRevision[]
  total: number
}
