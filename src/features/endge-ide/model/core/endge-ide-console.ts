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

}
