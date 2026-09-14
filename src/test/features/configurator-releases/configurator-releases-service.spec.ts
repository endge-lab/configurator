import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfiguratorReleasesHttp_Adapter } from '@/features/configurator-releases/adapters/ConfiguratorReleasesHttp_Adapter'

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('сервис версий Configurator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('создаёт release из явно выбранного commit без неявного commit', async () => {
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
    const service = new ConfiguratorReleasesHttp_Adapter(
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

  it('uploads exact binary and metadata using the workspace frozen at build time', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'release-id', identity: 'v1', displayName: 'v1', sourceCommitId: 'commit-id', headSequence: 7, createdAt: 'now', description: 'Comment', buildMetadata: { version: 1, programId: 'program-a' } }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ConfiguratorReleasesHttp_Adapter('https://backend.test', () => 'new-workspace')
    const bytes = new Uint8Array([31, 139, 8, 0])
    const release = await service.createFromBuild({ identity: 'v1', displayName: 'v1', description: 'Comment', commitMessage: 'Saved', source: { workspaceId: 'old-id', workspaceIdentity: 'built-workspace', generation: 'generation-a', headSequence: 7 }, buildMetadata: { version: 1, programId: 'program-a', compilerVersion: 'program-v4', runtime: 'ts-browser', scope: 'complete-model', contextMode: 'effective-context', context: {}, includeAst: false, fileFormat: 'gzip' } }, bytes)
    const [url, request] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://backend.test/api/v1/releases/from-build')
    expect(request.headers['X-Endge-Workspace']).toBe('built-workspace')
    expect(JSON.parse(request.body.get('metadata'))).toMatchObject({ workspaceId: 'old-id', generation: 'generation-a', headSequence: 7, description: 'Comment', commitMessage: 'Saved' })
    expect(new Uint8Array(await request.body.get('bundle').arrayBuffer())).toEqual(bytes)
    expect(release.buildMetadata?.programId).toBe('program-a')
    expect(release.description).toBe('Comment')
  })

  it('создаёт сохраняющий commit с head sequence из предварительного плана', async () => {
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
    const service = new ConfiguratorReleasesHttp_Adapter(
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

  it('планирует и восстанавливает выбранный commit', async () => {
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
    const service = new ConfiguratorReleasesHttp_Adapter(
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
