import type { ServiceBackendDomainTransferError } from '@/features/endge-ide/model/backend/ServiceBackendDomainTransfer_Service'
import type { EndgeDomainBundle } from '@endge/core'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceBackendDomainTransfer_Service } from '@/features/endge-ide/model/backend/ServiceBackendDomainTransfer_Service'

const snapshot = {
  kind: 'workspace-snapshot',
  schemaVersion: 1,
  workspace: {},
  installedIntegrations: [],
  documents: {},
} as unknown as EndgeDomainBundle

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
      willRemove: { documents: 8, revisions: 24, commits: 3, releases: 1 },
      warnings: ['Existing workspace documents and history will be removed'],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainTransfer_Service('https://backend.test/')

    await expect(service.planImport({
      workspaceIdentity: 'workspace-a',
      snapshot,
    })).resolves.toMatchObject({
      valid: true,
      incoming: { documents: 12 },
      willRemove: { documents: 8, revisions: 24 },
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain/import/plan', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Endge-Workspace': 'workspace-a',
      },
      body: JSON.stringify({ snapshot }),
      signal: undefined,
    })
  })

  it('applies only the checked plan with exact confirmation and If-Match', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      workspace: 'workspace-a',
      backup: {
        id: 'backup-id',
        kind: 'pre_import',
        sizeBytes: 1024,
        createdAt: '2026-08-04T12:00:00Z',
      },
      imported: { documents: 12, integrations: 0 },
      initialCommitId: 'commit-id',
    }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainTransfer_Service('https://backend.test')

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
    const service = new ServiceBackendDomainTransfer_Service('https://backend.test')

    await expect(service.planImport({
      workspaceIdentity: 'workspace-a',
      snapshot,
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
