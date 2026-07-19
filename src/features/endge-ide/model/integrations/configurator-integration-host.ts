import type {
  IntegrationConfiguratorLifecycleApi,
  IntegrationContext,
  IntegrationDisposer,
  IntegrationDomainApi,
  IntegrationModule,
} from '@endge/integration-api'

import { Endge, RIntegration } from '@endge/core'

import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'
import { ConfiguratorWidgetRegistry } from '@/features/endge-ide/model/integrations/configurator-widget-registry'

const LOCAL_OWNER = 'configurator:test-integrations'

function unavailable(operation: string): never {
  throw new Error(`[ConfiguratorIntegrationHost] ${operation} is not available in the widget-only runtime.`)
}

function createUnavailableDomainApi(): IntegrationDomainApi {
  return {
    get: async () => unavailable('domain.get'),
    list: async () => unavailable('domain.list'),
    create: async () => unavailable('domain.create'),
    update: async () => unavailable('domain.update'),
    delete: async () => unavailable('domain.delete'),
    ensure: async () => unavailable('domain.ensure'),
  }
}

interface ActiveIntegration {
  disposers: IntegrationDisposer[]
}

/** Runs configurator-only integration entrypoints against the current workspace. */
export class ConfiguratorIntegrationHost {
  private readonly _widgets = new ConfiguratorWidgetRegistry()
  private readonly _modules: IntegrationModule[]
  private readonly _active: ActiveIntegration[] = []
  private _removeSurface: (() => void) | null = null

  constructor(modules: IntegrationModule[]) {
    this._modules = modules
  }

  public async start(): Promise<IntegrationDisposer> {
    await this.reset()
    this._removeSurface?.()
    this._removeSurface = EndgeIDEContext.registerSurface('configurator-integrations', {
      beforeContextReset: () => this.reset(),
      afterContextBoot: () => this.activate(),
    })
    await this.activate()

    return () => this.stop()
  }

  public async stop(): Promise<void> {
    this._removeSurface?.()
    this._removeSurface = null
    await this.reset()
  }

  public async activate(): Promise<void> {
    await this.reset()

    for (const [index, module] of this._modules.entries()) {
      const disposers: IntegrationDisposer[] = []
      try {
        const context = this._materializeLocalIntegration(module, index, disposers)
        const api = this._createApi(context, disposers)
        const moduleDisposer = await module.configurator?.(api)
        if (moduleDisposer) {
          disposers.push(moduleDisposer)
        }
        this._active.push({ disposers })
      }
      catch (error) {
        await this._dispose(disposers)
        console.error(
          `[ConfiguratorIntegrationHost] Failed to activate "${module.manifest.identity}".`,
          error,
        )
      }
    }
  }

  public async reset(): Promise<void> {
    const active = this._active.splice(0).reverse()
    for (const integration of active) {
      await this._dispose(integration.disposers)
    }
  }

  private _createApi(
    context: IntegrationContext,
    disposers: IntegrationDisposer[],
  ): IntegrationConfiguratorLifecycleApi {
    return {
      context,
      domain: createUnavailableDomainApi(),
      configurator: {
        widgets: {
          register: (widget) => {
            const disposer = this._widgets.register(context, widget)
            disposers.push(disposer)
            return disposer
          },
        },
        workspaceViews: {
          register: () => unavailable('configurator.workspaceViews.register'),
          open: async () => unavailable('configurator.workspaceViews.open'),
        },
        menu: {
          add: () => unavailable('configurator.menu.add'),
        },
      },
    }
  }

  private _materializeLocalIntegration(
    module: IntegrationModule,
    index: number,
    disposers: IntegrationDisposer[],
  ): IntegrationContext {
    const { manifest } = module
    const existing = Endge.domain.getIntegrationByIdentity(manifest.identity)
    const integration = existing ?? this._createLocalIntegration(module, index)

    if (!existing) {
      Endge.domain.addIntegration(integration)
      disposers.push(() => Endge.domain.removeIntegrationByIdentity(integration.identity))
    }

    const references = Endge.workspace.current.installedIntegrations
    const existingReference = references.find(reference =>
      reference.integrationIdentity === manifest.identity
      && reference.version === manifest.version,
    )
    if (!existingReference) {
      const reference = {
        integrationId: integration.id,
        integrationIdentity: manifest.identity,
        version: manifest.version,
      }
      references.push(reference)
      disposers.push(() => {
        const referenceIndex = references.indexOf(reference)
        if (referenceIndex >= 0) {
          references.splice(referenceIndex, 1)
        }
      })
    }

    return {
      integrationId: integration.id,
      integrationIdentity: manifest.identity,
      version: manifest.version,
      workspaceId: Endge.workspace.current.identity,
      installationId: `local:${Endge.workspace.current.identity}:${manifest.identity}`,
    }
  }

  private _createLocalIntegration(
    module: IntegrationModule,
    index: number,
  ): RIntegration {
    const integration = new RIntegration()
    integration.id = -(index + 1)
    integration.identity = module.manifest.identity
    integration.name = module.manifest.name
    integration.displayName = module.manifest.name
    integration.description = module.manifest.description ?? null
    integration.managedBy = 'user'
    integration.managedById = null
    integration.origin = { kind: 'local', owner: LOCAL_OWNER }
    return integration
  }

  private async _dispose(disposers: IntegrationDisposer[]): Promise<void> {
    for (const disposer of [...disposers].reverse()) {
      try {
        await disposer()
      }
      catch (error) {
        console.warn('[ConfiguratorIntegrationHost] Failed to dispose integration resource.', error)
      }
    }
    disposers.length = 0
  }
}
