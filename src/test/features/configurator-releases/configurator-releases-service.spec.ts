import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfiguratorReleases_Service } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('configurator releases service', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('creates a preserve commit for pending revisions before the release', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ headSequence: 7, revisionCount: 2 }))
      .mockResolvedValueOnce(json({ id: 'commit-id', headSequence: 7 }, 201))
      .mockResolvedValueOnce(json({ id: 'release-id', identity: 'release-a', displayName: 'release-a', sourceCommitId: 'commit-id', headSequence: 7, createdAt: 'now' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleases_Service('https://backend.test', () => 'workspace-a')

    await service.create('release-a')

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://backend.test/api/v1/commits', expect.objectContaining({
      body: JSON.stringify({ message: 'Release release-a', revisionPolicy: 'preserve', expectedHeadSequence: 7 }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://backend.test/api/v1/releases', expect.objectContaining({
      body: JSON.stringify({ identity: 'release-a', displayName: 'release-a', sourceCommitId: 'commit-id' }),
    }))
  })

  it('uses the commit with maximum headSequence when there are no pending revisions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ headSequence: 8, revisionCount: 0 }))
      .mockResolvedValueOnce(json({ items: [{ id: 'old', headSequence: 3 }, { id: 'latest', headSequence: 8 }] }))
      .mockResolvedValueOnce(json({ id: 'release-id', identity: 'release-b', displayName: 'release-b', sourceCommitId: 'latest', headSequence: 8, createdAt: 'now' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleases_Service('https://backend.test', () => 'workspace-a')

    await service.create('release-b')

    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://backend.test/api/v1/releases', expect.objectContaining({
      body: expect.stringContaining('"sourceCommitId":"latest"'),
    }))
  })
})
