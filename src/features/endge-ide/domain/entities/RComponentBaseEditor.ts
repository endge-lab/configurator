import type { ComponentType, RComponentBase } from '@endge/core'

import { RField } from '@endge/core'
import { Expose } from 'class-transformer'

import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor'

/**
 * Базовый абстрактный редактор для всех сущностей
 */
export abstract class RComponentBaseEditor<TSource extends RComponentBase> {
  id!: number

  identity!: string

  name!: string

  type!: ComponentType

  // Список входных переменных
  inputFields: RFieldEditor[] = []

  // Перехвачено ли управление кастомным кодом
  hasCustomRenderer: boolean = false

  @Expose()
  runtimeFilters: string[] = []

  /**
   * Преобразует редактор в доменную сущность
   * @param source Сущность компонента
   */
  updateBaseFields(source: TSource): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.name
    source.type = this.type
    source.runtimeFilters = this.runtimeFilters

    // inputFields - Record<string, RField>
    const record: Record<string, RField> = {}
    for (const editorField of this.inputFields) {
      const field = new RField(editorField.name, editorField.type)
      editorField.updateSource(field)
      record[editorField.name] = field
    }

    source.inputFields = record
  }

  /**
   * Заполняет редактор из доменной сущности
   * @param source Сущность компонента
   */
  fillBaseFields(source: TSource): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.type = source.type
    this.runtimeFilters = source.runtimeFilters
    this.hasCustomRenderer = source.customRenderer !== null

    // Record<string, RField> - RFieldEditor[]
    this.inputFields = Object.values(source.inputFields || {}).map((field) => {
      const editor = new RFieldEditor()
      editor.fillFromSource(field)
      return editor
    })
  }
}
