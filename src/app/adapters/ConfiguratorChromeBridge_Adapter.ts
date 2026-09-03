import type { ConfiguratorChromeBridgeRequest, ConfiguratorChromeBridgeResponse, EndgeAdminBridgeApi } from '@/app/domain/types/configurator-chrome-bridge.type'

/** Изолирует browser APIs Chrome bridge от прикладного модуля. */
export class ConfiguratorChromeBridge_Adapter {
  /** Устанавливает публичный API и подписку на bridge messages. */
  public install(api: EndgeAdminBridgeApi, listener: (event: MessageEvent<ConfiguratorChromeBridgeRequest>) => void): boolean {
    if (typeof window === 'undefined') {
      return false
    }
    document.documentElement.dataset.endgeAdminBridge = '1'
    window.__ENDGE_ADMIN_BRIDGE__ = api
    window.addEventListener('message', listener as EventListener)
    return true
  }

  /** Снимает browser bridge и его marker. */
  public destroy(listener: (event: MessageEvent<ConfiguratorChromeBridgeRequest>) => void): void {
    if (typeof window === 'undefined') {
      return
    }
    window.removeEventListener('message', listener as EventListener)
    delete window.__ENDGE_ADMIN_BRIDGE__
    delete document.documentElement.dataset.endgeAdminBridge
  }

  /** Проверяет, что сообщение отправлено текущим browser context. */
  public isCurrentContext(event: MessageEvent): boolean {
    return typeof window !== 'undefined' && event.source === window
  }

  /** Возвращает browser metadata текущей страницы. */
  public page(): { url: string, title: string } {
    return {
      url: typeof window === 'undefined' ? '' : window.location.href,
      title: typeof document === 'undefined' ? '' : document.title,
    }
  }

  /** Отправляет ответ расширению в origin текущей страницы. */
  public post(message: ConfiguratorChromeBridgeResponse): void {
    if (typeof window !== 'undefined') {
      window.postMessage(message, window.location.origin)
    }
  }
}
