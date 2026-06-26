import type { EndgeAdminFlowBlockSpec } from '@/features/endge-admin/domain/action-flow/endge-admin-flow-catalog.types.ts'

import { ENDGE_ADMIN_ACTION_FLOW_DEFAULT_BLOCKS } from '@/features/endge-admin/config/action-flow-default-blocks.ts'

/**
 * Каталог блоков action-flow для редактора админки.
 * Хранит только editor metadata и не участвует в исполнении flow в ядре.
 */
export class EndgeAdminFlowCatalog {
  private _blocks: EndgeAdminFlowBlockSpec[] = []

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
    this._blocks = ENDGE_ADMIN_ACTION_FLOW_DEFAULT_BLOCKS.map(block => ({
      ...block,
      inputPorts: block.inputPorts.map(port => ({ ...port })),
      outputPorts: block.outputPorts.map(port => ({ ...port })),
      meta: { ...block.meta },
    }))
  }

  /**
   * Возвращает список доступных block spec для flow-редактора.
   */
  public listBlockSpecs(): EndgeAdminFlowBlockSpec[] {
    return this._blocks.map(block => ({
      ...block,
      inputPorts: block.inputPorts.map(port => ({ ...port })),
      outputPorts: block.outputPorts.map(port => ({ ...port })),
      meta: { ...block.meta },
    }))
  }
}
