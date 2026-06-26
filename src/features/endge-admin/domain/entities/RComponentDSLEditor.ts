import type { RComponentDSL } from '@endge/core'
import { RComponentBaseEditor } from '@/features/endge-admin/domain/entities/RComponentBaseEditor'

//
// Модель для редактирования RComponentDSL компонента.
// После сохранения переводится в RComponentDSL.
export class RComponentDSLEditor extends RComponentBaseEditor<RComponentDSL> {
  // Код DSL скрипта
  jsxScript!: string

  // Обновляет доменную сущность на основании скомпилированной сущности
  // Является DTO для передачи данных между слоями
  updateSource(source: RComponentDSL): void {
    this.updateBaseFields(source)
    source.jsxScript = this.jsxScript
  }

  /**
   * Заполняет поля сущности на основании доменной сущности
   */
  fillFromSource(source: RComponentDSL): void {
    this.fillBaseFields(source)
    this.jsxScript = source.jsxScript
  }
}
