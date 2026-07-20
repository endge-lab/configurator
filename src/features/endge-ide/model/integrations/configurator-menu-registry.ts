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

const registeredItems = shallowReactive(new Map<string, RegisteredConfiguratorMenuItem>())

export const configuratorMenuItems = computed(() =>
  [...registeredItems.values()].sort((left, right) =>
    (left.item.order ?? 0) - (right.item.order ?? 0)
    || left.item.title.localeCompare(right.item.title),
  ),
)

/** Stores top-level integration menu items for the lifetime of the active integration. */
export class ConfiguratorMenuRegistry {
  public add(
    context: IntegrationContext,
    item: ConfiguratorMenuItem,
  ): IntegrationDisposer {
    if (item.parentId || item.children?.length) {
      throw new Error(
        '[ConfiguratorIntegrationHost] Nested integration menu items are not supported yet.',
      )
    }

    const id = `integration:${context.integrationIdentity}:${item.id}`
    if (registeredItems.has(id)) {
      throw new Error(`[ConfiguratorIntegrationHost] Menu item "${id}" is already registered.`)
    }

    registeredItems.set(id, {
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
      registeredItems.delete(id)
    }
  }
}
