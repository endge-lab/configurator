import type { RComposition } from '@endge/core'

import { Endge } from '@endge/core'

/** Source-first editor model Composition. */
export class RCompositionEditor {
  id!: string | number
  identity!: string
  name!: string
  description: string = ''
  source: string = ''
  sourceVersion: number = 1
  diagnostics: unknown[] = []

  fillFromSource(source: RComposition): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String(source.description ?? '')
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
  }

  updateSource(target: RComposition): void {
    target.id = this.id as any
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    target.description = this.description
    target.source = this.source
    target.sourceVersion = this.sourceVersion
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  resetSource(): void {
    this.applySourceText(Endge.source.createDefault('composition'))
  }

  refreshDiagnostics(): void {
    this.diagnostics = Endge.source.validate('composition', this.source).diagnostics ?? []
  }
}
