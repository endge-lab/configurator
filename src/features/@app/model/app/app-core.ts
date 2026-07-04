import type { BootstrapStepName } from '@endge/core'

import { Endge, EndgeFederation } from '@endge/core'
import { EndgeVue } from '@endge/vue'

import { AppDomain } from '@/features/@app/model/app/app-domain.ts'
import domainJson from '@/mock/endge-domain.json'

export class AppCore extends EndgeFederation {
  protected static override readonly federationId = 'app-core'
  protected static override readonly storageKey = 'app:settings'

  protected static override configureFederation(): void {
    this.registerModule('domain', new AppDomain())
  }

  public static get domain(): AppDomain {
    return this.getModule<AppDomain>('domain')
  }

  private static get isFrameworkInitialized(): boolean {
    return this.getState<boolean>('frameworkInitialized', () => false)
  }

  private static set isFrameworkInitialized(value: boolean) {
    this.setState('frameworkInitialized', value)
  }

  public static async init(): Promise<void> {
    if (this.isInitialized)
      return

    const rawStorageProvider = String(import.meta.env.VITE_STORAGE_PROVIDER || 'plain').trim().toLowerCase()
    const storageProvider = rawStorageProvider === 'plane' ? 'plain' : rawStorageProvider

    await Endge.app.runLoading(async () => {
      await this.runInitialization(async () => {
        await this.setup()

        await Endge.init({
          debug: true,
          provider: storageProvider === 'payload' ? 'payload' : 'plain',
          payloadBaseAPI: import.meta.env.VITE_PAYLOAD_BASE_URL || undefined,
          payloadSecret: import.meta.env.VITE_PAYLOAD_SECRET || undefined,
          plainDomain: domainJson.domain,
          vars: {
            ENDPOINT_AUTH: import.meta.env.VITE_ENDPOINT_AUTH,
          }
        })

        if (!this.isFrameworkInitialized) {
          EndgeVue.init()
          this.isFrameworkInitialized = true
        }

        Endge.domain.compile()

        this.loadFromStorage()
        await this.initModules()

        Endge.console.exposeToGlobal()
      })
    })
  }

  public static async bootstrap(steps: BootstrapStepName[]): Promise<void> {
    await Endge.app.runLoading(async () => {
      await Endge.bootstrap.run(steps)
    })
  }

  public static async reset(): Promise<void> {
    await this.resetModules()
  }
}
