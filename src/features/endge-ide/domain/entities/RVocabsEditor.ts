import type { ProgramDiagnostic, RVocabs } from '@endge/core'

import { Endge } from '@endge/core'

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
  authMode: 'inherit' | 'profile' | 'none' = 'inherit'
  authProfileIdentity: string = ''
  active: boolean = true
  source: string = ''
  sourceVersion: number = 1
  diagnostics: ProgramDiagnostic[] = []

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
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
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
    source.source = this.source
    source.sourceVersion = 1
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  resetSource(): void {
    this.applySourceText(Endge.source.createDefault('vocab'))
  }

  refreshDiagnostics(): void {
    this.diagnostics = (Endge.source.validate('vocab', this.source).diagnostics ?? []) as ProgramDiagnostic[]
  }
}

function normalizeAuthMode(value: unknown): 'inherit' | 'profile' | 'none' {
  if (value === 'profile' || value === 'none')
    return value
  return 'inherit'
}
