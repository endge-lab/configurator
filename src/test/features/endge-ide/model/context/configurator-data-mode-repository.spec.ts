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

  it('persists overrides independently for each Workspace', () => {
    const repository = new ConfiguratorDataModeRepository()

    repository.write('workspace-a', 'mock')
    repository.write('workspace-b', 'live')

    expect(repository.read('workspace-a')).toBe('mock')
    expect(repository.read('workspace-b')).toBe('live')
  })

  it('clears the override so EndgeContext can return to the Workspace default', () => {
    const repository = new ConfiguratorDataModeRepository()
    repository.write('workspace-a', 'mock')

    repository.clear('workspace-a')

    expect(repository.read('workspace-a')).toBeNull()
  })
})
