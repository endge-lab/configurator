import type {
  ConfiguratorChromeBridgeRequest,
  ConfiguratorChromeBridgeResponse,
  EndgeAdminBridgeApi,
  EndgeAdminBridgeBundle,
} from '@/app/domain/types/configurator-chrome-bridge.type'

import { Endge } from '@endge/core'

const REQUEST_SOURCE = 'endge-chrome-extension'
const RESPONSE_SOURCE = 'endge-admin-bridge'
const BRIDGE_VERSION = '1.0.0'

/** Owns the browser bridge for the complete Configurator application lifetime. */
export class ConfiguratorChromeBridge_Module {
  private _installed = false

  public setup(): void {
    if (this._installed || typeof window === 'undefined') {
      return
    }

    document.documentElement.dataset.endgeAdminBridge = '1'
    window.__ENDGE_ADMIN_BRIDGE__ = this._createBridgeApi()
    window.addEventListener('message', this._handleBridgeMessage as EventListener)
    this._installed = true
  }

  public destroy(): void {
    if (!this._installed || typeof window === 'undefined') {
      return
    }

    window.removeEventListener('message', this._handleBridgeMessage as EventListener)
    delete window.__ENDGE_ADMIN_BRIDGE__
    delete document.documentElement.dataset.endgeAdminBridge
    this._installed = false
  }

  private readonly _handleBridgeMessage = (event: MessageEvent<ConfiguratorChromeBridgeRequest>): void => {
    if (event.source !== window) {
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

  private _buildBundle(): EndgeAdminBridgeBundle {
    return {
      version: BRIDGE_VERSION,
      exportedAt: new Date().toISOString(),
      sourceUrl: window.location.href,
      projectId: Endge.context.getCurrentProject(),
      environment: Endge.context.getCurrentEnvironment(),
      domain: Endge.domain.toPlain(),
    }
  }

  private _buildPingPayload() {
    return {
      platform: 'endge-admin' as const,
      version: BRIDGE_VERSION,
      url: window.location.href,
      title: document.title,
      projectId: Endge.context.getCurrentProject(),
      environment: Endge.context.getCurrentEnvironment(),
    }
  }

  private _createBridgeApi(): EndgeAdminBridgeApi {
    return {
      platform: 'endge-admin',
      version: BRIDGE_VERSION,
      ping: () => this._buildPingPayload(),
      exportDomainBundle: () => this._buildBundle(),
    }
  }

  private _postBridgeResponse(message: ConfiguratorChromeBridgeResponse): void {
    window.postMessage(message, window.location.origin)
  }
}
