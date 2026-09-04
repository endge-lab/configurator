import type { IntegrationContext } from '@endge/integration-api'

import { afterEach, describe, expect, it } from 'vitest'

import { ConfiguratorMenuRegistry } from '@/features/endge-ide/modules/integrations/ConfiguratorMenuRegistry'

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

describe('реестр меню Configurator', () => {
  it('регистрирует верхнеуровневый элемент с namespace и удаляет его через disposer', async () => {
    const registry = new ConfiguratorMenuRegistry()
    const dispose = registry.add(context, {
      id: 'hello',
      title: 'Hello integration',
      order: 100,
      action: () => {},
    })
    disposers.push(dispose)

    expect(registry.items.value).toEqual([
      expect.objectContaining({
        id: 'integration:test-menu:hello',
        integrationIdentity: 'test-menu',
        item: expect.objectContaining({ title: 'Hello integration' }),
      }),
    ])

    await dispose()
    expect(registry.items.value).toEqual([])
  })

  it('отклоняет вложенные элементы до появления renderer вложенного меню', () => {
    const registry = new ConfiguratorMenuRegistry()

    expect(() => registry.add(context, {
      id: 'child',
      title: 'Child',
      parentId: 'parent',
    })).toThrow('Nested integration menu items are not supported yet')
  })
})
