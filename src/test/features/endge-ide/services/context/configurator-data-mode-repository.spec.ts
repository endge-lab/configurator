import { beforeEach, describe, expect, it } from 'vitest'

import { ConfiguratorDataModeRepository } from '@/features/endge-ide/services/context/configurator-data-mode-repository'

describe('репозиторий режима данных Configurator', () => {
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

  it('сохраняет переопределения независимо для каждой пары backend и Workspace', () => {
    const repository = new ConfiguratorDataModeRepository()

    repository.write('https://backend-a.test', 'workspace-a', 'mock')
    repository.write('https://backend-a.test', 'workspace-b', 'live')
    repository.write('https://backend-b.test', 'workspace-a', 'live')

    expect(repository.read('https://backend-a.test', 'workspace-a')).toBe('mock')
    expect(repository.read('https://backend-a.test', 'workspace-b')).toBe('live')
    expect(repository.read('https://backend-b.test', 'workspace-a')).toBe('live')
  })

  it('очищает переопределение, чтобы EndgeContext_Module вернулся к значению Workspace по умолчанию', () => {
    const repository = new ConfiguratorDataModeRepository()
    repository.write('https://backend.test', 'workspace-a', 'mock')

    repository.clear('https://backend.test', 'workspace-a')

    expect(repository.read('https://backend.test', 'workspace-a')).toBeNull()
  })
})
