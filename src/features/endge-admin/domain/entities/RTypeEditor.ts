import type { RType } from '@endge/core'

import { RField } from '@endge/core'

import { RFieldEditor } from '@/features/endge-admin/domain/entities/RFieldEditor'

//
// Модель для редактирования RType. Поля - массив (доменная RType.fields остаётся Map).
export class RTypeEditor {
  id!: number
  identity!: string
  name!: string
  isPrimitive!: boolean
  fields: RFieldEditor[] = []

  /** Переносит данные редактора в доменную сущность (RType.fields - Map по имени). */
  updateSource(source: RType): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.name
    source.isPrimitive = this.isPrimitive
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
    this.fields = []
    for (const [, field] of source.fields) {
      const editor = new RFieldEditor()
      editor.fillFromSource(field)
      this.fields.push(editor)
    }
  }
}
