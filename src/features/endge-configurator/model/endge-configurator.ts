import type { EndgeBootContext, EndgeDataProvider } from '@endge/core'

import { DEFAULT_ENDGE_WORKSPACE, Endge } from '@endge/core'
import { EndgeShadcnVuePlugin } from '@endge/shadcn-vue'
import { EndgeVuePlugin } from '@endge/vue'

import domainJson from '@/mock/endge-domain.json'

/**
 * Композитный слой для соединения логики Endge/EndgeIDE федераций
 */
export class EndgeConfigurator {
  private static _isInitialized = false
  private static _isRendererPluginInstallAttempted = false

  /**
   * Одноразово запускает прикладное ядро конфигуратора.
   * Подключает Vue-плагин Endge и передает boot-контекст в централизованный `Endge.boot()`.
   */
  public static async init(): Promise<void> {
    const ctx = this._createBootContext()

    this._installRendererPlugins()
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

  /**
   * Регистрирует Vue renderer-плагины до конфигурации federation.
   * В HMR-сценарии federation host может быть уже configured в globalThis,
   * поэтому повторную регистрацию считаем нефатальной и продолжаем boot.
   */
  private static _installRendererPlugins(): void {
    if (this._isRendererPluginInstallAttempted)
      return

    this._isRendererPluginInstallAttempted = true

    for (const plugin of [EndgeVuePlugin, EndgeShadcnVuePlugin]) {
      try {
        Endge.use(plugin)
      }
      catch (error) {
        if (!this._isPluginAlreadyLockedError(error))
          throw error
      }
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
