import type { EndgeBootContext } from '@endge/core'

import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
} from '@endge/core'

import { registerEndgeMockProviders } from '@/features/endge-configurator/model/endge-mock-providers'

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

    registerEndgeMockProviders()
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
   * Собирает Payload boot-контекст из env-переменных.
   */
  private static _createBootContext(): EndgeBootContext {
    const baseAPI = String(import.meta.env.VITE_PAYLOAD_BASE_URL || '').trim()
    const secret = String(import.meta.env.VITE_PAYLOAD_SECRET || '').trim()
    const workspaceIdentity = String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
    if (!baseAPI || !secret) {
      throw new Error(
        '[EndgeConfigurator] VITE_PAYLOAD_BASE_URL and VITE_PAYLOAD_SECRET are required',
      )
    }

    return {
      dataProvider: 'payload',
      scope: workspaceIdentity ? { workspaceIdentity } : {},
      vars: {
        ENDPOINT_AUTH: import.meta.env.VITE_ENDPOINT_AUTH,
      },
      payload: { baseAPI, secret },
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
