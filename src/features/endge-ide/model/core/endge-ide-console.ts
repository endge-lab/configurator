import type { EndgeContract } from '@endge/core'

import { Endge } from '@endge/core'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

/**
 * Подмодуль консоли для дебага. Регистрирует команды в ядре (Endge.console).
 */
export class EndgeIDEConsole {
  /**
   * LIFECYCLE
   */
  public init(): void {
    Endge.console.register('tab', () => this.tab(), 'Текущая вкладка IDE')
    Endge.console.register('document', () => this.document(), 'Текущий документ и editor model')
    Endge.console.register('contracts', () => this.contracts(), 'Все зарегистрированные contracts')
    Endge.console.exposeToGlobal()
  }

  public reset(): void {}

  /**
   * Вывести информацию о текущей открытой вкладке
   */
  public tab(): void | Promise<void> {
    console.log(EndgeIDE.tabs.activeTab.value)
  }

  /**
   * Вывести информацию о текущем открытом документе
   */
  public document(): void | Promise<void> {
    console.log('[DomainModel]')
    console.log(EndgeIDE.tabs.documentModel)
    console.log('[EditorModel]')
    console.log(EndgeIDE.tabs.documentEditorModel.value)
  }

  /**
   * Вывести в консоль все доступные contracts faceted cascade
   */
  public contracts(): EndgeContract[] {
    const contracts = [...Endge.contracts.getAll()].sort((a, b) => {
      const aFacet = String(a.facet ?? '')
      const bFacet = String(b.facet ?? '')
      if (aFacet !== bFacet)
        return aFacet.localeCompare(bFacet)

      const aEntity = String(a.entityType ?? '')
      const bEntity = String(b.entityType ?? '')
      if (aEntity !== bEntity)
        return aEntity.localeCompare(bEntity)
      const aSelector = 'eventName' in a
        ? String(a.eventName ?? '')
        : 'role' in a
          ? String(a.role ?? '')
          : String(a.fieldPath ?? '')
      const bSelector = 'eventName' in b
        ? String(b.eventName ?? '')
        : 'role' in b
          ? String(b.role ?? '')
          : String(b.fieldPath ?? '')
      return aSelector.localeCompare(bSelector)
    })

    console.log('[Contracts]')
    console.table(contracts.map(contract => ({
      facet: contract.facet,
      entityType: contract.entityType,
      selector: 'eventName' in contract
        ? contract.eventName
        : 'role' in contract
          ? contract.role
          : contract.fieldPath,
      title: contract.title,
      kind: 'eventName' in contract
        ? contract.eventKind
        : 'role' in contract
          ? contract.contractKind
          : contract.valueType,
      scope: contract.scope,
      supportsBinding: contract.supportsBinding !== false,
      supportsEnvironmentOverride: contract.supportsEnvironmentOverride === true,
    })))
    console.log(contracts)

    return contracts
  }
}
