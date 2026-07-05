import type {
  RSettings,
  SettingsAuthSchema,
  SettingsCustomSectionSchema,
  SettingsSSESchema,
  SettingsUpdateProfileSchema,
  SettingsVarSchema,
  SettingsVocabSourceSchema,
} from '@endge/core'

/**
 * Модель редактора для RSettings (коллекция settings).
 */
export class RSettings_Editor {
  id!: number
  identity!: string
  displayName!: string
  project?: string | null
  vars: SettingsVarSchema[] = []
  auth?: SettingsAuthSchema
  vocabs: SettingsVocabSourceSchema[] = []
  sse?: SettingsSSESchema
  updates?: SettingsUpdateProfileSchema[]
  customSections: SettingsCustomSectionSchema[] = []

  fillFromSource(source: RSettings): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.project = source.project
    this.vars = (source.vars ?? []).map(v => ({ ...v }))
    this.auth = source.auth ? { ...source.auth } as SettingsAuthSchema : undefined
    this.vocabs = (source.vocabs ?? []).map(v => ({
      ...v,
      collections: Array.isArray(v.collections) ? v.collections.map(c => ({ ...c })) : [],
    }))
    this.sse = source.sse ? { ...source.sse } : undefined
    this.updates = (source.updates ?? []).map(u => ({
      ...u,
      fields: (u.fields ?? []).map(f => ({ ...f })),
    }))
    this.customSections = (source.customSections ?? []).map(s => ({
      ...s,
      fields: (s.fields ?? []).map(f => ({ ...f })),
    }))
  }

  updateSource(source: RSettings): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.project = this.project
    source.vars = this.vars.map(v => ({ ...v }))
    source.auth = this.auth ? { ...this.auth } as SettingsAuthSchema : undefined
    source.vocabs = this.vocabs.map(v => ({
      ...v,
      collections: Array.isArray(v.collections) ? v.collections.map(c => ({ ...c })) : [],
    }))
    source.sse = this.sse ? { ...this.sse } : undefined
    source.updates = (this.updates ?? []).map(u => ({
      ...u,
      fields: (u.fields ?? []).map(f => ({ ...f })),
    }))
    source.customSections = this.customSections.map(s => ({
      ...s,
      fields: (s.fields ?? []).map(f => ({ ...f })),
    }))
  }
}
