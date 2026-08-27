import type { EndgeDomainBundle } from '@endge/core'

/** Нормализованный результат проверки безопасного ревизионного импорта. */
export interface ServiceBackendDomainImportPlan {
  planId?: string
  valid: boolean
  targetWorkspace: string
  targetETag: string
  expiresAt?: string
  incoming: {
    documents: number
    integrations: number
  }
  creates: number
  updates: number
  restores: number
  deletes: number
  warnings: string[]
  validationErrors: string[]
  unsupportedCollections: string[]
  missingIntegrations: string[]
}

/** Результат атомарного импорта и созданный обратимый commit. */
export interface ServiceBackendDomainImportResult {
  workspace: string
  imported: {
    documents: number
    integrations: number
  }
  creates: number
  updates: number
  restores: number
  deletes: number
  commitId: string
  parentCommitId: string
  domainVersion: string
}

export interface ServiceBackendDomainImportPlanRequest {
  workspaceIdentity: string
  snapshot: EndgeDomainBundle
  signal?: AbortSignal
}

export interface ServiceBackendDomainImportRequest {
  workspaceIdentity: string
  planId: string
  confirmation: string
  targetETag: string
  signal?: AbortSignal
}

/** Контракт внешнего backend transport для export/import домена. */
export interface ServiceBackendDomainTransferAdapter {
  downloadExport: (workspaceIdentity: string) => Promise<void>
  planImport: (request: ServiceBackendDomainImportPlanRequest) => Promise<ServiceBackendDomainImportPlan>
  import: (request: ServiceBackendDomainImportRequest) => Promise<ServiceBackendDomainImportResult>
}
