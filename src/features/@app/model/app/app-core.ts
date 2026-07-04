import type { EndgeBootContext, EndgeDataProvider } from '@endge/core'

import { Endge } from '@endge/core'
import { EndgeVuePlugin } from '@endge/vue'

import domainJson from '@/mock/endge-domain.json'

export class AppCore {
  private static _isInitialized = false

  public static async init(): Promise<void> {
    if (this.isInitialized)
      return

    const ctx = this._createBootContext()

    Endge.use(EndgeVuePlugin)
    await Endge.boot(ctx)

    this._isInitialized = true
  }

  public static async reset(): Promise<void> {
    if (!this.isInitialized)
      return

    await Endge.reset()
    this._isInitialized = false
  }

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

  public static get isInitialized(): boolean {
    return this._isInitialized
  }
}
