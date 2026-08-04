import type {
  ConfiguratorDeveloper,
  ConfiguratorSession,
  ConfiguratorSessionService,
  ConfiguratorSessionState,
  ConfiguratorWorkspaceAccess,
} from '@/features/configurator-session/domain/types/configurator-session.type'

type UnknownRecord = Record<string, unknown>

/** HTTP service developer session нового backend. */
export class ConfiguratorSession_Service implements ConfiguratorSessionService {
  private readonly _baseURL: string

  public constructor(baseURL: string) {
    this._baseURL = normalizeBaseURL(baseURL)
  }

  /** Проверяет opaque browser session и возвращает безопасный developer snapshot. */
  public async check(): Promise<ConfiguratorSessionState> {
    let response: Response
    try {
      response = await fetch(`${this._baseURL}/auth/session`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
    }
    catch (error) {
      return {
        status: 'error',
        code: 'session_unavailable',
        message: error instanceof Error ? error.message : 'Configurator session is unavailable',
      }
    }

    const payload = await readJSON(response)
    if (response.status === 401) {
      const loginUrl = stringValue(payload?.loginUrl)
      return loginUrl
        ? { status: 'unauthenticated', loginUrl }
        : { status: 'error', code: 'session_invalid_response', message: 'Backend did not provide loginUrl' }
    }
    if (!response.ok) {
      return {
        status: 'error',
        code: stringValue(payload?.code) || 'session_unavailable',
        message: stringValue(payload?.message) || `Configurator session request failed with ${response.status}`,
      }
    }

    const session = parseSession(payload)
    return session
      ? { status: 'authenticated', session }
      : { status: 'error', code: 'session_invalid_response', message: 'Backend returned malformed Configurator session' }
  }

  /** Отзывает backend session и удаляет opaque cookie на стороне сервера. */
  public async logout(): Promise<void> {
    const response = await fetch(`${this._baseURL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok && response.status !== 401) {
      throw new Error(`Configurator logout failed with ${response.status}`)
    }
  }
}

function parseSession(value: UnknownRecord | null): ConfiguratorSession | null {
  if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.workspaces)) {
    return null
  }

  const developer = parseDeveloper(value.user)
  if (!developer) {
    return null
  }

  const workspaces = value.workspaces.map(parseWorkspaceAccess)
  if (!workspaces.every((workspace): workspace is ConfiguratorWorkspaceAccess => workspace != null)) {
    return null
  }

  return {
    developer,
    platformAdmin: value.platformAdmin === true,
    workspaces,
  }
}

function parseWorkspaceAccess(value: unknown): ConfiguratorWorkspaceAccess | null {
  if (!isRecord(value)) {
    return null
  }
  const id = stringValue(value.id)
  const identity = stringValue(value.identity)
  const displayName = stringValue(value.displayName)
  if (!id || !identity || !displayName || typeof value.active !== 'boolean') {
    return null
  }
  return { id, identity, displayName, active: value.active }
}

function parseDeveloper(value: UnknownRecord): ConfiguratorDeveloper | null {
  const id = stringValue(value.id)
  const providerId = stringValue(value.providerId)
  const subject = stringValue(value.subject)
  const issuer = stringValue(value.issuer)
  if (!id || !providerId || !subject || !issuer || typeof value.active !== 'boolean') {
    return null
  }
  return {
    id,
    providerId,
    subject,
    issuer,
    ...(stringValue(value.username) ? { username: stringValue(value.username) } : {}),
    ...(stringValue(value.displayName) ? { displayName: stringValue(value.displayName) } : {}),
    active: value.active,
  }
}

async function readJSON(response: Response): Promise<UnknownRecord | null> {
  try {
    const value: unknown = await response.json()
    return isRecord(value) ? value : null
  }
  catch {
    return null
  }
}

function normalizeBaseURL(value: string): string {
  return String(value ?? '').trim().replace(/\/+$/, '')
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
