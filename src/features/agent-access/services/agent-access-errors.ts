import { AgentAccessError } from '@/features/agent-access/adapters/AgentAccessHttp_Adapter'

// Явный typed contract: код backend → ключ каталога `agentAccess.errors.*`.
const ERROR_KEYS = {
  access_token_expiry_required: 'agentAccess.errors.expiryRequired',
  access_token_expiry_invalid: 'agentAccess.errors.expiryInvalid',
  access_token_expiry_too_long: 'agentAccess.errors.expiryTooLong',
  access_token_flags_require_write: 'agentAccess.errors.flagsRequireWrite',
  access_token_scope_invalid: 'agentAccess.errors.scopeInvalid',
  access_token_name_invalid: 'agentAccess.errors.nameInvalid',
  access_token_description_invalid: 'agentAccess.errors.descriptionInvalid',
  access_token_scope_exceeds_role: 'agentAccess.errors.scopeExceedsRole',
  access_token_owner_admin_required: 'agentAccess.errors.commitRequiresAdmin',
  access_token_not_found: 'agentAccess.errors.notFound',
  workspace_not_found: 'agentAccess.errors.workspaceNotFound',
  workspace_forbidden: 'agentAccess.errors.workspaceForbidden',
  platform_admin_required: 'agentAccess.errors.platformAdminRequired',
  service_backend_unavailable: 'agentAccess.errors.unavailable',
} as const

export type AgentAccessErrorKey = typeof ERROR_KEYS[keyof typeof ERROR_KEYS] | 'agentAccess.errors.unknown'

/**
 * Возвращает ключ локализованного сообщения для ошибки backend токенов.
 */
export function agentAccessErrorKey(error: unknown): AgentAccessErrorKey {
  const code = error instanceof AgentAccessError ? error.code : typeof error === 'string' ? error : ''
  return (ERROR_KEYS as Record<string, AgentAccessErrorKey>)[code] ?? 'agentAccess.errors.unknown'
}

/**
 * Флаг `commit` выпускает только Admin workspace или Platform Admin: backend
 * отклоняет остальных кодом `access_token_owner_admin_required`.
 */
export function canIssueAgentCommit(workspaceRole: string | null | undefined, platformAdmin: boolean): boolean {
  return platformAdmin || workspaceRole === 'admin' || workspaceRole === 'platform_admin'
}
