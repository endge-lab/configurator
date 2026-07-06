import type { EndgeBootContext, EndgeDataProvider } from '@endge/core'

import { Endge } from '@endge/core'
import { EndgeVuePlugin } from '@endge/vue'

import domainJson from '@/mock/endge-domain.json'

/**
 * Композитный слой для соединения логики Endge/EndgeIDE федераций
 */
export class EndgeConfigurator {
  private static _isInitialized = false
  private static _isVuePluginInstallAttempted = false

  /**
   * Одноразово запускает прикладное ядро конфигуратора.
   * Подключает Vue-плагин Endge и передает boot-контекст в централизованный `Endge.boot()`.
   */
  public static async init(): Promise<void> {
    const ctx = this._createBootContext()

    this._installVuePlugin()
    await Endge.boot(ctx)

    this._isInitialized = true
  }

  /**
   * Сбрасывает состояние Endge и локальный флаг запуска приложения.
   * Используется для полного повторного boot без пересоздания `EndgeConfigurator`.
   */
  public static async reset(): Promise<void> {
    if (!this.isInitialized)
      return

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
      plainSource: dataProvider === 'plain' ? domainJson.domain : undefined,
      payload: dataProvider === 'payload'
        ? {
            baseAPI: import.meta.env.VITE_PAYLOAD_BASE_URL || '',
            secret: import.meta.env.VITE_PAYLOAD_SECRET || '',
          }
        : undefined,
    }
  }

  /**
   * Регистрирует Vue-плагин до конфигурации federation.
   * В HMR-сценарии federation host может быть уже configured в globalThis,
   * поэтому повторную регистрацию считаем нефатальной и продолжаем boot.
   */
  private static _installVuePlugin(): void {
    if (this._isVuePluginInstallAttempted)
      return

    this._isVuePluginInstallAttempted = true

    try {
      Endge.use(EndgeVuePlugin)
    }
    catch (error) {
      if (!this._isPluginAlreadyLockedError(error))
        throw error
    }
  }

  private static _isPluginAlreadyLockedError(error: unknown): boolean {
    return String(error).includes('plugins must be registered before federation configuration')
  }

  /**
   * Показывает, был ли уже выполнен успешный boot текущего приложения.
   */
  public static get isInitialized(): boolean {
    return this._isInitialized
  }
}
