import type { IntegrationModule } from '@endge/integration-api'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EndgeIDEIntegrations_Module } from '@/features/endge-ide/model/modules/integrations/EndgeIDEIntegrations_Module'

const testState = vi.hoisted(() => {
  const integrations = new Map<string, any>()
  const workspace = {
    identity: 'workspace-test',
    installedIntegrations: [] as Array<{
      integrationId: string | number
      integrationIdentity: string
      version: string
    }>,
  }
  return {
    integrations,
    workspace,
    registerMenuItem: vi.fn(() => vi.fn()),
    registerWidget: vi.fn(() => vi.fn()),
    removeSurface: vi.fn(),
  }
})

vi.mock('@endge/core', () => ({
  Endge: {
    domain: {
      getIntegrationByIdentity: (identity: string) => testState.integrations.get(identity) ?? null,
      addIntegration: (integration: any) => testState.integrations.set(integration.identity, integration),
      removeIntegrationByIdentity: (identity: string) => testState.integrations.delete(identity),
    },
    workspace: {
      current: testState.workspace,
    },
  },
  RIntegration: class RIntegration {},
}))

vi.mock('@/features/endge-ide/model/modules/integrations/ConfiguratorWidgetRegistry', () => ({
  ConfiguratorWidgetRegistry: class ConfiguratorWidgetRegistry {
    register = testState.registerWidget
  },
}))

vi.mock('@/features/endge-ide/model/modules/integrations/ConfiguratorMenuRegistry', () => ({
  ConfiguratorMenuRegistry: class ConfiguratorMenuRegistry {
    add = testState.registerMenuItem
    items = { value: [] }
  },
}))

describe('configurator integration host', () => {
  beforeEach(() => {
    testState.integrations.clear()
    testState.workspace.installedIntegrations.splice(0)
    testState.registerMenuItem.mockClear()
    testState.registerWidget.mockClear()
    testState.removeSurface.mockClear()
  })

  it('materializes and disposes a local integration with its workspace binding', async () => {
    const visual = {}
    const module: IntegrationModule = {
      manifest: {
        identity: 'test-hello-world',
        name: 'Hello World integration',
        version: '0.1.0-dev',
        apiVersion: '1',
      },
      configurator({ configurator }) {
        configurator.widgets.register({
          id: 'hello-world',
          title: 'Тестовый виджет',
          placement: 'sidebar',
          visual,
        })
        configurator.menu.add({
          id: 'hello-world-menu',
          title: 'Hello integration',
          action: () => {},
        })
      },
    }
    const context = {
      isSwitchingContext: false,
      registerSurface: vi.fn(() => testState.removeSurface),
    }
    const host = new EndgeIDEIntegrations_Module(async () => [module], context)

    await host.init()

    expect(testState.integrations.get('test-hello-world')).toMatchObject({
      id: -1,
      identity: 'test-hello-world',
      origin: { kind: 'local', owner: 'configurator:test-integrations' },
    })
    expect(testState.workspace.installedIntegrations).toEqual([{
      integrationId: -1,
      integrationIdentity: 'test-hello-world',
      version: '0.1.0-dev',
    }])
    expect(testState.registerWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationIdentity: 'test-hello-world',
        workspaceId: 'workspace-test',
      }),
      expect.objectContaining({ id: 'hello-world', visual }),
    )
    expect(testState.registerMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationIdentity: 'test-hello-world',
        workspaceId: 'workspace-test',
      }),
      expect.objectContaining({
        id: 'hello-world-menu',
        title: 'Hello integration',
      }),
    )

    await host.reset()

    expect(testState.removeSurface).toHaveBeenCalledOnce()
    expect(testState.integrations.size).toBe(0)
    expect(testState.workspace.installedIntegrations).toEqual([])
  })
})
