// Публичный префикс формата `endge_pat_` + 8 символов секрета (как `tokenPrefix` backend).
const VISIBLE_PREFIX_LENGTH = 'endge_pat_'.length + 8

/**
 * Скрывает секретную часть токена, оставляя только публичный префикс.
 */
export function maskAgentToken(token: string): string {
  if (!token) {
    return ''
  }
  const visible = token.slice(0, Math.min(VISIBLE_PREFIX_LENGTH, Math.floor(token.length / 2)))
  return `${visible}${'•'.repeat(12)}`
}
