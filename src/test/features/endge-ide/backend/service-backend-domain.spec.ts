import type {
  ServiceBackendDomainError,
} from '@/features/endge-ide/model/backend/ServiceBackendDomain_Service'

import { ENDGE_DOMAIN_BUNDLE_VERSION } from '@endge/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ServiceBackendDomain_Service,
} from '@/features/endge-ide/model/backend/ServiceBackendDomain_Service'

const DOCUMENT_KEYS = [
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

function snapshot(): Record<string, unknown> {
  return {
    kind: 'workspace-snapshot',
    schemaVersion: ENDGE_DOMAIN_BUNDLE_VERSION,
    workspace: {
      identity: 'workspace-a',
      displayName: 'Workspace A',
      dataMode: 'development',
      configuration: {},
      state: {
        id: 'workspace-id',
        generation: 'generation-id',
        headSequence: 3,
        revision: 2,
      },
    },
    installedIntegrations: [],
    documents: Object.fromEntries(DOCUMENT_KEYS.map(key => [key, []])),
  }
}

describe('serviceBackendDomain_Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads one snapshot with cookie credentials, workspace header, signal and ETag', async () => {
    const abort = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot()), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'ETag': '"generation-id:3"' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const unauthorized = vi.fn()
    const service = new ServiceBackendDomain_Service('https://backend.test/', unauthorized)

    await expect(service.loadWorkspace({
      workspaceIdentity: 'workspace-a',
      signal: abort.signal,
    })).resolves.toMatchObject({ kind: 'workspace-snapshot' })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-Endge-Workspace': 'workspace-a',
      },
      signal: abort.signal,
    })
    expect(service.etag).toBe('"generation-id:3"')
    expect(unauthorized).not.toHaveBeenCalled()
  })

  it('does not restart login for forbidden workspace access', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'workspace_forbidden',
      message: 'Workspace access is forbidden',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const unauthorized = vi.fn()
    const service = new ServiceBackendDomain_Service('https://backend.test', unauthorized)

    await expect(service.loadWorkspace({ workspaceIdentity: 'workspace-a' })).rejects.toMatchObject({
      code: 'workspace_forbidden',
      status: 403,
    } satisfies Partial<ServiceBackendDomainError>)
    expect(unauthorized).not.toHaveBeenCalled()
  })

  it('rejects malformed documents before returning a snapshot', async () => {
    const invalid = snapshot()
    ;(invalid.documents as Record<string, unknown>).queries = [{ identity: 'query-without-state' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
    const service = new ServiceBackendDomain_Service('https://backend.test', vi.fn())

    await expect(service.loadWorkspace({ workspaceIdentity: 'workspace-a' })).rejects.toMatchObject({
      code: 'snapshot_invalid',
    } satisfies Partial<ServiceBackendDomainError>)
  })
})
