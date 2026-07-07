import type { RDataView } from '@endge/core'

import { Endge } from '@endge/core'

/** Source-first editor model для `RDataView`. */
export class RDataViewEditor {
  id!: number | string
  identity!: string
  name!: string
  description: string = ''
  source: string = ''
  sourceVersion: number = 1
  diagnostics: unknown[] = []

  /** Заполняет editor persisted source-полями. */
  fillFromSource(source: RDataView): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String((source as { description?: string }).description ?? '')
    this.source = String(source.source ?? '')
    this.sourceVersion = Number(source.sourceVersion ?? 1) || 1
    this.refreshDiagnostics()
  }

  /** Обновляет persisted DataView из editor source-полей. */
  updateSource(target: RDataView): void {
    target.id = this.id as any
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    ;(target as { description?: string }).description = this.description
    target.source = this.source
    target.sourceVersion = this.sourceVersion
  }

  /** Применяет ручное изменение source и обновляет diagnostics. */
  applySourceText(source: string): void {
    this.source = source
    this.refreshDiagnostics()
  }

  /** Сбрасывает source к базовому шаблону DataView v1. */
  resetSource(): void {
    this.applySourceText(Endge.source.createDefault('data-view'))
  }

  /** Обновляет diagnostics через source language strategy. */
  refreshDiagnostics(): void {
    this.diagnostics = Endge.source.validate('data-view', this.source).diagnostics ?? []
  }
}
