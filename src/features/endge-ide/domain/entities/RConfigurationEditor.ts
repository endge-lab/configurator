import type { ConfigurationSourceValueDefinition, ManagedBy, RConfiguration } from '@endge/core'

import { compileConfigurationSource, Endge, isSystemManaged, patchConfigurationSource } from '@endge/core'

/** Source-backed editor state for one Workspace configuration category. */
export class RConfigurationEditor {
  id!: string | number
  identity!: string
  name!: string
  description = ''
  source = ''
  sourceVersion = 1
  managedBy: ManagedBy = 'user'
  managedById: string | null = null
  diagnostics: string[] = []

  fillFromSource(source: RConfiguration): void {
    this.id = source.id
    this.identity = source.identity
    this.name = source.displayName || source.name || source.identity
    this.description = String(source.description ?? '')
    this.source = source.source
    this.sourceVersion = source.sourceVersion
    this.managedBy = source.managedBy
    this.managedById = source.managedById
    this.refreshDiagnostics()
  }

  updateSource(target: RConfiguration): void {
    target.id = this.id as any
    if (!isSystemManaged(target)) {
      target.identity = this.identity.trim()
      target.name = this.name.trim() || target.identity
      target.displayName = target.name
    }
    target.description = this.description.trim() || null
    target.source = this.source
    target.sourceVersion = 1
  }

  get systemManaged(): boolean { return this.managedBy === 'system' }

  get values(): ConfigurationSourceValueDefinition[] {
    return compileConfigurationSource(this.source, Endge.configurationSchema.typeCatalog).document?.values ?? []
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  updateValue(value: ConfigurationSourceValueDefinition): void {
    this.source = patchConfigurationSource(this.source, { op: 'upsert', value })
    this.refreshDiagnostics()
  }

  removeValue(key: string): void {
    this.source = patchConfigurationSource(this.source, { op: 'remove', key })
    this.refreshDiagnostics()
  }

  refreshDiagnostics(): void {
    const result = compileConfigurationSource(this.source, Endge.configurationSchema.typeCatalog)
    this.diagnostics = [
      ...(!this.identity.trim() ? ['Identity не может быть пустым.'] : []),
      ...(this.sourceVersion !== 1 ? ['Configuration поддерживает только sourceVersion 1.'] : []),
      ...result.diagnostics.filter(item => item.severity === 'error').map(item => item.message),
    ]
  }
}
