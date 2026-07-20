import type { IntegrationContext } from '@endge/integration-api'

import { afterEach, describe, expect, it } from 'vitest'

import {
  configuratorMenuItems,
  ConfiguratorMenuRegistry,
} from '@/features/endge-ide/model/integrations/configurator-menu-registry'

const context: IntegrationContext = {
  integrationId: 1,
  integrationIdentity: 'test-menu',
  version: '0.1.0-dev',
  workspaceId: 'workspace-test',
  installationId: 'local:workspace-test:test-menu',
}

const disposers: Array<() => void | Promise<void>> = []

afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) {
    await dispose()
  }
})

describe('configurator menu registry', () => {
  it('registers a namespaced top-level item and removes it through its disposer', async () => {
    const registry = new ConfiguratorMenuRegistry()
    const dispose = registry.add(context, {
      id: 'hello',
      title: 'Hello integration',
      order: 100,
      action: () => {},
    })
    disposers.push(dispose)

    expect(configuratorMenuItems.value).toEqual([
      expect.objectContaining({
        id: 'integration:test-menu:hello',
        integrationIdentity: 'test-menu',
        item: expect.objectContaining({ title: 'Hello integration' }),
      }),
    ])

    await dispose()
    expect(configuratorMenuItems.value).toEqual([])
  })

  it('rejects nested items until a nested menu renderer is introduced', () => {
    const registry = new ConfiguratorMenuRegistry()

    expect(() => registry.add(context, {
      id: 'child',
      title: 'Child',
      parentId: 'parent',
    })).toThrow('Nested integration menu items are not supported yet')
  })
})
