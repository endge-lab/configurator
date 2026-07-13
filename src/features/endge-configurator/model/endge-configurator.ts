import type { EndgeBootContext, EndgeDataProvider } from '@endge/core'

import {
  DEFAULT_ENDGE_WORKSPACE,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
} from '@endge/core'

import domainJson from '@/mock/endge-domain.json'

/**
 * Композитный слой для соединения логики Endge/EndgeIDE федераций
 */
export class EndgeConfigurator {
  private static _isInitialized = false

  /**
   * Одноразово запускает прикладное ядро конфигуратора.
   * Передает boot-контекст в `Endge.boot()` и проверяет выбранный renderer adapter.
   */
  public static async init(): Promise<void> {
    const ctx = this._createBootContext()

    await Endge.boot(ctx)
    this._assertWorkspaceRendererReady()

    this._isInitialized = true
  }

  /**
   * Сбрасывает состояние Endge и локальный флаг запуска приложения.
   * Используется для полного повторного boot без пересоздания `EndgeConfigurator`.
   */
  public static async reset(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    await Endge.reset()
    this._isInitialized = false
  }

  /**
   * Собирает boot-контекст из env-переменных и mock-домена.
   * Payload включается только при явном `VITE_STORAGE_PROVIDER=payload`.
   */
  private static _createBootContext(): EndgeBootContext {
    const rawProvider = String(import.meta.env.VITE_STORAGE_PROVIDER || 'plain').trim().toLowerCase()
    const dataProvider: EndgeDataProvider = rawProvider === 'payload' ? 'payload' : 'plain'

    return {
      dataProvider,
      scope: {},
      vars: {
        ENDPOINT_AUTH: import.meta.env.VITE_ENDPOINT_AUTH,
      },
      plainSource: dataProvider === 'plain'
        ? {
            ...domainJson.domain,
            workspace: {
              ...DEFAULT_ENDGE_WORKSPACE,
              sfcAdapterIds: ['native-vue', 'shadcn-vue'],
            },
          }
        : undefined,
      payload: dataProvider === 'payload'
        ? {
            baseAPI: import.meta.env.VITE_PAYLOAD_BASE_URL || '',
            secret: import.meta.env.VITE_PAYLOAD_SECRET || '',
          }
        : undefined,
    }
  }

  private static _assertWorkspaceRendererReady(): void {
    const adapter = Endge.uiRegistry.adapters.requireActive({
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })

    if (adapter.id !== Endge.workspace.defaultSfcAdapterId) {
      throw new Error(
        `[EndgeConfigurator] active SFC adapter "${adapter.id}" does not match workspace adapter "${Endge.workspace.defaultSfcAdapterId}"`,
      )
    }
  }

  /**
   * Показывает, был ли уже выполнен успешный boot текущего приложения.
   */
  public static get isInitialized(): boolean {
    return this._isInitialized
  }
}
