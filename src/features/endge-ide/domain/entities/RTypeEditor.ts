import type { ProgramDiagnostic, RType } from '@endge/core'

import { Endge } from '@endge/core'

//
// Модель source-only редактирования RType.
export class RTypeEditor {
  id!: string
  identity!: string
  name!: string
  isPrimitive!: boolean
  source: string = ''
  sourceVersion: number = 1
  diagnostics: ProgramDiagnostic[] = []

  /** Переносит source-first данные редактора в доменную сущность. */
  updateSource(source: RType): void {
    source.identity = this.identity
    source.name = this.name
    source.isPrimitive = this.isPrimitive
    source.source = this.source
    source.sourceVersion = this.sourceVersion
  }

  /** Заполняет редактор из доменной сущности. */
  fillFromSource(source: RType): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.isPrimitive = source.isPrimitive
    this.source = String(source.source ?? '')
    this.sourceVersion = Math.max(1, Number(source.sourceVersion ?? 1) || 1)
    this.refreshDiagnostics()
  }

  /** Меняет persisted Type Source. */
  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  resetSource(): void {
    this.applySourceText(Endge.source.createDefault('type'))
  }

  refreshDiagnostics(): void {
    this.diagnostics = (Endge.source.validate('type', this.source).diagnostics ?? []) as ProgramDiagnostic[]
  }
}
