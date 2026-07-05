import { RComponentTableColumnEditor } from '@/features/endge-ide/domain/entities/RComponentTableColumnEditor'
import type { RComponentTable } from '@endge/core'
import { ComponentType } from '@endge/core'

import { RComponentBaseEditor } from '@/features/endge-ide/domain/entities/RComponentBaseEditor'
import type { RComponentTableColumn } from '@endge/core'
import type { TableBinding } from '@endge/core'

//
// Модель для редактирования RComponentTable компонента.
// После сохранения переводится в RComponentTable.
export class RComponentTableEditor extends RComponentBaseEditor<RComponentTable> {
  columns: Array<RComponentTableColumnEditor> = []

  selectedColumns: RComponentTableColumnEditor[] = []

  get selectedColumn(): RComponentTableColumnEditor | null {
    return this.selectedColumns?.[0] || null
  }

  // источник данных для таблицы (берет количество элементов для revoGrid)
  sourceIndex: number = 0

  bindings: TableBinding = { keys: {} }

  // Высота строки
  // zoom - рассчитывается от настроек зума
  rowSize: string | number | 'zoom' = 40

  // Добавляет колонку в таблицу в конец
  addColumn(title: string = ''): void {
    const column = new RComponentTableColumnEditor()
    column.title = title
    column.type = ComponentType.Component
    this.columns.push(column)
  }

  // Удаление элементов (по ссылке)
  deleteColumns(cols: RComponentTableColumnEditor[]): void {
    if (!cols.length) return
    this.columns = this.columns.filter((col) => !cols.includes(col))
    if (this.selectedColumn && cols.includes(this.selectedColumn))
      this.selectedColumns = []
  }

  /** Перемещение колонки с fromIndex на toIndex */
  moveColumn(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    const len = this.columns.length
    if (fromIndex >= len || toIndex >= len) return
    const [removed] = this.columns.splice(fromIndex, 1)
    this.columns.splice(toIndex, 0, removed)
    if (this.selectedColumns[0] === removed)
      this.selectedColumns = [removed]
  }

  /** Выбрать колонку по индексу (для нижней панели) */
  selectColumnByIndex(index: number | null): void {
    if (index == null || index < 0 || index >= this.columns.length) {
      this.selectedColumns = []
      return
    }
    this.selectedColumns = [this.columns[index]]
  }

  // Обновляет доменную сущность на основании редактора
  updateSource(source: RComponentTable): void {
    this.updateBaseFields(source)
    source.sourceIndex = this.sourceIndex
    source.bindings = this.bindings
    source.rowSize = this.rowSize

    source.columns = this.columns
      .map((x) => x.toSource())
      .filter(Boolean) as RComponentTableColumn[]
  }

  // Заполняет редактор из доменной сущности
  fillFromSource(source: RComponentTable): void {
    this.fillBaseFields(source)
    this.sourceIndex = source.sourceIndex
    this.rowSize = source.rowSize
    this.bindings = source.bindings

    this.columns = source.columns.map((col) => {
      const editor = new RComponentTableColumnEditor()
      editor.fromSource(col)
      return editor
    })
  }
}
