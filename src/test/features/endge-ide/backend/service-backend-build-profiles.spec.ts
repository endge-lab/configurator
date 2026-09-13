import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceBackendBuildProfileHttp_Adapter } from '@/features/endge-ide/adapters/backend/ServiceBackendBuildProfileHttp_Adapter'
import { createDefaultBuildProfileSettings } from '@/features/endge-ide/domain/entities/RBuildProfile'

describe('backend adapter профилей сборки', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('нормализует список и передаёт workspace header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [transport()] }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ServiceBackendBuildProfileHttp_Adapter('https://backend.test/')

    await expect(adapter.list('workspace-a')).resolves.toMatchObject([{ identity: 'profile-1', revision: 1 }])
    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/build-profiles', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-Endge-Workspace': 'workspace-a' }),
    }))
  })

  it('отправляет PATCH с If-Match и типизированными настройками', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(transport({ revision: 5, displayName: 'Renamed' })))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ServiceBackendBuildProfileHttp_Adapter('https://backend.test')

    await adapter.patch('workspace-a', 'profile identity', 4, {
      displayName: 'Renamed',
      settings: createDefaultBuildProfileSettings(),
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/build-profiles/profile%20identity', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ 'If-Match': '"4"', 'X-Endge-Workspace': 'workspace-a' }),
      body: JSON.stringify({ displayName: 'Renamed', settings: createDefaultBuildProfileSettings() }),
    }))
  })

  it('отклоняет невалидный transport и возвращает backend message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [{ identity: 'broken' }] })))
    const adapter = new ServiceBackendBuildProfileHttp_Adapter('https://backend.test')
    await expect(adapter.list('workspace-a')).rejects.toThrow('некорректный ответ')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'revision conflict' }, 409)))
    await expect(adapter.delete('workspace-a', 'profile-1', 1)).rejects.toThrow('revision conflict')
  })
})

function transport(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'id-1',
    identity: 'profile-1',
    displayName: 'Profile',
    visibility: 'private',
    ownerLogin: 'owner',
    settingsVersion: 1,
    settings: createDefaultBuildProfileSettings(),
    revision: 1,
    ownedByMe: true,
    canManage: true,
    canChangeVisibility: true,
    ...patch,
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
