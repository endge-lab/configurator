import type { ConfiguratorCommit, ConfiguratorCommitPlan, ConfiguratorRelease } from '@/features/configurator-releases/domain/types/configurator-release.type'

type RecordValue = Record<string, any>

export class ConfiguratorReleases_Service {
  private readonly _baseURL: string

  public constructor(baseURL: string, private readonly _workspaceIdentity: () => string) {
    this._baseURL = baseURL.replace(/\/+$/, '')
  }

  public async list(): Promise<ConfiguratorRelease[]> {
    const payload = await this._json('/api/v1/releases', { method: 'GET' })
    return Array.isArray(payload.items) ? payload.items.map(normalizeRelease) : []
  }

  public async create(identity: string): Promise<ConfiguratorRelease> {
    const plan = await this._json('/api/v1/commits/plan', { method: 'POST' }) as ConfiguratorCommitPlan
    let sourceCommit: ConfiguratorCommit
    if (Number(plan.revisionCount) > 0) {
      sourceCommit = await this._json('/api/v1/commits', {
        method: 'POST',
        body: {
          message: `Release ${identity}`,
          revisionPolicy: 'preserve',
          expectedHeadSequence: Number(plan.headSequence),
        },
      }) as ConfiguratorCommit
    }
    else {
      const commits = await this._json('/api/v1/commits', { method: 'GET' })
      const items = Array.isArray(commits.items) ? commits.items as ConfiguratorCommit[] : []
      sourceCommit = [...items].sort((a, b) => Number(b.headSequence) - Number(a.headSequence))[0]
      if (!sourceCommit)
        throw new Error('Нельзя создать release: в workspace ещё нет commit')
    }
    return normalizeRelease(await this._json('/api/v1/releases', {
      method: 'POST',
      body: { identity, displayName: identity, sourceCommitId: sourceCommit.id },
    }))
  }

  public async download(identity: string): Promise<void> {
    const response = await fetch(`${this._baseURL}/api/v1/releases/${encodeURIComponent(identity)}/export?download=true`, {
      credentials: 'include',
      headers: { 'X-Endge-Workspace': this._workspaceIdentity() },
    })
    if (!response.ok)
      throw new Error(`Не удалось скачать release (${response.status})`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${identity}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  private async _json(path: string, options: { method: 'GET' | 'POST', body?: RecordValue }): Promise<RecordValue> {
    const response = await fetch(`${this._baseURL}${path}`, {
      method: options.method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': this._workspaceIdentity(),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const payload = await response.json().catch(() => ({})) as RecordValue
    if (!response.ok)
      throw new Error(String(payload.message || `Backend request failed (${response.status})`))
    return payload
  }
}

function normalizeRelease(value: RecordValue): ConfiguratorRelease {
  return {
    id: String(value.id || ''),
    identity: String(value.identity || ''),
    displayName: String(value.displayName || value.identity || ''),
    sourceCommitId: String(value.sourceCommitId || ''),
    headSequence: Number(value.headSequence || 0),
    createdAt: String(value.createdAt || ''),
  }
}
