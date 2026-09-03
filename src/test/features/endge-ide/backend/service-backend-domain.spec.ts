import type {
  ServiceBackendDomainError,
} from '@/features/endge-ide/adapters/backend/ServiceBackendDomainHttp_Adapter'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ServiceBackendDomainHttp_Adapter,
} from '@/features/endge-ide/adapters/backend/ServiceBackendDomainHttp_Adapter'

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
  'configurations',
] as const

function snapshot(): Record<string, unknown> {
  return {
    kind: 'workspace-snapshot',
    schemaVersion: 1,
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
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test/', unauthorized)

    await expect(service.loadWorkspace({
      workspaceIdentity: 'workspace-a',
      signal: abort.signal,
    })).resolves.toMatchObject({ kind: 'workspace-snapshot' })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-Endge-Workspace': 'workspace-a',
      },
      body: undefined,
      signal: abort.signal,
    })
    expect(service.etag).toBe('"generation-id:3"')
    expect(unauthorized).not.toHaveBeenCalled()
  })

  it('updates a document with cookie, workspace and optimistic revision', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      identity: 'query-a',
      displayName: 'Query A',
      source: 'query {}',
      sourceVersion: 2,
      id: 'document-id',
      revision: 4,
      deletedAt: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'ETag': '"4"' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn(), true)

    const result = await service.updateDocument({
      workspaceIdentity: 'workspace-a',
      collection: 'queries',
      identity: 'query-a',
      expectedRevision: 3,
      document: { identity: 'query-a', displayName: 'Query A', source: 'query {}', sourceVersion: 2 },
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/queries/query-a', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-Endge-Workspace': 'workspace-a', 'If-Match': '"3"' }),
    }))
    expect(result.document.state).toMatchObject({ id: 'document-id', revision: 4 })
    expect(result.etag).toBe('"4"')
  })

  it('moves several documents through one atomic backend request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      documents: [
        {
          collection: 'actions',
          document: { identity: 'action-a', displayName: 'Action A', folderIdentity: 'schedule', id: 'action-a-id', revision: 4 },
        },
        {
          collection: 'actions',
          document: { identity: 'action-b', displayName: 'Action B', folderIdentity: 'schedule', id: 'action-b-id', revision: 6 },
        },
      ],
      moved: 2,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn(), true)

    const result = await service.moveDocuments({
      workspaceIdentity: 'workspace-a',
      folderIdentity: 'schedule',
      documents: [
        { collection: 'actions', identity: 'action-a', expectedRevision: 3 },
        { collection: 'actions', identity: 'action-b', expectedRevision: 5 },
      ],
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/domain/documents/move', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        documents: [
          { collection: 'actions', identity: 'action-a', expectedRevision: 3 },
          { collection: 'actions', identity: 'action-b', expectedRevision: 5 },
        ],
        folderIdentity: 'schedule',
      }),
    }))
    expect(result.moved).toBe(2)
    expect(result.documents.map(item => item.document.state.revision)).toEqual([4, 6])
  })

  it('does not restart login for forbidden workspace access', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'workspace_forbidden',
      message: 'Workspace access is forbidden',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const unauthorized = vi.fn()
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', unauthorized)

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
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn())

    await expect(service.loadWorkspace({ workspaceIdentity: 'workspace-a' })).rejects.toMatchObject({
      code: 'snapshot_invalid',
    } satisfies Partial<ServiceBackendDomainError>)
  })
})
