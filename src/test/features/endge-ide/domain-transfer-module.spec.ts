import type {
  ServiceBackendDomainImportPlan,
  ServiceBackendDomainImportResult,
  ServiceBackendDomainTransferAdapter,
} from '@/features/endge-ide/domain/types/domain-transfer.type'
import { describe, expect, it, vi } from 'vitest'
import { EndgeIDEDomainTransfer_Module } from '@/features/endge-ide/model/modules/domain-transfer/EndgeIDEDomainTransfer_Module'

const plan: ServiceBackendDomainImportPlan = {
  valid: true,
  planId: 'plan-1',
  targetWorkspace: 'workspace-1',
  targetETag: 'etag-1',
  incoming: { documents: 1, integrations: 0 },
  creates: 1,
  updates: 0,
  restores: 0,
  deletes: 0,
  warnings: [],
  validationErrors: [],
  unsupportedCollections: [],
  missingIntegrations: [],
}

const result: ServiceBackendDomainImportResult = {
  workspace: 'workspace-1',
  imported: { documents: 1, integrations: 0 },
  creates: 1,
  updates: 0,
  restores: 0,
  deletes: 0,
  commitId: 'commit-1',
  parentCommitId: 'commit-0',
  domainVersion: '1.0.0',
}

describe('модуль переноса домена', () => {
  /** Проверяет, что модуль остаётся единственной точкой вызова backend adapter для export/import. */
  it('передаёт операции и contracts во внешний adapter без изменения данных', async () => {
    const adapter: ServiceBackendDomainTransferAdapter = {
      downloadExport: vi.fn().mockResolvedValue(undefined),
      planImport: vi.fn().mockResolvedValue(plan),
      import: vi.fn().mockResolvedValue(result),
    }
    const module = new EndgeIDEDomainTransfer_Module(adapter)
    const snapshot = { version: '1', documents: [], integrations: [] } as never
    const planRequest = { workspaceIdentity: 'workspace-1', snapshot }
    const importRequest = {
      workspaceIdentity: 'workspace-1',
      planId: 'plan-1',
      confirmation: 'workspace-1',
      targetETag: 'etag-1',
    }

    await module.downloadExport('workspace-1')
    await expect(module.planImport(planRequest)).resolves.toBe(plan)
    await expect(module.import(importRequest)).resolves.toBe(result)

    expect(adapter.downloadExport).toHaveBeenCalledWith('workspace-1')
    expect(adapter.planImport).toHaveBeenCalledWith(planRequest)
    expect(adapter.import).toHaveBeenCalledWith(importRequest)
  })
})
