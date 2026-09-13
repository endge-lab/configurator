import type { BuildProfileTransport } from '@/features/endge-ide/domain/entities/RBuildProfile'
import type { BuildProfileAdapter } from '@/features/endge-ide/domain/types/build-profile.type'

import { describe, expect, it, vi } from 'vitest'

import { EndgeIDEBuildProfiles_Module } from '@/features/endge-ide/modules/EndgeIDEBuildProfiles_Module'

describe('модуль профилей сборки', () => {
  it('загружает workspace, создаёт профиль из текущего черновика и сбрасывает состояние', async () => {
    const adapter = adapterStub()
    adapter.list = vi.fn().mockResolvedValue([transport()])
    adapter.create = vi.fn().mockResolvedValue(transport({ identity: 'created', displayName: 'Новый профиль 2' }))
    const module = new EndgeIDEBuildProfiles_Module(adapter)

    await module.load('workspace-a')
    expect(module.status.value).toBe('ready')
    expect(module.profiles.value).toHaveLength(1)
    module.draftSettings.value = { ...module.draftSettings.value, diagnostics: 'minimal' }

    await module.create('shared')

    expect(adapter.create).toHaveBeenCalledWith('workspace-a', 'shared', expect.objectContaining({ diagnostics: 'minimal' }))
    expect(module.profiles.value.map(profile => profile.identity)).toEqual(['profile-1', 'created'])

    module.reset()
    expect(module.status.value).toBe('idle')
    expect(module.profiles.value).toEqual([])
    expect(module.draftSettings.value.diagnostics).toBe('detailed')
  })

  it('сериализует быстрые PATCH одного профиля и использует актуальную revision', async () => {
    const revisions: number[] = []
    let serverName = 'Profile'
    let serverSettings = transport().settings
    const adapter = adapterStub()
    adapter.list = vi.fn().mockResolvedValue([transport()])
    adapter.patch = vi.fn(async (_workspace, _identity, revision, patch) => {
      revisions.push(revision)
      serverName = patch.displayName ?? serverName
      serverSettings = patch.settings ?? serverSettings
      return transport({
        revision: revision + 1,
        displayName: serverName,
        settings: serverSettings,
      })
    })
    const module = new EndgeIDEBuildProfiles_Module(adapter)
    await module.load('workspace-a')
    const profile = module.profiles.value[0]!

    const rename = module.patch(profile, { displayName: 'Renamed' })
    const settings = { ...profile.settings, diagnostics: 'minimal' as const }
    const updateSettings = module.patch(profile, { settings })
    await Promise.all([rename, updateSettings])

    expect(revisions).toEqual([1, 2])
    expect(profile.revision).toBe(3)
    expect(profile.displayName).toBe('Renamed')
    expect(profile.settings.diagnostics).toBe('minimal')
  })

  it('откатывает optimistic UI к последнему подтверждённому профилю при ошибке', async () => {
    const adapter = adapterStub()
    adapter.list = vi.fn().mockResolvedValue([transport()])
    adapter.patch = vi.fn().mockRejectedValue(new Error('revision conflict'))
    const module = new EndgeIDEBuildProfiles_Module(adapter)
    await module.load('workspace-a')
    const profile = module.profiles.value[0]!

    await expect(module.patch(profile, { displayName: 'Optimistic' })).rejects.toThrow('revision conflict')

    expect(profile.displayName).toBe('Profile')
    expect(profile.revision).toBe(1)
  })
})

function adapterStub(): BuildProfileAdapter {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

function transport(patch: Partial<BuildProfileTransport> = {}): BuildProfileTransport {
  return {
    id: 'id-1',
    identity: 'profile-1',
    displayName: 'Profile',
    visibility: 'private',
    ownerLogin: 'owner',
    settingsVersion: 1,
    settings: {
      buildScope: 'complete-model',
      contexts: 'all-contexts',
      diagnostics: 'detailed',
      debuggerStructure: 'complete-catalog',
      topology: [{ node: 'frontend', runtime: 'ts-browser' }],
    },
    revision: 1,
    ownedByMe: true,
    canManage: true,
    canChangeVisibility: true,
    ...patch,
  }
}
