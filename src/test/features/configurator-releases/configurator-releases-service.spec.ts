import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfiguratorReleases_Service } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('configurator versions service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a release from the explicitly selected commit without an implicit commit', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json(
        {
          id: 'release-id',
          identity: 'release-a',
          displayName: 'release-a',
          sourceCommitId: 'commit-id',
          headSequence: 7,
          createdAt: 'now',
        },
        201,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleases_Service(
      'https://backend.test',
      () => 'workspace-a',
    )

    await service.createRelease('release-a', 'commit-id')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.test/api/v1/releases',
      expect.objectContaining({
        body: JSON.stringify({
          identity: 'release-a',
          displayName: 'release-a',
          sourceCommitId: 'commit-id',
        }),
      }),
    )
  })

  it('creates a preserve commit using the preview head sequence', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json(
        {
          id: 'commit-id',
          baseSequence: 4,
          headSequence: 8,
          message: 'Saved work',
          revisionPolicy: 'preserve',
          operation: 'user',
          createdAt: 'now',
        },
        201,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleases_Service(
      'https://backend.test',
      () => 'workspace-a',
    )

    await service.createCommit(' Saved work ', 8)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.test/api/v1/commits',
      expect.objectContaining({
        body: JSON.stringify({
          message: 'Saved work',
          revisionPolicy: 'preserve',
          expectedHeadSequence: 8,
        }),
      }),
    )
  })

  it('plans and restores a selected commit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ valid: true, updates: 3, expectedHeadSequence: 12 }),
      )
      .mockResolvedValueOnce(
        json(
          {
            id: 'restore-id',
            baseSequence: 12,
            headSequence: 15,
            message: 'Restore commit selected-id',
            revisionPolicy: 'preserve',
            operation: 'commit_restore',
            createdAt: 'now',
          },
          201,
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleases_Service(
      'https://backend.test',
      () => 'workspace-a',
    )

    const plan = await service.planCommitRestore('selected-id')
    await service.restoreCommit('selected-id', plan.expectedHeadSequence)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://backend.test/api/v1/commits/selected-id/restore/plan',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://backend.test/api/v1/commits/selected-id/restore',
      expect.objectContaining({
        body: JSON.stringify({ expectedHeadSequence: 12 }),
      }),
    )
  })
})
