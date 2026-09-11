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

describe('сервис домена через backend', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('загружает один snapshot с cookie credentials, заголовком Workspace, signal и ETag', async () => {
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

  it('обновляет документ с cookie, Workspace и оптимистичной ревизией', async () => {
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

  it('перемещает несколько документов одним атомарным запросом backend', async () => {
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
      placement: 'frontend',
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
        placement: 'frontend',
      }),
    }))
    expect(result.moved).toBe(2)
    expect(result.documents.map(item => item.document.state.revision)).toEqual([4, 6])
  })

  it('адресует одноимённый документ парой facet identity и document identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      facetIdentity: 'sales eu',
      identity: 'default profile',
      displayName: 'Default',
      configuration: { mode: 'inherit', patch: {} },
      meta: {},
      active: true,
      id: 'facet-document-id',
      revision: 4,
      deletedAt: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'ETag': '"4"' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn(), true)

    await service.updateFacetDocument({
      workspaceIdentity: 'workspace-a',
      facetIdentity: 'sales eu',
      identity: 'default profile',
      expectedRevision: 3,
      document: { displayName: 'Default' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.test/api/v1/facets/sales%20eu/documents/default%20profile',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'If-Match': '"3"', 'X-Endge-Workspace': 'workspace-a' }),
      }),
    )
  })

  it('передаёт полный optimistic-порядок фасетов одним запросом', async () => {
    const payload = {
      items: [
        { identity: 'region', displayName: 'Region', icon: 'MapPin', color: '#2563eb', position: 0, id: 'region-id', revision: 3 },
        { identity: 'brand', displayName: 'Brand', icon: 'Tag', color: '#16a34a', position: 1, id: 'brand-id', revision: 5 },
      ],
      total: 2,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn(), true)

    const result = await service.reorderFacets({
      workspaceIdentity: 'workspace-a',
      items: [
        { identity: 'region', expectedRevision: 2 },
        { identity: 'brand', expectedRevision: 4 },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/api/v1/facets/reorder', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ items: [
        { identity: 'region', expectedRevision: 2 },
        { identity: 'brand', expectedRevision: 4 },
      ] }),
    }))
    expect(result.documents.map(document => document.identity)).toEqual(['region', 'brand'])
  })

  it('не перезапускает вход при запрещённом доступе к Workspace', async () => {
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

  it('отклоняет некорректные документы до возврата snapshot', async () => {
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
