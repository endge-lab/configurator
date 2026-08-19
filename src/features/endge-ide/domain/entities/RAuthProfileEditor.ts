import type { AuthProfileAdapterId, AuthSessionStorage, RAuthProfile } from '@endge/core'

export class RAuthProfileEditor {
  id!: string | number
  identity!: string
  displayName!: string
  description: string = ''
  adapterId: AuthProfileAdapterId = 'bearer'
  configText: string = '{}'
  credentialsText: string = '{}'
  sessionStorage: AuthSessionStorage = 'memory'
  persistRefreshToken: boolean = false
  active: boolean = true

  fillFromSource(source: RAuthProfile): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.description = String(source.description ?? '')
    this.adapterId = source.adapterId ?? 'bearer'
    this.configText = stringify(source.config ?? {})
    this.credentialsText = stringify(source.credentials ?? {})
    this.sessionStorage = source.session?.storage ?? 'memory'
    this.persistRefreshToken = source.session?.persistRefreshToken === true
    this.active = source.active !== false
  }

  updateSource(source: RAuthProfile): void {
    source.id = this.id as number
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description || null
    source.adapterId = this.adapterId
    source.config = parseObject(this.configText)
    source.credentials = parseStringObject(this.credentialsText)
    source.session = supportsSession(this.adapterId)
      ? { storage: this.sessionStorage, persistRefreshToken: this.persistRefreshToken }
      : undefined
    source.active = this.active !== false
  }
}

function supportsSession(adapterId: string): boolean {
  return adapterId === 'oidc'
    || adapterId === 'oauth2-client-credentials'
    || adapterId === 'oauth2-password'
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function parseStringObject(value: string): Record<string, string> {
  const raw = parseObject(value)
  const out: Record<string, string> = {}
  for (const [key, v] of Object.entries(raw))
    out[key] = v == null ? '' : String(v)
  return out
}
