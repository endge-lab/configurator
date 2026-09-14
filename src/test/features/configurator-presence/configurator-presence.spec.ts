import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfiguratorPresence_Module } from '@/features/configurator-presence/ConfiguratorPresence_Module'

const bridge = vi.hoisted(() => ({
  configurator: { connections: [] as unknown[] },
  connections: [] as unknown[],
  subscribe: vi.fn(() => () => {}),
}))

vi.mock('@endge/core', () => ({ Endge: { bridge } }))

describe('модуль активных сессий Configurator', () => {
  beforeEach(() => {
    bridge.connections = []
    bridge.configurator.connections = []
    bridge.subscribe.mockClear()
  })

  it('показывает единственную текущую сессию без бейджа других подключений', () => {
    bridge.connections = [{
      status: 'connected',
      serverUrl: 'https://backend.test',
      instanceId: 'current-tab',
    }]
    bridge.configurator.connections = [{
      serverUrl: 'https://backend.test',
      instanceId: 'current-tab',
      userId: 'developer',
      displayName: 'Endge Developer',
      label: 'Configurator',
      workspaceDisplayName: 'AODB',
    }]
    const module = new ConfiguratorPresence_Module()

    module.init()

    expect(module.connections.value).toEqual([expect.objectContaining({
      instanceId: 'current-tab',
      isCurrentInstance: true,
      isOwnAccount: true,
    })])
    expect(module.count.value).toBe(0)
  })
})
