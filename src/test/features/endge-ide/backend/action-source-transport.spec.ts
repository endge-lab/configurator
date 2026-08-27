import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceBackendDomainHttp_Adapter } from '@/features/endge-ide/model/backend/adapters/ServiceBackendDomainHttp_Adapter'

describe('action Source backend transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('patches and reads Action source fields without legacy Flow payload', async () => {
    const source = `defineAction({
  steps: {
    save: action({ identity: 'orders.save', input: input() }),
  },
  output: output('save'),
})`
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      identity: 'orders.submit',
      displayName: 'Submit order',
      source,
      sourceVersion: 1,
      id: 'action-document-id',
      revision: 8,
      deletedAt: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'ETag': '"8"' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ServiceBackendDomainHttp_Adapter('https://backend.test', vi.fn(), true)

    const result = await service.updateDocument({
      workspaceIdentity: 'workspace-a',
      collection: 'actions',
      identity: 'orders.submit',
      expectedRevision: 7,
      document: {
        identity: 'orders.submit',
        displayName: 'Submit order',
        source,
        sourceVersion: 1,
      },
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(request.body)) as Record<string, unknown>
    expect(body).toMatchObject({ source, sourceVersion: 1 })
    expect(body).not.toHaveProperty('definition')
    expect(body).not.toHaveProperty('input')
    expect(body).not.toHaveProperty('output')
    expect(result.document).toMatchObject({
      identity: 'orders.submit',
      source,
      sourceVersion: 1,
      state: { id: 'action-document-id', revision: 8 },
    })
  })
})
