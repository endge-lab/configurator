import type {
  ServiceBackendDomainImportPlan,
  ServiceBackendDomainImportPlanRequest,
  ServiceBackendDomainImportRequest,
  ServiceBackendDomainImportResult,
  ServiceBackendDomainTransferAdapter,
} from '@/features/endge-ide/domain/types/domain-transfer.type'

type UnknownRecord = Record<string, unknown>

export type ServiceBackendDomainTransferErrorCode
  = | 'service_backend_unauthorized'
    | 'workspace_forbidden'
    | 'workspace_admin_required'
    | 'service_backend_unavailable'
    | 'import_conflict'
    | 'import_response_invalid'
    | 'import_request_failed'

/** Typed transport error полного export/import workflow. */
export class ServiceBackendDomainTransferError extends Error {
  public constructor(
    public readonly code: ServiceBackendDomainTransferErrorCode,
    message: string,
    public readonly status?: number,
    public readonly loginUrl?: string,
    public readonly backendCode?: string,
  ) {
    super(message)
    this.name = 'ServiceBackendDomainTransferError'
  }
}

/** Выполняет двухфазный ревизионный import нового backend. */
export class ServiceBackendDomainTransferHttp_Adapter implements ServiceBackendDomainTransferAdapter {
  private readonly _baseURL: string

  public constructor(baseURL: string) {
    this._baseURL = String(baseURL ?? '').trim().replace(/\/+$/, '')
  }

  /** Скачивает active-only portable export, сформированный backend. */
  public async downloadExport(workspaceIdentity: string): Promise<void> {
    const response = await fetch(`${this._baseURL}/api/v1/domain/export?download=true`, {
      credentials: 'include',
      headers: { 'X-Endge-Workspace': workspaceIdentity },
    })
    if (!response.ok) {
      throw new ServiceBackendDomainTransferError('import_request_failed', `Не удалось экспортировать домен (${response.status})`, response.status)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${workspaceIdentity}-domain.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  /** Валидирует файл и создаёт краткоживущий server-side import plan. */
  public async planImport(request: ServiceBackendDomainImportPlanRequest): Promise<ServiceBackendDomainImportPlan> {
    const response = await this._request('/api/v1/domain/import/plan', {
      method: 'POST',
      workspaceIdentity: request.workspaceIdentity,
      body: { snapshot: request.snapshot },
      signal: request.signal,
    })
    const plan = normalizeImportPlan(response.payload)
    if (!plan) {
      throw new ServiceBackendDomainTransferError(
        'import_response_invalid',
        'Backend вернул некорректный план импорта',
        response.status,
      )
    }
    return plan
  }

  /** Атомарно применяет ранее проверенный plan с optimistic concurrency guard. */
  public async import(request: ServiceBackendDomainImportRequest): Promise<ServiceBackendDomainImportResult> {
    const response = await this._request('/api/v1/domain/import', {
      method: 'POST',
      workspaceIdentity: request.workspaceIdentity,
      ifMatch: request.targetETag,
      body: {
        planId: request.planId,
        confirmation: request.confirmation,
      },
      signal: request.signal,
    })
    const result = normalizeImportResult(response.payload)
    if (!result) {
      throw new ServiceBackendDomainTransferError(
        'import_response_invalid',
        'Backend применил запрос, но вернул некорректный результат импорта',
        response.status,
      )
    }
    return result
  }

  private async _request(
    path: string,
    options: {
      method: 'POST'
      workspaceIdentity: string
      body: UnknownRecord
      ifMatch?: string
      signal?: AbortSignal
    },
  ): Promise<{ payload: UnknownRecord, status: number }> {
    let response: Response
    try {
      response = await fetch(`${this._baseURL}${path}`, {
        method: options.method,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Endge-Workspace': options.workspaceIdentity,
          ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {}),
        },
        body: JSON.stringify(options.body),
        signal: options.signal,
      })
    }
    catch (error) {
      if (options.signal?.aborted) {
        throw error
      }
      throw new ServiceBackendDomainTransferError(
        'service_backend_unavailable',
        error instanceof Error ? error.message : 'Backend недоступен',
      )
    }

    const payload = await readJSON(response)
    if (response.ok && payload) {
      return { payload, status: response.status }
    }

    const backendCode = stringValue(payload?.code)
    const message = stringValue(payload?.message) || `Backend request failed with ${response.status}`
    const loginUrl = stringValue(payload?.loginUrl)
    if (response.status === 401) {
      throw new ServiceBackendDomainTransferError(
        'service_backend_unauthorized',
        message,
        response.status,
        loginUrl || undefined,
        backendCode || undefined,
      )
    }
    if (response.status === 403) {
      throw new ServiceBackendDomainTransferError(
        backendCode === 'workspace_admin_required' ? 'workspace_admin_required' : 'workspace_forbidden',
        message,
        response.status,
        undefined,
        backendCode || undefined,
      )
    }
    if (response.status === 409 || response.status === 428) {
      throw new ServiceBackendDomainTransferError(
        'import_conflict',
        message,
        response.status,
        undefined,
        backendCode || undefined,
      )
    }
    if (response.status >= 500) {
      throw new ServiceBackendDomainTransferError(
        'service_backend_unavailable',
        message,
        response.status,
        undefined,
        backendCode || undefined,
      )
    }
    throw new ServiceBackendDomainTransferError(
      'import_request_failed',
      message,
      response.status,
      undefined,
      backendCode || undefined,
    )
  }
}

function normalizeImportPlan(value: UnknownRecord): ServiceBackendDomainImportPlan | null {
  if (typeof value.valid !== 'boolean') {
    return null
  }

  const plan: ServiceBackendDomainImportPlan = {
    planId: stringValue(value.planId) || undefined,
    valid: value.valid,
    targetWorkspace: stringValue(value.targetWorkspace),
    targetETag: stringValue(value.targetETag),
    expiresAt: stringValue(value.expiresAt) || undefined,
    incoming: normalizeCounts(value.incoming),
    creates: nonNegativeNumber(value.creates),
    updates: nonNegativeNumber(value.updates),
    restores: nonNegativeNumber(value.restores),
    deletes: nonNegativeNumber(value.deletes),
    warnings: stringArray(value.warnings),
    validationErrors: stringArray(value.validationErrors),
    unsupportedCollections: stringArray(value.unsupportedCollections),
    missingIntegrations: stringArray(value.missingIntegrations),
  }
  if (plan.valid && (!plan.planId || !plan.targetETag || !plan.targetWorkspace)) {
    return null
  }
  return plan
}

function normalizeImportResult(value: UnknownRecord): ServiceBackendDomainImportResult | null {
  const workspace = stringValue(value.workspace)
  const commitId = stringValue(value.commitId)
  const parentCommitId = stringValue(value.parentCommitId)
  const domainVersion = stringValue(value.domainVersion)
  if (!workspace || !commitId || !parentCommitId || !domainVersion) {
    return null
  }
  return {
    workspace,
    imported: normalizeCounts(value.imported),
    creates: nonNegativeNumber(value.creates),
    updates: nonNegativeNumber(value.updates),
    restores: nonNegativeNumber(value.restores),
    deletes: nonNegativeNumber(value.deletes),
    commitId,
    parentCommitId,
    domainVersion,
  }
}

function normalizeCounts(value: unknown): { documents: number, integrations: number } {
  const source = recordValue(value)
  return {
    documents: nonNegativeNumber(source?.documents),
    integrations: nonNegativeNumber(source?.integrations),
  }
}

async function readJSON(response: Response): Promise<UnknownRecord | null> {
  try {
    return recordValue(await response.json())
  }
  catch {
    return null
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : []
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function recordValue(value: unknown): UnknownRecord | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}
