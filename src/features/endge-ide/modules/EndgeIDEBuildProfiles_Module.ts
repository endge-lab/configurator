import type { BuildProfileSettings, BuildProfileVisibility } from '@/features/endge-ide/domain/entities/RBuildProfile'
import type { BuildProfileAdapter, BuildProfilePatch } from '@/features/endge-ide/domain/types/build-profile.type'

import { ref } from 'vue'

import { cloneBuildProfileSettings, createDefaultBuildProfileSettings, RBuildProfile } from '@/features/endge-ide/domain/entities/RBuildProfile'

/** Owns operational build-profile state and serializes writes per profile. */
export class EndgeIDEBuildProfiles_Module {
  private readonly _profiles = ref<RBuildProfile[]>([])
  private readonly _draftSettings = ref<BuildProfileSettings>(createDefaultBuildProfileSettings())
  private readonly _status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  private readonly _queues = new Map<string, Promise<void>>()
  private readonly _confirmed = new Map<string, RBuildProfile>()
  private _workspaceIdentity: string | null = null
  private _loadController: AbortController | null = null

  public readonly profiles = this._profiles
  public readonly draftSettings = this._draftSettings
  public readonly status = this._status

  public constructor(private readonly _adapter: BuildProfileAdapter) {}

  public async load(workspaceIdentity: string): Promise<void> {
    if (this._workspaceIdentity === workspaceIdentity && this._status.value === 'ready') {
      return
    }
    this._loadController?.abort()
    const controller = new AbortController()
    this._loadController = controller
    this._workspaceIdentity = workspaceIdentity
    this._status.value = 'loading'
    try {
      const values = await this._adapter.list(workspaceIdentity, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      this._profiles.value = values.map(value => RBuildProfile.fromTransport(value))
      this._confirmed.clear()
      this._profiles.value.forEach(profile => this._confirmed.set(profile.identity, cloneProfile(profile)))
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

  public async create(visibility: BuildProfileVisibility): Promise<RBuildProfile> {
    const workspace = this._requireWorkspace()
    const created = RBuildProfile.fromTransport(await this._adapter.create(
      workspace,
      visibility,
      cloneBuildProfileSettings(this._draftSettings.value),
    ))
    this._profiles.value = [...this._profiles.value, created]
    this._confirmed.set(created.identity, cloneProfile(created))
    return created
  }

  public patch(profile: RBuildProfile, patch: BuildProfilePatch): Promise<void> {
    applyPatch(profile, patch)
    const previous = this._queues.get(profile.identity) ?? Promise.resolve()
    const operation = previous.catch(() => undefined).then(async () => {
      applyPatch(profile, patch)
      const updated = RBuildProfile.fromTransport(await this._adapter.patch(
        this._requireWorkspace(),
        profile.identity,
        profile.revision,
        serializePatch(patch),
      ))
      profile.apply(updated)
      this._confirmed.set(profile.identity, cloneProfile(profile))
    }).catch((error) => {
      const confirmed = this._confirmed.get(profile.identity)
      if (confirmed) {
        profile.apply(confirmed)
      }
      throw error
    }).finally(() => {
      if (this._queues.get(profile.identity) === operation) {
        this._queues.delete(profile.identity)
      }
    })
    this._queues.set(profile.identity, operation)
    return operation
  }

  public async delete(profile: RBuildProfile): Promise<void> {
    await this._queues.get(profile.identity)?.catch(() => undefined)
    await this._adapter.delete(this._requireWorkspace(), profile.identity, profile.revision)
    this._profiles.value = this._profiles.value.filter(value => value.identity !== profile.identity)
    this._confirmed.delete(profile.identity)
  }

  public reset(): void {
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
    ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
    ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    ...(patch.settings !== undefined ? { settings: cloneBuildProfileSettings(patch.settings) } : {}),
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
