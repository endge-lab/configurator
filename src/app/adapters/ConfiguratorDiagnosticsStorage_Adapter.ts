import { Endge } from '@endge/core'

/** Выполняет emergency cleanup browser state Configurator. */
export class ConfiguratorDiagnosticsStorage_Adapter {
  /** Удаляет persisted UI state, способный повторно вызвать render failure. */
  public clearEndgeIDEState(): void {
    if (typeof window === 'undefined') {
      return
    }
    try {
      Endge.context.removeState('configurator.smart-tabs')
      Endge.context.removeState('configurator.layout.grid.endge-ide')
      localStorage.removeItem('endge-editor-tabs')
      localStorage.removeItem('app:grid-layout-state')
    }
    catch {
      // Emergency cleanup является best-effort операцией.
    }
  }
}
