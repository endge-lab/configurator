import { beforeEach, describe, expect, it } from 'vitest'

import { ConfiguratorDataModeRepository } from '@/features/endge-ide/model/context/configurator-data-mode-repository'

describe('configurator data mode repository', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    })
  })

  it('persists overrides independently for each backend and Workspace', () => {
    const repository = new ConfiguratorDataModeRepository()

    repository.write('https://backend-a.test', 'workspace-a', 'mock')
    repository.write('https://backend-a.test', 'workspace-b', 'live')
    repository.write('https://backend-b.test', 'workspace-a', 'live')

    expect(repository.read('https://backend-a.test', 'workspace-a')).toBe('mock')
    expect(repository.read('https://backend-a.test', 'workspace-b')).toBe('live')
    expect(repository.read('https://backend-b.test', 'workspace-a')).toBe('live')
  })

  it('clears the override so EndgeContext_Module can return to the Workspace default', () => {
    const repository = new ConfiguratorDataModeRepository()
    repository.write('https://backend.test', 'workspace-a', 'mock')

    repository.clear('https://backend.test', 'workspace-a')

    expect(repository.read('https://backend.test', 'workspace-a')).toBeNull()
  })
})
