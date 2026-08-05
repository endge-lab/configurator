import type { EndgeDomainBundle } from '@endge/core'

/** Нормализованный результат безопасной проверки destructive import. */
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
  willRemove: {
    documents: number
    revisions: number
    commits: number
    releases: number
  }
  warnings: string[]
  validationErrors: string[]
  unsupportedCollections: string[]
  missingIntegrations: string[]
}

/** Результат атомарного импорта и metadata созданной backend-копии. */
export interface ServiceBackendDomainImportResult {
  workspace: string
  imported: {
    documents: number
    integrations: number
  }
  backup: {
    id: string
    kind: string
    sizeBytes: number
    createdAt: string
  }
  initialCommitId: string
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
