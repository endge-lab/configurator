import type { RScenario } from '@endge/core'
import type { ScriptType } from '@endge/core'

/**
 * Редакторская модель для сценария (`RScenario`)
 */
export class RScenarioEditor {
  id!: number
  identity!: string
  name!: string
  type!: ScriptType
  setupScript!: string

  constructor() {}

  /**
   * Заполняет редактор из доменной сущности.
   * @param source - доменная модель сценария
   */
  fillFromSource(source: RScenario): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.type = source.type
    this.setupScript = source.setupScript
  }

  /**
   * Обновляет доменную сущность на основании данных редактора.
   * @param source - доменная модель, которую нужно обновить
   */
  updateSource(source: RScenario): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.name
    source.type = this.type
    source.setupScript = this.setupScript
  }
}
