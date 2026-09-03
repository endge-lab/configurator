import type {
  ConfiguratorCommit,
  ConfiguratorCommitPlan,
  ConfiguratorRelease,
  ConfiguratorRestorePlan,
  ConfiguratorVersionActor,
} from '@/features/configurator-releases/domain/types/configurator-release.type'

type RecordValue = Record<string, any>

export class ConfiguratorVersionsError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ConfiguratorVersionsError'
  }
}

export class ConfiguratorReleasesHttp_Adapter {
  private readonly _baseURL: string

  public constructor(
    baseURL: string,
    private readonly _workspaceIdentity: () => string,
  ) {
    this._baseURL = baseURL.replace(/\/+$/, '')
  }

  public async listReleases(): Promise<ConfiguratorRelease[]> {
    const payload = await this._json('/api/v1/releases', { method: 'GET' })
    return Array.isArray(payload.items)
      ? payload.items.map(normalizeRelease)
      : []
  }

  public async listCommits(): Promise<ConfiguratorCommit[]> {
    const payload = await this._json('/api/v1/commits', { method: 'GET' })
    return Array.isArray(payload.items)
      ? payload.items.map(normalizeCommit)
      : []
  }

  public async planCommit(): Promise<ConfiguratorCommitPlan> {
    return normalizeCommitPlan(
      await this._json('/api/v1/commits/plan', { method: 'POST' }),
    )
  }

  public async getCommitDiff(id: string): Promise<ConfiguratorCommit> {
    return normalizeCommit(
      await this._json(`/api/v1/commits/${encodeURIComponent(id)}/diff`, {
        method: 'GET',
      }),
    )
  }

  public async createCommit(
    message: string,
    expectedHeadSequence: number,
  ): Promise<ConfiguratorCommit> {
    return normalizeCommit(
      await this._json('/api/v1/commits', {
        method: 'POST',
        body: {
          message: message.trim(),
          revisionPolicy: 'preserve',
          expectedHeadSequence,
        },
      }),
    )
  }

  public async createRelease(
    identity: string,
    sourceCommitId: string,
  ): Promise<ConfiguratorRelease> {
    const value = identity.trim()
    return normalizeRelease(
      await this._json('/api/v1/releases', {
        method: 'POST',
        body: { identity: value, displayName: value, sourceCommitId },
      }),
    )
  }

  public async planCommitRestore(id: string): Promise<ConfiguratorRestorePlan> {
    return normalizeRestorePlan(
      await this._json(
        `/api/v1/commits/${encodeURIComponent(id)}/restore/plan`,
        { method: 'POST' },
      ),
    )
  }

  public async restoreCommit(
    id: string,
    expectedHeadSequence: number,
  ): Promise<ConfiguratorCommit> {
    return normalizeCommit(
      await this._json(`/api/v1/commits/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: { expectedHeadSequence },
      }),
    )
  }

  public async planReleaseRestore(
    identity: string,
  ): Promise<ConfiguratorRestorePlan> {
    return normalizeRestorePlan(
      await this._json(
        `/api/v1/releases/${encodeURIComponent(identity)}/restore/plan`,
        { method: 'POST' },
      ),
    )
  }

  public async restoreRelease(
    identity: string,
    expectedHeadSequence: number,
  ): Promise<ConfiguratorCommit> {
    return normalizeCommit(
      await this._json(
        `/api/v1/releases/${encodeURIComponent(identity)}/restore`,
        {
          method: 'POST',
          body: { expectedHeadSequence },
        },
      ),
    )
  }

  public async download(identity: string): Promise<void> {
    const response = await fetch(
      `${this._baseURL}/api/v1/releases/${encodeURIComponent(identity)}/export?download=true`,
      {
        credentials: 'include',
        headers: { 'X-Endge-Workspace': this._workspaceIdentity() },
      },
    )
    if (!response.ok) {
      throw new Error(`Не удалось скачать release (${response.status})`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${identity}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  private async _json(
    path: string,
    options: { method: 'GET' | 'POST', body?: RecordValue },
  ): Promise<RecordValue> {
    const response = await fetch(`${this._baseURL}${path}`, {
      method: options.method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': this._workspaceIdentity(),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const payload = (await response.json().catch(() => ({}))) as RecordValue
    if (!response.ok) {
      throw new ConfiguratorVersionsError(
        String(
          payload.message || `Backend request failed (${response.status})`,
        ),
        String(payload.code || ''),
        response.status,
      )
    }
    return payload
  }
}

function normalizeRelease(value: RecordValue): ConfiguratorRelease {
  return {
    id: String(value.id || ''),
    identity: String(value.identity || ''),
    displayName: String(value.displayName || value.identity || ''),
    description:
      value.description == null ? undefined : String(value.description),
    sourceCommitId: String(value.sourceCommitId || ''),
    headSequence: Number(value.headSequence || 0),
    createdBy: normalizeActor(value.createdBy),
    createdAt: String(value.createdAt || ''),
  }
}

function normalizeCommit(value: RecordValue): ConfiguratorCommit {
  return {
    id: String(value.id || ''),
    parentCommitId:
      value.parentCommitId == null ? undefined : String(value.parentCommitId),
    baseSequence: Number(value.baseSequence || 0),
    headSequence: Number(value.headSequence || 0),
    message: String(value.message || ''),
    revisionPolicy: value.revisionPolicy === 'squash' ? 'squash' : 'preserve',
    operation: String(value.operation || 'user'),
    domainVersion: value.domainVersion == null ? undefined : String(value.domainVersion),
    createdBy: normalizeActor(value.createdBy),
    createdAt: String(value.createdAt || ''),
    changes: Array.isArray(value.changes)
      ? value.changes.map(change => ({
          documentType: String(change.documentType || ''),
          documentId: String(change.documentId || ''),
          documentIdentity: String(change.documentIdentity || ''),
          beforeRevisionId:
            change.beforeRevisionId == null
              ? undefined
              : String(change.beforeRevisionId),
          afterRevisionId:
            change.afterRevisionId == null
              ? undefined
              : String(change.afterRevisionId),
          operation: String(change.operation || ''),
        }))
      : [],
  }
}

function normalizeCommitPlan(value: RecordValue): ConfiguratorCommitPlan {
  return {
    baseSequence: Number(value.baseSequence || 0),
    headSequence: Number(value.headSequence || 0),
    revisionCount: Number(value.revisionCount || 0),
    documentCount: Number(value.documentCount || 0),
    contributors: Array.isArray(value.contributors)
      ? value.contributors.map(normalizeActor)
      : [],
    shared: Boolean(value.shared),
  }
}

function normalizeRestorePlan(value: RecordValue): ConfiguratorRestorePlan {
  return {
    valid: value.valid !== false,
    creates: Number(value.creates || 0),
    updates: Number(value.updates || 0),
    restores: Number(value.restores || 0),
    deletes: Number(value.deletes || 0),
    expectedHeadSequence: Number(value.expectedHeadSequence || 0),
  }
}

function normalizeActor(value: unknown): ConfiguratorVersionActor {
  const actor
    = value && typeof value === 'object' ? (value as RecordValue) : {}
  return {
    id: String(actor.id || ''),
    username: actor.username == null ? undefined : String(actor.username),
    displayName:
      actor.displayName == null ? undefined : String(actor.displayName),
  }
}
