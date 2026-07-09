import type { RVocabs } from '@endge/core'

/**
 * Модель редактора для RVocabs (коллекция vocabs).
 */
export class RVocabsEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  mode: 'external_payload' | 'internal' = 'external_payload'
  baseApiUrl: string = ''
  collectionSlug: string = ''
  authMode: 'inherit' | 'profile' | 'manual' | 'none' = 'inherit'
  authProfileIdentity: string = ''
  active: boolean = true

  fillFromSource(source: RVocabs): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.description = String(source.description ?? '')
    this.mode = source.mode === 'internal' ? 'internal' : 'external_payload'
    this.baseApiUrl = String(source.baseApiUrl ?? '')
    this.collectionSlug = String(source.collectionSlug ?? '')
    this.authMode = normalizeAuthMode(source.authMode)
    this.authProfileIdentity = String(source.authProfileIdentity ?? '')
    this.active = source.active !== false
  }

  updateSource(source: RVocabs): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description || null
    source.mode = this.mode
    source.baseApiUrl = this.baseApiUrl || null
    source.collectionSlug = this.collectionSlug || null
    source.authMode = this.authMode
    source.authProfileIdentity = this.authMode === 'profile' ? this.authProfileIdentity || null : null
    source.active = this.active !== false
  }
}

function normalizeAuthMode(value: unknown): 'inherit' | 'profile' | 'manual' | 'none' {
  if (value === 'profile' || value === 'manual' || value === 'none')
    return value
  return 'inherit'
}
