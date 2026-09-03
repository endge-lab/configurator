import type { ServiceBackendDomainTransferError } from '@/features/endge-ide/adapters/backend/ServiceBackendDomainTransferHttp_Adapter'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceBackendDomainTransferHttp_Adapter } from '@/features/endge-ide/adapters/backend/ServiceBackendDomainTransferHttp_Adapter'

const snapshotJSON = JSON.stringify({
  kind: 'workspace-snapshot',
  schemaVersion: 1,
  workspace: {},
  installedIntegrations: [],
  documents: {},
})

describe('serviceBackendDomainTransfer_Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates an import plan with cookie credentials and workspace scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      valid: true,
      planId: '550e8400-e29b-41d4-a716-446655440006',
      targetWorkspace: 'workspace-a',
      targetETag: '"generation:3"',
      incoming: { documents: 12, integrations: 0 },
      creates: 2,
      updates: 8,
      restores: 1,
      deletes: 3,
      warnings: ['Documents absent from snapshot will be marked as deleted: 3'],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainTransferHttp_Adapter('https://backend.test/')

    await expect(service.planImport({
      workspaceIdentity: 'workspace-a',
      snapshotJSON,
    })).resolves.toMatchObject({
      valid: true,
      incoming: { documents: 12 },
      creates: 2,
      updates: 8,
      restores: 1,
      deletes: 3,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain/import/plan', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': 'workspace-a',
      },
      body: snapshotJSON,
      signal: undefined,
    })
  })

  it('applies only the checked plan with exact confirmation and If-Match', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      workspace: 'workspace-a',
      imported: { documents: 12, integrations: 0 },
      creates: 2,
      updates: 8,
      restores: 1,
      deletes: 3,
      commitId: 'commit-id',
      parentCommitId: 'parent-commit-id',
      domainVersion: 'dv2:sha256:test',
    }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainTransferHttp_Adapter('https://backend.test')

    await service.import({
      workspaceIdentity: 'workspace-a',
      planId: '550e8400-e29b-41d4-a716-446655440006',
      confirmation: 'workspace-a',
      targetETag: '"generation:3"',
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain/import', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': 'workspace-a',
        'If-Match': '"generation:3"',
      },
      body: JSON.stringify({
        planId: '550e8400-e29b-41d4-a716-446655440006',
        confirmation: 'workspace-a',
      }),
      signal: undefined,
    })
  })

  it('returns workspace admin denial without treating it as a new login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 'workspace_admin_required',
      message: 'Workspace Admin role is required',
    }, 403)))
    const service = new ServiceBackendDomainTransferHttp_Adapter('https://backend.test')

    await expect(service.planImport({
      workspaceIdentity: 'workspace-a',
      snapshotJSON,
    })).rejects.toMatchObject({
      code: 'workspace_admin_required',
      status: 403,
      loginUrl: undefined,
    } satisfies Partial<ServiceBackendDomainTransferError>)
  })
})

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
