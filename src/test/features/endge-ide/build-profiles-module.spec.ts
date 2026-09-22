import type { ConfiguratorReleasesHttp_Adapter } from '@/features/configurator-releases/adapters/ConfiguratorReleasesHttp_Adapter'
import type { BuildProfileTransport } from '@/features/endge-ide/domain/entities/RBuildProfile'

import type { BuildProfileAdapter } from '@/features/endge-ide/domain/types/build-profile.type'
import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from '@/app/Configurator'
import { BundleFiles_Service } from '@/app/services/BundleFiles_Service'
import { ConfiguratorReleases_Module } from '@/features/configurator-releases/ConfiguratorReleases_Module'
import { cloneBuildProfileSettings } from '@/features/endge-ide/domain/entities/RBuildProfile'

import { EndgeIDEBuildProfiles_Module } from '@/features/endge-ide/modules/EndgeIDEBuildProfiles_Module'

afterEach(() => vi.restoreAllMocks())

describe('модуль профилей сборки', () => {
  it('builds once, freezes export options and does not start runtime', async () => {
    const module = new EndgeIDEBuildProfiles_Module(adapterStub())
    let finish!: () => void
    const build = vi.spyOn(Endge, 'buildSavedProgram').mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          finish = () => resolve(null)
        }),
    )
    const exported = { programId: 'build', compilerVersion: 'program-v4', context: {} } as ReturnType<
      typeof Endge.program.exportBundle
    >
    const pack = vi
      .spyOn(Endge.program, 'exportBundle')
      .mockReturnValue(exported)
    const download = vi
      .spyOn(BundleFiles_Service.prototype, 'encode')
      .mockResolvedValue(new Uint8Array([1, 2, 3]))
    const execute = vi.spyOn(Endge.runtime, 'execute')
    const settings = transport().settings
    const pending = module.buildBundle(settings)
    expect(module.buildStatus.value).toBe('building')
    settings.includeAst = true
    await expect(module.buildBundle(settings)).rejects.toThrow(
      'уже выполняется',
    )
    finish()
    await pending
    expect(build).toHaveBeenCalledTimes(1)
    expect(pack).toHaveBeenCalledWith({ includeAst: false })
    expect(download).toHaveBeenCalledWith(
      { format: 'endge-bundle', version: 1, bundle: exported },
      'gzip',
      expect.any(AbortSignal),
    )
    expect(module.buildStatus.value).toBe('ready')
    expect(module.resultOpen.value).toBe(true)
    expect(module.result.value?.sizeBytes).toBe(3)
    const save = vi.spyOn(BundleFiles_Service.prototype, 'downloadBytes').mockImplementation(() => {})
    expect(save).not.toHaveBeenCalled()
    module.downloadResult()
    expect(save).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'gzip', 'build')
    module.closeResult()
    expect(module.result.value).toBeNull()
    expect(execute).not.toHaveBeenCalled()
  })

  it('cancels a pending build on reset and applies defaults to old settings', async () => {
    const module = new EndgeIDEBuildProfiles_Module(adapterStub())
    let finish!: () => void
    vi.spyOn(Endge, 'buildSavedProgram').mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          finish = () => resolve(null)
        }),
    )
    const download = vi
      .spyOn(BundleFiles_Service.prototype, 'encode')
      .mockResolvedValue(new Uint8Array([1, 2, 3]))
    const pending = module.buildBundle(transport().settings)
    module.reset()
    finish()
    await expect(pending).rejects.toThrow()
    expect(download).not.toHaveBeenCalled()
    expect(module.buildStatus.value).toBe('idle')
    const { includeAst, fileFormat, ...legacy } = transport().settings
    expect(
      cloneBuildProfileSettings(legacy as typeof module.draftSettings.value),
    ).toMatchObject({ includeAst: false, fileFormat: 'gzip' })
  })

  it('publishes frozen gzip bytes and provenance even when JSON was selected', async () => {
    const module = new EndgeIDEBuildProfiles_Module(adapterStub())
    const source = { workspaceId: 'workspace-id', workspaceIdentity: 'workspace-a', generation: 'generation-a', headSequence: 7 }
    vi.spyOn(Endge, 'buildSavedProgram').mockResolvedValue({ workspace: { identity: source.workspaceIdentity, state: { id: source.workspaceId, generation: source.generation, headSequence: source.headSequence } } } as Awaited<ReturnType<typeof Endge.buildSavedProgram>>)
    vi.spyOn(Endge.program, 'exportBundle').mockReturnValue({ programId: 'build-a', compilerVersion: 'program-v4', context: { configuration: { secret: true }, project: 'project-a' } } as unknown as ReturnType<typeof Endge.program.exportBundle>)
    const gzip = new Uint8Array([31, 139, 1])
    vi.spyOn(BundleFiles_Service.prototype, 'encode').mockImplementation(async (_value, format) => format === 'gzip' ? gzip : new Uint8Array([123, 125]))
    const releases = new ConfiguratorReleases_Module({} as ConfiguratorReleasesHttp_Adapter)
    vi.spyOn(Configurator, 'releases', 'get').mockReturnValue(releases)
    vi.spyOn(releases, 'load').mockResolvedValue()
    vi.spyOn(releases, 'commits', 'get').mockReturnValue([{ id: 'commit-a', headSequence: 7 }] as unknown as typeof releases.commits)
    const publish = vi.spyOn(releases, 'createFromBuild').mockResolvedValue({ identity: 'v1' } as Awaited<ReturnType<typeof releases.createFromBuild>>)
    await module.buildBundle({ ...transport().settings, fileFormat: 'json' })
    await module.prepareRelease()
    expect(module.needsCommit.value).toBe(false)
    await module.publishResult(' v1 ', ' Комментарий ', '')
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ identity: 'v1', description: 'Комментарий', sourceCommitId: 'commit-a', source, buildMetadata: expect.objectContaining({ programId: 'build-a', fileFormat: 'gzip', context: { project: 'project-a' } }) }), gzip)
    expect(module.publishedRelease.value).toBe('v1')
    await expect(module.publishResult('v1', '', '')).rejects.toThrow()
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('does not publish a result reset during commit lookup', async () => {
    const module = new EndgeIDEBuildProfiles_Module(adapterStub())
    vi.spyOn(Endge, 'buildSavedProgram').mockResolvedValue({ workspace: { identity: 'workspace-a', state: { id: 'id', generation: 'generation', headSequence: 1 } } } as Awaited<ReturnType<typeof Endge.buildSavedProgram>>)
    vi.spyOn(Endge.program, 'exportBundle').mockReturnValue({ programId: 'build-a', compilerVersion: 'program-v4', context: {} } as ReturnType<typeof Endge.program.exportBundle>)
    vi.spyOn(BundleFiles_Service.prototype, 'encode').mockResolvedValue(new Uint8Array([1]))
    const releases = new ConfiguratorReleases_Module({} as ConfiguratorReleasesHttp_Adapter)
    vi.spyOn(Configurator, 'releases', 'get').mockReturnValue(releases)
    let finish!: () => void
    vi.spyOn(releases, 'load').mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const publish = vi.spyOn(releases, 'createFromBuild')
    await module.buildBundle(transport().settings)
    const pending = module.publishResult('v1', '', 'commit')
    module.reset()
    finish()
    await expect(pending).rejects.toThrow('текущей сессии')
    expect(publish).not.toHaveBeenCalled()
  })

  it('загружает workspace, создаёт профиль из текущего черновика и сбрасывает состояние', async () => {
    const adapter = adapterStub()
    adapter.list = vi.fn().mockResolvedValue([transport()])
    adapter.create = vi
      .fn()
      .mockResolvedValue(
        transport({ identity: 'created', displayName: 'Новый профиль 2' }),
      )
    const module = new EndgeIDEBuildProfiles_Module(adapter)

    await module.load('workspace-a')
    expect(module.status.value).toBe('ready')
    expect(module.profiles.value).toHaveLength(1)
    module.draftSettings.value = {
      ...module.draftSettings.value,
      diagnostics: 'minimal',
    }

    await module.create('shared')

    expect(adapter.create).toHaveBeenCalledWith(
      'workspace-a',
      'shared',
      expect.objectContaining({ diagnostics: 'minimal' }),
    )
    expect(module.profiles.value.map(profile => profile.identity)).toEqual([
      'profile-1',
      'created',
    ])

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

    await expect(
      module.patch(profile, { displayName: 'Optimistic' }),
    ).rejects.toThrow('revision conflict')

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

function transport(
  patch: Partial<BuildProfileTransport> = {},
): BuildProfileTransport {
  return {
    id: 'id-1',
    identity: 'profile-1',
    displayName: 'Profile',
    visibility: 'private',
    ownerLogin: 'owner',
    settingsVersion: 1,
    settings: {
      includeAst: false,
      fileFormat: 'gzip',
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
