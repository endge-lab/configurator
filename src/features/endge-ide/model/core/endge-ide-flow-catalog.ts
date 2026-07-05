import type { EndgeIDEFlowBlockSpec } from '@/features/endge-ide/domain/action-flow/endge-ide-flow-catalog.types.ts'

import { ENDGE_IDE_ACTION_FLOW_DEFAULT_BLOCKS } from '@/features/endge-ide/config/action-flow-default-blocks.ts'

/**
 * Каталог блоков action-flow для IDE-редактора.
 * Хранит только editor metadata и не участвует в исполнении flow в ядре.
 */
export class EndgeIDEFlowCatalog {
  private _blocks: EndgeIDEFlowBlockSpec[] = []

  /**
   * Инициализирует каталог дефолтным набором блоков.
   */
  public init(): void {
    if (this._blocks.length > 0)
      return

    this.reset()
  }

  /**
   * Сбрасывает каталог к дефолтной конфигурации блоков.
   */
  public reset(): void {
    this._blocks = ENDGE_IDE_ACTION_FLOW_DEFAULT_BLOCKS.map(block => ({
      ...block,
      inputPorts: block.inputPorts.map(port => ({ ...port })),
      outputPorts: block.outputPorts.map(port => ({ ...port })),
      meta: { ...block.meta },
    }))
  }

  /**
   * Возвращает список доступных block spec для flow-редактора.
   */
  public listBlockSpecs(): EndgeIDEFlowBlockSpec[] {
    return this._blocks.map(block => ({
      ...block,
      inputPorts: block.inputPorts.map(port => ({ ...port })),
      outputPorts: block.outputPorts.map(port => ({ ...port })),
      meta: { ...block.meta },
    }))
  }
}
