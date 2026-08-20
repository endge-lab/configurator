import type { ConfigurationSourceValueDefinition, ManagedBy, ProgramDiagnostic, RConfiguration } from '@endge/core'

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
  sourceDiagnostics: ProgramDiagnostic[] = []
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
    const result = compileConfigurationSource(this.source, Endge.configurationSchema.typeCatalog)
    return (result.document ?? result.draftDocument)?.values ?? []
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

  renameValue(key: string, nextKey: string): void {
    this.source = patchConfigurationSource(this.source, { op: 'rename', key, nextKey })
    this.refreshDiagnostics()
  }

  refreshDiagnostics(): void {
    const result = compileConfigurationSource(this.source, Endge.configurationSchema.typeCatalog)
    this.sourceDiagnostics = [
      ...(!this.identity.trim()
        ? [{ severity: 'error' as const, code: 'configuration-identity-empty', message: 'Identity не может быть пустым.', sourcePath: 'identity' }]
        : []),
      ...(this.sourceVersion !== 1
        ? [{ severity: 'error' as const, code: 'configuration-source-version-invalid', message: 'Configuration поддерживает только sourceVersion 1.', sourcePath: 'sourceVersion' }]
        : []),
      ...result.diagnostics,
    ]
    this.diagnostics = this.sourceDiagnostics
      .filter(item => item.severity === 'error')
      .map(item => item.message)
  }
}
