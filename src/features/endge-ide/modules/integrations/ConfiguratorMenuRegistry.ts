import type {
  ConfiguratorMenuItem,
  IntegrationContext,
  IntegrationDisposer,
} from '@endge/integration-api'

import { computed, shallowReactive } from 'vue'

export interface RegisteredConfiguratorMenuItem {
  id: string
  integrationIdentity: string
  item: ConfiguratorMenuItem
}

/** Хранит пункты меню интеграции верхнего уровня на протяжении жизни активной интеграции. */
export class ConfiguratorMenuRegistry {
  private readonly _registeredItems = shallowReactive(new Map<string, RegisteredConfiguratorMenuItem>())
  public readonly items = computed(() =>
    [...this._registeredItems.values()].sort((left, right) =>
      (left.item.order ?? 0) - (right.item.order ?? 0)
      || left.item.title.localeCompare(right.item.title),
    ),
  )

  public add(
    context: IntegrationContext,
    item: ConfiguratorMenuItem,
  ): IntegrationDisposer {
    if (item.parentId || item.children?.length) {
      throw new Error(
        '[EndgeIDEIntegrations] Nested integration menu items are not supported yet.',
      )
    }

    const id = `integration:${context.integrationIdentity}:${item.id}`
    if (this._registeredItems.has(id)) {
      throw new Error(`[EndgeIDEIntegrations] Menu item "${id}" is already registered.`)
    }

    this._registeredItems.set(id, {
      id,
      integrationIdentity: context.integrationIdentity,
      item,
    })

    let disposed = false
    return () => {
      if (disposed) {
        return
      }
      disposed = true
      this._registeredItems.delete(id)
    }
  }
}
