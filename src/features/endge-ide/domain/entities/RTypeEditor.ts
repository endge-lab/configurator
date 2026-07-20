import type { ProgramDiagnostic, RType } from '@endge/core'

import { Endge, RField } from '@endge/core'

import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor'

//
// Модель для редактирования RType. Поля - массив (доменная RType.fields остаётся Map).
export class RTypeEditor {
  id!: string
  identity!: string
  name!: string
  isPrimitive!: boolean
  fields: RFieldEditor[] = []
  source: string = ''
  sourceVersion: number = 1
  diagnostics: ProgramDiagnostic[] = []

  /** Переносит данные редактора в доменную сущность (RType.fields - Map по имени). */
  updateSource(source: RType): void {
    source.identity = this.identity
    source.name = this.name
    source.isPrimitive = this.isPrimitive
    source.source = this.source
    source.sourceVersion = this.sourceVersion
    source.fields = new Map()
    for (const fieldEditor of this.fields) {
      const field = new RField(fieldEditor.name, fieldEditor.type)
      fieldEditor.updateSource(field)
      source.addField(field)
    }
  }

  /** Заполняет редактор из доменной сущности. */
  fillFromSource(source: RType): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.isPrimitive = source.isPrimitive
    this.source = String(source.source ?? '')
    this.sourceVersion = Math.max(1, Number(source.sourceVersion ?? 1) || 1)
    this.fields = []
    for (const [, field] of source.fields) {
      const editor = new RFieldEditor()
      editor.fillFromSource(field)
      this.fields.push(editor)
    }
    this.refreshDiagnostics()
  }

  /** Меняет только новый persisted source; legacy fields остаются без изменений. */
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
