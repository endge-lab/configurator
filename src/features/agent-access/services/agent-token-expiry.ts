import type { AgentTokenExpiryPreset } from '@/features/agent-access/domain/types/agent-access.type'

// Минимальный запас срока: backend требует expiresAt не раньше now + 1 мин.
const MIN_TTL_MS = 2 * 60 * 1000

const PRESET_TTL_SECONDS: Record<Exclude<AgentTokenExpiryPreset, 'custom'>, number> = {
  '1h': 60 * 60,
  '1d': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
}

export const AGENT_TOKEN_EXPIRY_PRESETS: readonly AgentTokenExpiryPreset[] = ['1h', '1d', '7d', 'custom']

export type AgentTokenExpiryResult
  = | { ok: true, expiresAt: Date }
    | { ok: false, reason: 'required' | 'invalid' | 'tooSoon' | 'tooLong' }

/**
 * Пресет доступен, если его срок не превышает предел backend.
 */
export function isExpiryPresetAvailable(preset: AgentTokenExpiryPreset, maxTtlSeconds: number | null): boolean {
  if (preset === 'custom' || maxTtlSeconds == null) {
    return true
  }
  return PRESET_TTL_SECONDS[preset] <= maxTtlSeconds
}

/**
 * Вычисляет срок действия токена из пресета или своего значения `datetime-local`.
 */
export function resolveAgentTokenExpiry(
  preset: AgentTokenExpiryPreset,
  customValue: string,
  now: Date,
  maxTtlSeconds: number | null,
): AgentTokenExpiryResult {
  let expiresAt: Date
  if (preset === 'custom') {
    if (!customValue.trim()) {
      return { ok: false, reason: 'required' }
    }
    expiresAt = new Date(customValue)
    if (Number.isNaN(expiresAt.getTime())) {
      return { ok: false, reason: 'invalid' }
    }
  }
  else {
    expiresAt = new Date(now.getTime() + PRESET_TTL_SECONDS[preset] * 1000)
  }
  if (expiresAt.getTime() - now.getTime() < MIN_TTL_MS) {
    return { ok: false, reason: 'tooSoon' }
  }
  if (maxTtlSeconds != null && expiresAt.getTime() - now.getTime() > maxTtlSeconds * 1000) {
    return { ok: false, reason: 'tooLong' }
  }
  return { ok: true, expiresAt }
}

/**
 * Форматирует дату для атрибутов `min`/`max` поля `datetime-local` в локальном времени.
 */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
