import type {
  ConfiguratorChromeBridgeRequest,
  ConfiguratorChromeBridgeResponse,
  EndgeAdminBridgeApi,
  EndgeAdminBridgeBundle,
} from '@/app/domain/types/configurator-chrome-bridge.type'

import type { ConfiguratorChromeBridge_Adapter } from '@/app/model/adapters/ConfiguratorChromeBridge_Adapter'
import { Endge } from '@endge/core'

const REQUEST_SOURCE = 'endge-chrome-extension'
const RESPONSE_SOURCE = 'endge-admin-bridge'
const BRIDGE_VERSION = '1.0.0'

/** Owns the browser bridge for the complete Configurator application lifetime. */
export class ConfiguratorChromeBridge_Module {
  /** Browser adapter, installation state и stable event callback. */
  private readonly _browser: ConfiguratorChromeBridge_Adapter
  private _installed = false
  private readonly _handleBridgeMessage = (event: MessageEvent<ConfiguratorChromeBridgeRequest>): void => {
    if (!this._browser.isCurrentContext(event)) {
      return
    }

    const data = event.data
    if (!data || data.source !== REQUEST_SOURCE || !data.requestId) {
      return
    }

    try {
      if (data.type === 'ENDGE_BRIDGE_PING') {
        this._postBridgeResponse({
          source: RESPONSE_SOURCE,
          requestId: data.requestId,
          ok: true,
          payload: this._buildPingPayload(),
        })
        return
      }

      if (data.type === 'ENDGE_BRIDGE_EXPORT_DOMAIN') {
        this._postBridgeResponse({
          source: RESPONSE_SOURCE,
          requestId: data.requestId,
          ok: true,
          payload: this._buildBundle(),
        })
        return
      }

      this._postBridgeResponse({
        source: RESPONSE_SOURCE,
        requestId: data.requestId,
        ok: false,
        error: `Unsupported bridge request: ${data.type}`,
      })
    }
    catch (error) {
      this._postBridgeResponse({
        source: RESPONSE_SOURCE,
        requestId: data.requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown bridge error',
      })
    }
  }

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Создаёт bridge-модуль с явным browser adapter. */
  public constructor(browser: ConfiguratorChromeBridge_Adapter) {
    this._browser = browser
  }

  /** Устанавливает browser bridge один раз на lifecycle приложения. */
  public setup(): void {
    if (this._installed) {
      return
    }
    this._installed = this._browser.install(this._createBridgeApi(), this._handleBridgeMessage)
  }

  /** Освобождает browser bridge и его event listener. */
  public destroy(): void {
    if (!this._installed) {
      return
    }
    this._browser.destroy(this._handleBridgeMessage)
    this._installed = false
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  /** Собирает readonly domain bundle для browser extension. */
  private _buildBundle(): EndgeAdminBridgeBundle {
    return {
      version: BRIDGE_VERSION,
      exportedAt: new Date().toISOString(),
      sourceUrl: this._browser.page().url,
      projectId: Endge.context.getCurrentProject(),
      environment: Endge.context.getCurrentEnvironment(),
      domain: Endge.domainSnapshot.serialize(Endge.domain),
    }
  }

  /** Возвращает метаданные текущего bridge context. */
  private _buildPingPayload() {
    return {
      platform: 'endge-admin' as const,
      version: BRIDGE_VERSION,
      url: this._browser.page().url,
      title: this._browser.page().title,
      projectId: Endge.context.getCurrentProject(),
      environment: Endge.context.getCurrentEnvironment(),
    }
  }

  /** Создаёт стабильный public contract для browser extension. */
  private _createBridgeApi(): EndgeAdminBridgeApi {
    return {
      platform: 'endge-admin',
      version: BRIDGE_VERSION,
      ping: () => this._buildPingPayload(),
      exportDomainBundle: () => this._buildBundle(),
    }
  }

  /** Отправляет ответ через browser adapter. */
  private _postBridgeResponse(message: ConfiguratorChromeBridgeResponse): void {
    this._browser.post(message)
  }
}
