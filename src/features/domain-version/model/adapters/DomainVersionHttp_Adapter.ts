import type { DomainStatus, DomainVersionTarget } from '@/features/domain-version/domain/types/domain-version.type'

import { normalizeBackendURL } from '@/features/backend-connections/model/backend-connection-storage'

export class DomainVersionServiceError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'DomainVersionServiceError'
  }
}

export class DomainVersionHttp_Adapter {
  public async get(target: DomainVersionTarget): Promise<DomainStatus> {
    const baseURL = normalizeBackendURL(target.backendURL)
    let response: Response
    try {
      response = await fetch(`${baseURL}/api/v1/domain/status`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Endge-Workspace': target.workspace,
        },
      })
    }
    catch (error) {
      throw new DomainVersionServiceError(
        'unavailable',
        error instanceof Error ? error.message : 'Backend is unavailable',
        0,
      )
    }

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      const code = response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'unsupported'
            : 'request_failed'
      throw new DomainVersionServiceError(
        code,
        typeof payload.message === 'string' ? payload.message : `Backend returned ${response.status}`,
        response.status,
      )
    }

    return normalizeStatus(payload)
  }
}

function normalizeStatus(value: Record<string, unknown>): DomainStatus {
  const state = value.state === 'clean' ? 'clean' : 'dirty'
  return {
    workspace: String(value.workspace ?? ''),
    state,
    domainVersion: state === 'clean' && typeof value.domainVersion === 'string'
      ? value.domainVersion
      : undefined,
    lastCommittedDomainVersion: typeof value.lastCommittedDomainVersion === 'string'
      ? value.lastCommittedDomainVersion
      : undefined,
    commitId: String(value.commitId ?? ''),
    commitMessage: String(value.commitMessage ?? ''),
    committedAt: String(value.committedAt ?? ''),
    pendingRevisionCount: Number(value.pendingRevisionCount ?? 0),
  }
}
