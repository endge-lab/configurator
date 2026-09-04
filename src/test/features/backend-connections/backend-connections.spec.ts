import type { BackendConnectionListResponse, BackendConnectionsService } from '@/features/backend-connections/domain/types/backend-connection.type'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BackendConnectionsHttp_Adapter } from '@/features/backend-connections/adapters/BackendConnectionsHttp_Adapter'
import { BackendConnections_Module } from '@/features/backend-connections/modules/BackendConnections_Module'
import {
  ACTIVE_BACKEND_STORAGE_KEY,
  BackendConnectionStorage,
  normalizeBackendURL,
  workspaceStorageKey,
} from '@/features/backend-connections/services/backend-connection-storage'
import { resolveConfiguratorWorkspace } from '@/features/backend-connections/services/resolve-configurator-workspace'

class MemoryStorage implements Storage {
  private readonly _values = new Map<string, string>()
  public get length(): number { return this._values.size }
  public clear(): void { this._values.clear() }
  public getItem(key: string): string | null { return this._values.get(key) ?? null }
  public key(index: number): string | null { return [...this._values.keys()][index] ?? null }
  public removeItem(key: string): void { this._values.delete(key) }
  public setItem(key: string, value: string): void { this._values.set(key, value) }
}

class ServiceStub implements BackendConnectionsService {
  public response: BackendConnectionListResponse = { items: [], total: 0, canManage: false }
  public readonly created: Array<{ name: string, baseURL: string }> = []
  public readonly deleted: string[] = []
  public async list(): Promise<BackendConnectionListResponse> { return this.response }
  public async create(name: string, baseURL: string): Promise<void> { this.created.push({ name, baseURL }) }
  public async delete(id: string): Promise<void> { this.deleted.push(id) }
}

describe('подключения к backend', () => {
  let localStorage: MemoryStorage

  beforeEach(() => {
    localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('нормализует URL и заменяет отсутствующий или повреждённый активный backend основным', () => {
    expect(normalizeBackendURL(' https://Backend.Test/// ')).toBe('https://backend.test')
    expect(() => normalizeBackendURL('https://backend.test?')).toThrow()
    expect(() => normalizeBackendURL('https://@backend.test')).toThrow()
    const storage = new BackendConnectionStorage()
    expect(storage.readActiveBackend('https://primary.test/')).toBe('https://primary.test')
    expect(localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)).toBe('https://primary.test')

    localStorage.setItem(ACTIVE_BACKEND_STORAGE_KEY, 'broken')
    expect(storage.readActiveBackend('https://primary.test')).toBe('https://primary.test')
  })

  it('хранит отдельный identity Workspace для каждого нормализованного URL backend', () => {
    const storage = new BackendConnectionStorage()
    storage.writeWorkspace('https://primary.test/', 'workspace-primary')
    storage.writeWorkspace('https://remote.test', 'workspace-remote')

    expect(storage.readWorkspace('https://primary.test')).toBe('workspace-primary')
    expect(storage.readWorkspace('https://remote.test/')).toBe('workspace-remote')
    expect(workspaceStorageKey('https://primary.test')).not.toBe(workspaceStorageKey('https://remote.test'))
  })

  it('создаёт и дедублицирует основное подключение, переключаясь только через хранилище и перезагрузку', async () => {
    const service = new ServiceStub()
    service.response = {
      canManage: true,
      total: 2,
      items: [
        { id: 'duplicate-primary', name: 'Duplicate', baseUrl: 'https://primary.test/' },
        { id: 'remote', name: 'Production', baseUrl: 'https://remote.test/' },
      ],
    }
    const reload = vi.fn()
    const module = new BackendConnections_Module(
      'https://primary.test',
      service,
      new BackendConnectionStorage(),
      reload,
    )
    const catalog = await module.load()

    expect(catalog.items.map(item => item.baseUrl)).toEqual([
      'https://primary.test',
      'https://remote.test',
    ])
    expect(catalog.items.map(item => item.name)).toEqual(['Основной', 'Production'])
    module.switchBackend('https://remote.test/')
    expect(localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)).toBe('https://remote.test')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('всегда читает каталог с основного URL сервиса', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [],
      total: 0,
      canManage: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new BackendConnectionsHttp_Adapter('https://primary.test/')

    await service.list()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://primary.test/api/v1/backend-connections',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('оставляет legacy-подключение видимым, если старый backend ещё не имеет имени', async () => {
    const service = new ServiceStub()
    service.response = {
      canManage: false,
      total: 1,
      items: [{ id: 'legacy', baseUrl: 'https://legacy.test/' }],
    }
    const module = new BackendConnections_Module(
      'https://primary.test',
      service,
      new BackendConnectionStorage(),
      vi.fn(),
    )

    const catalog = await module.load()

    expect(catalog.items[1]).toMatchObject({
      name: 'https://legacy.test',
      baseUrl: 'https://legacy.test',
    })
  })

  it('отправляет заданное пользователем имя вместе с нормализованным URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new BackendConnectionsHttp_Adapter('https://primary.test/')

    await service.create('Production', 'https://remote.test')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://primary.test/api/v1/backend-connections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Production', baseUrl: 'https://remote.test' }),
      }),
    )
  })

  it('возвращается к основному подключению и перезагружает приложение, если активного удалённого backend нет в каталоге', async () => {
    localStorage.setItem(ACTIVE_BACKEND_STORAGE_KEY, 'https://removed.test')
    const service = new ServiceStub()
    const reload = vi.fn()
    const module = new BackendConnections_Module(
      'https://primary.test',
      service,
      new BackendConnectionStorage(),
      reload,
    )
    const catalog = await module.load()

    expect(module.hasActiveConnection(catalog)).toBe(false)
    module.fallbackToPrimary()

    expect(localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)).toBe('https://primary.test')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('предпочитает сохранённый активный Workspace, затем необязательное начальное значение, иначе требует выбора', () => {
    const workspaces = [
      { id: 'a', identity: 'workspace-a', displayName: 'A', active: true, role: 'editor' as const },
      { id: 'b', identity: 'workspace-b', displayName: 'B', active: false, role: 'admin' as const },
    ]
    expect(resolveConfiguratorWorkspace(workspaces, 'workspace-a', '')?.identity).toBe('workspace-a')
    expect(resolveConfiguratorWorkspace(workspaces, null, 'workspace-a')?.identity).toBe('workspace-a')
    expect(resolveConfiguratorWorkspace(workspaces, 'workspace-b', 'workspace-b')).toBeNull()
  })
})
