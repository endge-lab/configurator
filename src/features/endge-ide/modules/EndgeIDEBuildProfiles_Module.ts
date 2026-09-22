import type {
  BuildProfileSettings,
  BuildProfileVisibility,
} from '@/features/endge-ide/domain/entities/RBuildProfile'
import type {
  BuildProfileAdapter,
  BuildProfilePatch,
} from '@/features/endge-ide/domain/types/build-profile.type'
import type { BuildResult } from '@/features/endge-ide/domain/types/build-result.type'
import { Endge } from '@endge/core'

import { readonly, ref, shallowRef } from 'vue'
import { Configurator } from '@/app/Configurator'
import { BundleFiles_Service } from '@/app/services/BundleFiles_Service'

import {
  cloneBuildProfileSettings,
  createDefaultBuildProfileSettings,
  RBuildProfile,
} from '@/features/endge-ide/domain/entities/RBuildProfile'

/** Owns operational build-profile state and serializes writes per profile. */
export class EndgeIDEBuildProfiles_Module {
  private readonly _buildStatus = ref<
    'idle' | 'building' | 'packing' | 'ready' | 'error'
  >('idle')

  private readonly _buildError = ref<string | null>(null)
  private _buildController: AbortController | null = null
  public readonly buildStatus = readonly(this._buildStatus)
  public readonly buildError = readonly(this._buildError)

  private readonly _result = shallowRef<BuildResult | null>(null)
  public readonly result = readonly(this._result)
  private _prepared: { bytes: Uint8Array, gzip: Uint8Array, result: BuildResult } | null = null
  private readonly _resultOpen = ref(false)
  public readonly resultOpen = readonly(this._resultOpen)
  private readonly _publishing = ref(false)
  public readonly publishing = readonly(this._publishing)
  private readonly _publishedRelease = ref<string | null>(null)
  public readonly publishedRelease = readonly(this._publishedRelease)

  public closeResult(): void {
    if (!this._publishing.value) {
      this._resultOpen.value = false
      this._prepared = null
      this._result.value = null
    }
  }

  public async buildBundle(settings: BuildProfileSettings, profile?: RBuildProfile): Promise<void> {
    if (this._buildController || this._publishing.value) {
      throw new Error('Сборка или создание релиза уже выполняется')
    }
    Endge.assertWritable()
    const controller = new AbortController()
    this._buildController = controller
    this._buildError.value = null
    const options = cloneBuildProfileSettings(settings)
    const profileSnapshot = profile ? { identity: profile.identity, displayName: profile.displayName, revision: profile.revision } : undefined
    this._prepared = null
    this._result.value = null
    this._publishedRelease.value = null
    this._needsCommit.value = false
    this._sourceCommitId.value = null
    try {
      this._buildStatus.value = 'building'
      const snapshot = await Endge.buildSavedProgram(controller.signal)
      controller.signal.throwIfAborted()
      const bundle = Endge.program.exportBundle({ includeAst: options.includeAst })
      this._buildStatus.value = 'packing'
      const { configuration: _configuration, ...buildContext } = bundle.context
      const files = new BundleFiles_Service()
      const container = { format: 'endge-bundle' as const, version: 1 as const, bundle }
      const gzip = await files.encode(container, 'gzip', controller.signal)
      const bytes = options.fileFormat === 'gzip' ? gzip : await files.encode(container, 'json', controller.signal)
      controller.signal.throwIfAborted()
      const result: BuildResult = {
        name: bundle.programId,
        fileFormat: options.fileFormat,
        sizeBytes: bytes.byteLength,
        source: snapshot ? { workspaceId: snapshot.workspace.state.id, workspaceIdentity: snapshot.workspace.identity, headSequence: snapshot.workspace.state.headSequence, generation: snapshot.workspace.state.generation } : null,
        metadata: { version: 1, profile: profileSnapshot, programId: bundle.programId, compilerVersion: bundle.compilerVersion, runtime: 'ts-browser', scope: 'complete-model', contextMode: 'effective-context', context: buildContext, includeAst: options.includeAst, fileFormat: 'gzip', sizeBytes: gzip.byteLength },
      }
      this._prepared = { bytes, gzip, result }
      this._result.value = result
      this._resultOpen.value = true
      this._buildStatus.value = 'ready'
    }
    catch (error) {
      if (!controller.signal.aborted) {
        this._buildStatus.value = 'error'
        this._buildError.value = error instanceof Error ? error.message : String(error)
      }
      throw error
    }
    finally {
      if (this._buildController === controller) {
        this._buildController = null
      }
    }
  }

  public downloadResult(): void {
    const prepared = this._prepared
    if (!prepared) {
      throw new Error('Результат сборки недоступен')
    }
    new BundleFiles_Service().downloadBytes(prepared.bytes, prepared.result.fileFormat, prepared.result.name)
  }

  private readonly _needsCommit = ref(false)
  public readonly needsCommit = readonly(this._needsCommit)
  private readonly _sourceCommitId = ref<string | null>(null)
  public readonly sourceCommitId = readonly(this._sourceCommitId)

  public async prepareRelease(): Promise<void> {
    const prepared = this._prepared
    if (!prepared?.result.source || this._publishing.value) {
      throw new Error('Сборка не связана с сохранённым Workspace')
    }
    this._publishing.value = true
    try {
      const releases = Configurator.releases
      await releases.load()
      if (this._prepared !== prepared) {
        throw new Error('Результат сборки был закрыт')
      }
      this._sourceCommitId.value = releases.commits.find(value => value.headSequence === prepared.result.source!.headSequence)?.id ?? null
      this._needsCommit.value = !this._sourceCommitId.value
    }
    finally {
      this._publishing.value = false
    }
  }

  public async publishResult(name: string, description: string, commitMessage: string): Promise<void> {
    const prepared = this._prepared
    if (!prepared?.result.source || this._publishing.value || this._publishedRelease.value) {
      throw new Error('Результат недоступен для создания релиза')
    }
    const identity = name.trim()
    if (!identity || identity.length > 160) {
      throw new Error('Введите название релиза до 160 символов')
    }
    if (prepared.gzip.byteLength > 15 * 1024 * 1024) {
      throw new Error('Bundle превышает лимит загрузки релиза 15 MiB; файл можно скачать локально')
    }
    this._publishing.value = true
    try {
      const releases = Configurator.releases
      await releases.load()
      if (this._prepared !== prepared) {
        throw new Error('Сборка больше не относится к текущей сессии')
      }
      const source = prepared.result.source
      const commit = releases.commits.find(value => value.headSequence === source.headSequence)
      const release = await releases.createFromBuild({ identity, displayName: identity, description: description.trim() || undefined, sourceCommitId: commit?.id, commitMessage: commitMessage.trim() || undefined, source, buildMetadata: prepared.result.metadata }, prepared.gzip)
      if (this._prepared === prepared) {
        this._publishedRelease.value = release.identity
      }
    }
    finally {
      this._publishing.value = false
    }
  }

  private readonly _profiles = ref<RBuildProfile[]>([])
  private readonly _draftSettings = ref<BuildProfileSettings>(
    createDefaultBuildProfileSettings(),
  )

  private readonly _status = ref<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  private readonly _queues = new Map<string, Promise<void>>()
  private readonly _confirmed = new Map<string, RBuildProfile>()
  private _workspaceIdentity: string | null = null
  private _loadController: AbortController | null = null

  public readonly profiles = this._profiles
  public readonly draftSettings = this._draftSettings
  public readonly status = this._status

  public constructor(private readonly _adapter: BuildProfileAdapter) {}

  public async load(workspaceIdentity: string): Promise<void> {
    if (
      this._workspaceIdentity === workspaceIdentity
      && this._status.value === 'ready'
    ) {
      return
    }
    this._loadController?.abort()
    const controller = new AbortController()
    this._loadController = controller
    this._workspaceIdentity = workspaceIdentity
    this._status.value = 'loading'
    try {
      const values = await this._adapter.list(
        workspaceIdentity,
        controller.signal,
      )
      if (controller.signal.aborted) {
        return
      }
      this._profiles.value = values.map(value =>
        RBuildProfile.fromTransport(value),
      )
      this._confirmed.clear()
      this._profiles.value.forEach(profile =>
        this._confirmed.set(profile.identity, cloneProfile(profile)),
      )
      this._status.value = 'ready'
    }
    catch (error) {
      if (!controller.signal.aborted) {
        this._status.value = 'error'
        throw error
      }
    }
    finally {
      if (this._loadController === controller) {
        this._loadController = null
      }
    }
  }

  public async create(
    visibility: BuildProfileVisibility,
  ): Promise<RBuildProfile> {
    const workspace = this._requireWorkspace()
    const created = RBuildProfile.fromTransport(
      await this._adapter.create(
        workspace,
        visibility,
        cloneBuildProfileSettings(this._draftSettings.value),
      ),
    )
    this._profiles.value = [...this._profiles.value, created]
    this._confirmed.set(created.identity, cloneProfile(created))
    return created
  }

  public patch(
    profile: RBuildProfile,
    patch: BuildProfilePatch,
  ): Promise<void> {
    applyPatch(profile, patch)
    const previous = this._queues.get(profile.identity) ?? Promise.resolve()
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        applyPatch(profile, patch)
        const updated = RBuildProfile.fromTransport(
          await this._adapter.patch(
            this._requireWorkspace(),
            profile.identity,
            profile.revision,
            serializePatch(patch),
          ),
        )
        profile.apply(updated)
        this._confirmed.set(profile.identity, cloneProfile(profile))
      })
      .catch((error) => {
        const confirmed = this._confirmed.get(profile.identity)
        if (confirmed) {
          profile.apply(confirmed)
        }
        throw error
      })
      .finally(() => {
        if (this._queues.get(profile.identity) === operation) {
          this._queues.delete(profile.identity)
        }
      })
    this._queues.set(profile.identity, operation)
    return operation
  }

  public async delete(profile: RBuildProfile): Promise<void> {
    await this._queues.get(profile.identity)?.catch(() => undefined)
    await this._adapter.delete(
      this._requireWorkspace(),
      profile.identity,
      profile.revision,
    )
    this._profiles.value = this._profiles.value.filter(
      value => value.identity !== profile.identity,
    )
    this._confirmed.delete(profile.identity)
  }

  public reset(): void {
    this._prepared = null
    this._result.value = null
    this._resultOpen.value = false
    this._publishedRelease.value = null
    this._buildController?.abort()
    this._buildController = null
    this._buildStatus.value = 'idle'
    this._buildError.value = null
    this._loadController?.abort()
    this._loadController = null
    this._workspaceIdentity = null
    this._profiles.value = []
    this._draftSettings.value = createDefaultBuildProfileSettings()
    this._status.value = 'idle'
    this._queues.clear()
    this._confirmed.clear()
  }

  private _requireWorkspace(): string {
    if (!this._workspaceIdentity) {
      throw new Error('Workspace профилей сборки не выбран')
    }
    return this._workspaceIdentity
  }
}

function applyPatch(profile: RBuildProfile, patch: BuildProfilePatch): void {
  if (patch.displayName !== undefined) {
    profile.displayName = patch.displayName
    profile.name = patch.displayName
  }
  if (patch.visibility !== undefined) {
    profile.visibility = patch.visibility
  }
  if (patch.settings !== undefined) {
    profile.settings = cloneBuildProfileSettings(patch.settings)
  }
}

function serializePatch(patch: BuildProfilePatch): BuildProfilePatch {
  return {
    ...(patch.displayName !== undefined
      ? { displayName: patch.displayName.trim() }
      : {}),
    ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    ...(patch.settings !== undefined
      ? { settings: cloneBuildProfileSettings(patch.settings) }
      : {}),
  }
}

function cloneProfile(value: RBuildProfile): RBuildProfile {
  return RBuildProfile.fromTransport({
    id: value.id,
    identity: value.identity,
    displayName: value.displayName,
    visibility: value.visibility,
    ownerLogin: value.ownerLogin,
    settingsVersion: 1,
    settings: cloneBuildProfileSettings(value.settings),
    revision: value.revision,
    ownedByMe: value.ownedByMe,
    canManage: value.canManage,
    canChangeVisibility: value.canChangeVisibility,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  })
}
