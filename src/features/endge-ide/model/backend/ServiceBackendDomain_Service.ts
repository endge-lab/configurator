import type {
  EndgeDocumentMutationRequest,
  EndgeDocumentMutationResult,
  EndgeDomainLoadRequest,
  EndgeDomainProvider,
  EndgeLiveDomainDocument,
  EndgeLiveDomainSnapshot,
  EndgeWorkspaceMutationRequest,
  EndgeWorkspaceMutationResult,
  EndgeWorkspaceServerState,
} from '@endge/core'

import { ENDGE_DOMAIN_BUNDLE_VERSION } from '@endge/core'

type UnknownRecord = Record<string, unknown>

const SNAPSHOT_DOCUMENT_KEYS = [
  'projects', 'tenants', 'environments', 'folders', 'types', 'queries',
  'data-views', 'compositions', 'stores', 'streams', 'updates', 'mocks',
  'components', 'actions', 'filters', 'converters', 'computations', 'vocabs',
  'i18n-bundles', 'auth-profiles', 'navigations', 'styles',
] as const

export type ServiceBackendDomainErrorCode
  = | 'service_backend_unauthorized'
    | 'workspace_forbidden'
    | 'revision_conflict'
    | 'service_backend_request_invalid'
    | 'service_backend_unavailable'
    | 'snapshot_invalid'

/** Typed transport error единственного domain provider Configurator. */
export class ServiceBackendDomainError extends Error {
  public constructor(
    public readonly code: ServiceBackendDomainErrorCode,
    message: string,
    public readonly status?: number,
    public readonly loginUrl?: string,
  ) {
    super(message)
    this.name = 'ServiceBackendDomainError'
  }
}

/** HTTP adapter полного live-domain API service-backend. */
export class ServiceBackendDomain_Service implements EndgeDomainProvider {
  public readonly id = 'service-backend'
  public readonly capabilities
  public etag: string | null = null

  private readonly _baseURL: string
  private _workspaceGeneration = ''

  public constructor(
    baseURL: string,
    private readonly _onUnauthorized: (loginUrl: string) => void,
    mutations = true,
  ) {
    this._baseURL = String(baseURL ?? '').trim().replace(/\/+$/, '')
    this.capabilities = {
      snapshot: true,
      mutations,
      softDelete: mutations,
      restore: mutations,
    } as const
  }

  public async loadWorkspace(request: EndgeDomainLoadRequest): Promise<EndgeLiveDomainSnapshot> {
    const response = await this._fetch('/api/v1/domain', {
      method: 'GET',
      workspaceIdentity: request.workspaceIdentity,
      signal: request.signal,
    })
    if (!isLiveSnapshot(response.payload, request.workspaceIdentity))
      throw new ServiceBackendDomainError('snapshot_invalid', 'Service backend returned an incompatible workspace snapshot', response.status)

    this.etag = response.etag
    this._workspaceGeneration = response.payload.workspace.state.generation
    return response.payload
  }

  public async createDocument(request: EndgeDocumentMutationRequest): Promise<EndgeDocumentMutationResult> {
    return this._mutateDocument(request, 'POST', `/api/v1/${request.collection}`)
  }

  public async updateDocument(request: EndgeDocumentMutationRequest): Promise<EndgeDocumentMutationResult> {
    return this._mutateDocument(request, 'PATCH', this._documentPath(request))
  }

  public async softDeleteDocument(request: EndgeDocumentMutationRequest): Promise<EndgeDocumentMutationResult> {
    return this._mutateDocument(request, 'DELETE', this._documentPath(request))
  }

  public async restoreDocument(request: EndgeDocumentMutationRequest): Promise<EndgeDocumentMutationResult> {
    return this._mutateDocument(request, 'POST', `${this._documentPath(request)}/restore`)
  }

  public async updateWorkspace(request: EndgeWorkspaceMutationRequest): Promise<EndgeWorkspaceMutationResult> {
    const response = await this._fetch(`/api/v1/workspaces/${encodeURIComponent(request.workspaceIdentity)}`, {
      method: 'PATCH',
      workspaceIdentity: request.workspaceIdentity,
      body: request.document,
      expectedRevision: request.expectedRevision,
      signal: request.signal,
    })
    const workspace = normalizeWorkspace(response.payload, this._workspaceGeneration)
    if (!workspace)
      throw new ServiceBackendDomainError('snapshot_invalid', 'Service backend returned an invalid workspace mutation response', response.status)
    return { workspace, etag: response.etag }
  }

  private _documentPath(request: EndgeDocumentMutationRequest): string {
    return `/api/v1/${request.collection}/${encodeURIComponent(request.identity)}`
  }

  private async _mutateDocument(
    request: EndgeDocumentMutationRequest,
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
  ): Promise<EndgeDocumentMutationResult> {
    const response = await this._fetch(path, {
      method,
      workspaceIdentity: request.workspaceIdentity,
      body: request.document,
      expectedRevision: request.expectedRevision,
      signal: request.signal,
    })
    const document = normalizeDocument(response.payload)
    if (!document)
      throw new ServiceBackendDomainError('snapshot_invalid', 'Service backend returned an invalid document mutation response', response.status)
    return { document, etag: response.etag }
  }

  private async _fetch(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      workspaceIdentity: string
      body?: Record<string, unknown>
      expectedRevision?: number
      signal?: AbortSignal
    },
  ): Promise<{ payload: UnknownRecord, status: number, etag: string | null }> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Endge-Workspace': options.workspaceIdentity,
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json'
    }
    if (options.expectedRevision != null) {
      headers['If-Match'] = `"${options.expectedRevision}"`
    }

    let response: Response
    try {
      response = await fetch(`${this._baseURL}${path}`, {
        method: options.method,
        credentials: 'include',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      })
    }
    catch (error) {
      if (options.signal?.aborted)
        throw error
      throw new ServiceBackendDomainError(
        'service_backend_unavailable',
        error instanceof Error ? error.message : 'Service backend is unavailable',
      )
    }

    const payload = await readJSON(response)
    if (response.status === 401) {
      const loginUrl = stringValue(payload?.loginUrl)
      if (loginUrl)
        this._onUnauthorized(loginUrl)
      throw new ServiceBackendDomainError('service_backend_unauthorized', 'Configurator session is no longer valid', 401, loginUrl || undefined)
    }
    if (response.status === 403)
      throw new ServiceBackendDomainError('workspace_forbidden', errorMessage(payload, 'Workspace access denied'), 403)
    if (response.status === 409)
      throw new ServiceBackendDomainError('revision_conflict', errorMessage(payload, 'Document was changed by another user. Reload the context.'), 409)
    if (response.status === 400 || response.status === 404 || response.status === 422 || response.status === 428)
      throw new ServiceBackendDomainError('service_backend_request_invalid', errorMessage(payload, `Service backend rejected the request (${response.status})`), response.status)
    if (!response.ok)
      throw new ServiceBackendDomainError('service_backend_unavailable', errorMessage(payload, `Service backend request failed (${response.status})`), response.status)
    if (!payload)
      throw new ServiceBackendDomainError('snapshot_invalid', 'Service backend returned an empty JSON response', response.status)

    return { payload, status: response.status, etag: response.headers.get('ETag') }
  }
}

function normalizeDocument(value: UnknownRecord): EndgeLiveDomainDocument | null {
  if (!stringValue(value.identity) || !stringValue(value.id) || !isPositiveInteger(value.revision))
    return null
  const { id, revision, deletedAt, createdBy, updatedBy, createdAt, updatedAt, ...document } = value
  return {
    ...document,
    state: {
      id: String(id),
      revision: Number(revision),
      ...(typeof deletedAt === 'string' ? { deletedAt } : {}),
      ...(isRecord(createdBy) ? { createdBy: createdBy as any } : {}),
      ...(isRecord(updatedBy) ? { updatedBy: updatedBy as any } : {}),
      ...(typeof createdAt === 'string' ? { createdAt } : {}),
      ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
    },
  }
}

function normalizeWorkspace(value: UnknownRecord, generation: string): EndgeWorkspaceMutationResult['workspace'] | null {
  if (!stringValue(value.identity) || !stringValue(value.id) || !isPositiveInteger(value.revision) || !isNonNegativeInteger(value.headSequence))
    return null
  const { id, revision, headSequence, createdBy, updatedBy, createdAt, updatedAt, ...workspace } = value
  const state: EndgeWorkspaceServerState = {
    id: String(id), revision: Number(revision), headSequence: Number(headSequence), generation,
    ...(isRecord(createdBy) ? { createdBy: createdBy as any } : {}),
    ...(isRecord(updatedBy) ? { updatedBy: updatedBy as any } : {}),
    ...(typeof createdAt === 'string' ? { createdAt } : {}),
    ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
  }
  return { ...workspace, state }
}

function isLiveSnapshot(value: UnknownRecord, workspaceIdentity: string): value is EndgeLiveDomainSnapshot {
  const workspace = value.workspace
  const documents = value.documents
  if (value.kind !== 'workspace-snapshot'
    || value.schemaVersion !== ENDGE_DOMAIN_BUNDLE_VERSION
    || !isRecord(workspace)
    || stringValue(workspace.identity) !== workspaceIdentity
    || !stringValue(workspace.displayName)
    || (workspace.dataMode !== 'development' && workspace.dataMode !== 'production')
    || !isRecord(workspace.configuration)
    || !isRecord(workspace.state)
    || !stringValue(workspace.state.id)
    || !stringValue(workspace.state.generation)
    || !isNonNegativeInteger(workspace.state.revision)
    || !isNonNegativeInteger(workspace.state.headSequence)
    || !isRecord(documents)
    || !Array.isArray(value.installedIntegrations)
    || !value.installedIntegrations.every(isInstalledIntegration))
    return false

  return SNAPSHOT_DOCUMENT_KEYS.every(key => Array.isArray(documents[key]) && documents[key].every(isLiveDocument))
}

function isLiveDocument(value: unknown): boolean {
  return isRecord(value)
    && stringValue(value.identity).length > 0
    && isRecord(value.state)
    && stringValue(value.state.id).length > 0
    && isNonNegativeInteger(value.state.revision)
    && (value.state.deletedAt == null || typeof value.state.deletedAt === 'string')
}

function isInstalledIntegration(value: unknown): boolean {
  return isRecord(value) && !!stringValue(value.identity) && !!stringValue(value.version) && isRecord(value.configuration)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

async function readJSON(response: Response): Promise<UnknownRecord | null> {
  try {
    const value: unknown = await response.json()
    return isRecord(value) ? value : null
  }
  catch {
    return null
  }
}

function errorMessage(value: UnknownRecord | null, fallback: string): string {
  return stringValue(value?.message) || stringValue(value?.error) || fallback
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
