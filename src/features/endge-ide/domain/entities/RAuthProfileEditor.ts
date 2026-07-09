import type { AuthProfileAdapterId, AuthProfilePersist, RAuthProfile } from '@endge/core'

export class RAuthProfileEditor {
  id!: string | number
  identity!: string
  displayName!: string
  description: string = ''
  adapterId: AuthProfileAdapterId = 'manual_token'
  configText: string = '{}'
  credentialRefsText: string = '{}'
  persist: AuthProfilePersist = 'localStorage'
  active: boolean = true

  fillFromSource(source: RAuthProfile): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.description = String(source.description ?? '')
    this.adapterId = source.adapterId ?? 'manual_token'
    this.configText = stringify(source.config ?? {})
    this.credentialRefsText = stringify(source.credentialRefs ?? {})
    this.persist = source.persist ?? 'localStorage'
    this.active = source.active !== false
  }

  updateSource(source: RAuthProfile): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description || null
    source.adapterId = this.adapterId
    source.config = parseObject(this.configText)
    source.credentialRefs = parseStringObject(this.credentialRefsText)
    source.persist = this.persist
    source.active = this.active !== false
  }
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

function parseStringObject(value: string): Record<string, string | undefined> {
  const raw = parseObject(value)
  const out: Record<string, string | undefined> = {}
  for (const [key, v] of Object.entries(raw))
    out[key] = v == null ? undefined : String(v)
  return out
}
