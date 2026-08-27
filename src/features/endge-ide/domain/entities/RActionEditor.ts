import type { ActionImplementation, ActionTargetSelector, EntityOrigin, ImplementationBindingScope, ProgramDiagnostic, RAction } from '@endge/core'
import { Endge } from '@endge/core'

/** Source-like editor state for a persisted or read-only code-owned Action. */
export class RActionEditor {
  id!: string | number
  identity!: string
  displayName!: string
  description: string = ''
  active = true
  source = ''
  sourceVersion = 1
  target: ActionTargetSelector[] | null = null
  defaultImplementation: ActionImplementation = { kind: 'source' }
  origin: EntityOrigin = { kind: 'storage' }
  owner: unknown = null
  overridden = false
  effectiveProviderKey: string | null = null
  effectiveProviderOrigin: string | null = null
  bindingScope: ImplementationBindingScope | null = null
  diagnostics: ProgramDiagnostic[] = []

  get readOnly(): boolean { return this.origin.kind !== 'storage' }

  fillFromSource(source: RAction): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? this.identity)
    this.description = String(source.description ?? '')
    this.active = source.active !== false
    this.source = String(source.source ?? '')
    this.sourceVersion = Math.max(1, Number(source.sourceVersion ?? 1) || 1)
    this.target = source.target?.map(selector => ({ ...selector })) ?? null
    this.defaultImplementation = { ...source.defaultImplementation }
    this.origin = source.origin
    this.owner = source.owner ?? null
    this.refreshEffectiveImplementation()
    this.refreshDiagnostics()
  }

  updateSource(source: RAction): void {
    if (this.readOnly) {
      return
    }
    source.id = this.id as any
    source.identity = this.identity.trim()
    source.name = this.displayName.trim() || source.identity
    source.displayName = source.name
    source.description = this.description.trim() || null
    source.active = this.active
    source.source = this.source
    source.sourceVersion = Math.max(1, Number(this.sourceVersion) || 1)
    source.target = this.target?.map(selector => ({ ...selector })) ?? null
  }

  applySourceText(value: string): void {
    if (this.readOnly) {
      return
    }
    this.source = value
    this.refreshDiagnostics()
  }

  refreshEffectiveImplementation(): void {
    const resolved = Endge.actions.listResolved().find(action => action.identity === this.identity)
    this.overridden = resolved?.overridden === true
    this.effectiveProviderKey = resolved?.effectiveProviderKey ?? null
    this.effectiveProviderOrigin = resolved?.effectiveProviderOrigin?.kind ?? null
    this.bindingScope = resolved?.bindingScope ?? null
  }

  refreshDiagnostics(): void {
    const result = Endge.source.validate('action', this.source)
    this.diagnostics = (result.diagnostics ?? []) as ProgramDiagnostic[]
  }
}
