import type { BuildProfileSettings, BuildProfileTransport, BuildProfileVisibility } from '@/features/endge-ide/domain/entities/RBuildProfile'
import type { BuildProfileAdapter, BuildProfilePatch } from '@/features/endge-ide/domain/types/build-profile.type'

type UnknownRecord = Record<string, unknown>

export class ServiceBackendBuildProfileHttp_Adapter implements BuildProfileAdapter {
  private readonly _baseURL: string

  public constructor(baseURL: string) {
    this._baseURL = String(baseURL ?? '').trim().replace(/\/+$/, '')
  }

  public async list(workspaceIdentity: string, signal?: AbortSignal): Promise<BuildProfileTransport[]> {
    const response = await this._request('/api/v1/build-profiles', workspaceIdentity, { method: 'GET', signal })
    const items = Array.isArray(response.items) ? response.items : []
    return items.map(normalizeBuildProfile)
  }

  public async create(workspaceIdentity: string, visibility: BuildProfileVisibility, settings: BuildProfileSettings): Promise<BuildProfileTransport> {
    return normalizeBuildProfile(await this._request('/api/v1/build-profiles', workspaceIdentity, {
      method: 'POST',
      body: { visibility, settings },
    }))
  }

  public async patch(workspaceIdentity: string, identity: string, revision: number, patch: BuildProfilePatch): Promise<BuildProfileTransport> {
    return normalizeBuildProfile(await this._request(`/api/v1/build-profiles/${encodeURIComponent(identity)}`, workspaceIdentity, {
      method: 'PATCH',
      revision,
      body: patch,
    }))
  }

  public async delete(workspaceIdentity: string, identity: string, revision: number): Promise<void> {
    await this._request(`/api/v1/build-profiles/${encodeURIComponent(identity)}`, workspaceIdentity, {
      method: 'DELETE',
      revision,
    }, true)
  }

  private async _request(
    path: string,
    workspaceIdentity: string,
    options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown, revision?: number, signal?: AbortSignal },
    emptyResponse = false,
  ): Promise<UnknownRecord> {
    const response = await fetch(`${this._baseURL}${path}`, {
      method: options.method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': workspaceIdentity,
        ...(options.revision ? { 'If-Match': `"${options.revision}"` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
    if (response.ok) {
      return emptyResponse ? {} : asRecord(await response.json())
    }
    let payload: UnknownRecord = {}
    try {
      payload = asRecord(await response.json())
    }
    catch {}
    throw new Error(text(payload.message) || `Build profile request failed with ${response.status}`)
  }
}

function normalizeBuildProfile(value: unknown): BuildProfileTransport {
  const source = asRecord(value)
  const settings = asRecord(source.settings)
  const topology = Array.isArray(settings.topology) ? settings.topology : []
  const node = asRecord(topology[0])
  const visibility = text(source.visibility)
  const diagnostics = text(settings.diagnostics)
  const debuggerStructure = text(settings.debuggerStructure)
  if (!text(source.id) || !text(source.identity) || !text(source.displayName)
    || (visibility !== 'shared' && visibility !== 'private')
    || (diagnostics !== 'minimal' && diagnostics !== 'standard' && diagnostics !== 'detailed')
    || (debuggerStructure !== 'complete-catalog' && debuggerStructure !== 'extended-catalog')
    || text(settings.buildScope) !== 'complete-model' || text(settings.contexts) !== 'all-contexts'
    || topology.length !== 1 || text(node.node) !== 'frontend' || text(node.runtime) !== 'ts-browser'
    || number(source.settingsVersion) !== 1 || number(source.revision) < 1) {
    throw new Error('Backend вернул некорректный профиль сборки')
  }
  return {
    id: text(source.id),
    identity: text(source.identity),
    displayName: text(source.displayName),
    visibility,
    ownerLogin: text(source.ownerLogin) || undefined,
    settingsVersion: 1,
    settings: {
      buildScope: 'complete-model',
      contexts: 'all-contexts',
      diagnostics,
      debuggerStructure,
      topology: [{ node: 'frontend', runtime: 'ts-browser' }],
    },
    revision: number(source.revision),
    ownedByMe: source.ownedByMe === true,
    canManage: source.canManage === true,
    canChangeVisibility: source.canChangeVisibility === true,
    createdAt: text(source.createdAt) || undefined,
    updatedAt: text(source.updatedAt) || undefined,
  }
}

function asRecord(value: unknown): UnknownRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backend вернул некорректный ответ')
  }
  return value as UnknownRecord
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
