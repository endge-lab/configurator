import type {
  EndgeDomainLoadRequest,
  EndgeDomainProvider,
  EndgeLiveDomainSnapshot,
} from '@endge/core'

import { ENDGE_DOMAIN_BUNDLE_VERSION } from '@endge/core'

type UnknownRecord = Record<string, unknown>

const SNAPSHOT_DOCUMENT_KEYS = [
  'projects',
  'tenants',
  'environments',
  'folders',
  'types',
  'queries',
  'data-views',
  'compositions',
  'stores',
  'streams',
  'updates',
  'mocks',
  'components',
  'actions',
  'filters',
  'converters',
  'computations',
  'vocabs',
  'i18n-bundles',
  'auth-profiles',
  'navigations',
  'styles',
] as const

export type ServiceBackendDomainErrorCode
  = | 'service_backend_unauthorized'
    | 'workspace_forbidden'
    | 'service_backend_unavailable'
    | 'snapshot_invalid'

/** Typed transport error нового domain provider. */
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

/** Загружает весь workspace одним snapshot-запросом. */
export class ServiceBackendDomain_Service implements EndgeDomainProvider {
  public readonly id = 'service-backend'
  public readonly capabilities = { snapshot: true, mutations: false } as const
  public etag: string | null = null

  private readonly _baseURL: string

  public constructor(
    baseURL: string,
    private readonly _onUnauthorized: (loginUrl: string) => void,
  ) {
    this._baseURL = String(baseURL ?? '').trim().replace(/\/+$/, '')
  }

  /** Возвращает консистентный live snapshot запрошенного workspace. */
  public async loadWorkspace(request: EndgeDomainLoadRequest): Promise<EndgeLiveDomainSnapshot> {
    let response: Response
    try {
      response = await fetch(`${this._baseURL}/api/v1/domain`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Endge-Workspace': request.workspaceIdentity,
        },
        signal: request.signal,
      })
    }
    catch (error) {
      if (request.signal?.aborted) {
        throw error
      }
      throw new ServiceBackendDomainError(
        'service_backend_unavailable',
        error instanceof Error ? error.message : 'Service backend is unavailable',
      )
    }

    const payload = await readJSON(response)
    if (response.status === 401) {
      const loginUrl = stringValue(payload?.loginUrl)
      if (loginUrl) {
        this._onUnauthorized(loginUrl)
      }
      throw new ServiceBackendDomainError(
        'service_backend_unauthorized',
        'Configurator session is no longer valid',
        response.status,
        loginUrl || undefined,
      )
    }
    if (response.status === 403) {
      throw new ServiceBackendDomainError(
        'workspace_forbidden',
        stringValue(payload?.message) || `Workspace access denied: ${request.workspaceIdentity}`,
        response.status,
      )
    }
    if (!response.ok) {
      throw new ServiceBackendDomainError(
        'service_backend_unavailable',
        stringValue(payload?.message) || `Service backend request failed with ${response.status}`,
        response.status,
      )
    }
    if (!isLiveSnapshot(payload, request.workspaceIdentity)) {
      throw new ServiceBackendDomainError(
        'snapshot_invalid',
        'Service backend returned an incompatible workspace snapshot',
        response.status,
      )
    }

    this.etag = response.headers.get('ETag')
    return payload
  }
}

function isLiveSnapshot(value: UnknownRecord | null, workspaceIdentity: string): value is EndgeLiveDomainSnapshot {
  if (!isRecord(value)) {
    return false
  }

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
    || !value.installedIntegrations.every(isInstalledIntegration)) {
    return false
  }

  return SNAPSHOT_DOCUMENT_KEYS.every((key) => {
    const collection = documents[key]
    return Array.isArray(collection) && collection.every(isLiveDocument)
  })
}

function isLiveDocument(value: unknown): boolean {
  return isRecord(value)
    && stringValue(value.identity).length > 0
    && isRecord(value.state)
    && stringValue(value.state.id).length > 0
    && isNonNegativeInteger(value.state.revision)
}

function isInstalledIntegration(value: unknown): boolean {
  return isRecord(value)
    && stringValue(value.identity).length > 0
    && stringValue(value.version).length > 0
    && isRecord(value.configuration)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
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

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
