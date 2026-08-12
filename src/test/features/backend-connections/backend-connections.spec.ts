import type { BackendConnectionListResponse, BackendConnectionsService } from '@/features/backend-connections/domain/types/backend-connection.type'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACTIVE_BACKEND_STORAGE_KEY,
  BackendConnectionStorage,
  normalizeBackendURL,
  workspaceStorageKey,
} from '@/features/backend-connections/model/backend-connection-storage'
import { BackendConnections_Module } from '@/features/backend-connections/model/BackendConnections_Module'
import { BackendConnections_Service } from '@/features/backend-connections/model/BackendConnections_Service'
import { resolveConfiguratorWorkspace } from '@/features/backend-connections/model/resolve-configurator-workspace'

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
  public readonly created: string[] = []
  public readonly deleted: string[] = []
  public async list(): Promise<BackendConnectionListResponse> { return this.response }
  public async create(baseURL: string): Promise<void> { this.created.push(baseURL) }
  public async delete(id: string): Promise<void> { this.deleted.push(id) }
}

describe('backend connections', () => {
  let localStorage: MemoryStorage

  beforeEach(() => {
    localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('normalizes URLs and seeds a missing or corrupted active backend with primary', () => {
    expect(normalizeBackendURL(' https://Backend.Test/// ')).toBe('https://backend.test')
    expect(() => normalizeBackendURL('https://backend.test?')).toThrow()
    expect(() => normalizeBackendURL('https://@backend.test')).toThrow()
    const storage = new BackendConnectionStorage()
    expect(storage.readActiveBackend('https://primary.test/')).toBe('https://primary.test')
    expect(localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)).toBe('https://primary.test')

    localStorage.setItem(ACTIVE_BACKEND_STORAGE_KEY, 'broken')
    expect(storage.readActiveBackend('https://primary.test')).toBe('https://primary.test')
  })

  it('stores a separate Workspace identity for every normalized backend URL', () => {
    const storage = new BackendConnectionStorage()
    storage.writeWorkspace('https://primary.test/', 'workspace-primary')
    storage.writeWorkspace('https://remote.test', 'workspace-remote')

    expect(storage.readWorkspace('https://primary.test')).toBe('workspace-primary')
    expect(storage.readWorkspace('https://remote.test/')).toBe('workspace-remote')
    expect(workspaceStorageKey('https://primary.test')).not.toBe(workspaceStorageKey('https://remote.test'))
  })

  it('synthesizes and deduplicates primary while switching only by storage plus reload', async () => {
    const service = new ServiceStub()
    service.response = {
      canManage: true,
      total: 2,
      items: [
        { id: 'duplicate-primary', baseUrl: 'https://primary.test/' },
        { id: 'remote', baseUrl: 'https://remote.test/' },
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
    module.switchBackend('https://remote.test/')
    expect(localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)).toBe('https://remote.test')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('always reads the catalog from the primary service URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [],
      total: 0,
      canManage: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new BackendConnections_Service('https://primary.test/')

    await service.list()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://primary.test/api/v1/backend-connections',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('falls back to primary and reloads when active remote is absent from the catalog', async () => {
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

  it('prefers stored active Workspace, then optional seed, otherwise requires selection', () => {
    const workspaces = [
      { id: 'a', identity: 'workspace-a', displayName: 'A', active: true, role: 'editor' as const },
      { id: 'b', identity: 'workspace-b', displayName: 'B', active: false, role: 'admin' as const },
    ]
    expect(resolveConfiguratorWorkspace(workspaces, 'workspace-a', '')?.identity).toBe('workspace-a')
    expect(resolveConfiguratorWorkspace(workspaces, null, 'workspace-a')?.identity).toBe('workspace-a')
    expect(resolveConfiguratorWorkspace(workspaces, 'workspace-b', 'workspace-b')).toBeNull()
  })
})
