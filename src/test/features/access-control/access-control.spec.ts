import { afterEach, describe, expect, it, vi } from 'vitest'

import { canManageAccess } from '@/features/access-control/model/access-control.policy'
import { AccessControlHttp_Adapter } from '@/features/access-control/model/adapters/AccessControlHttp_Adapter'

describe('access control service', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows access management only to Platform Admin or Workspace Admin', () => {
    expect(canManageAccess(true, 'viewer')).toBe(true)
    expect(canManageAccess(false, 'admin')).toBe(true)
    expect(canManageAccess(false, 'editor')).toBe(false)
    expect(canManageAccess(false, 'viewer')).toBe(false)
  })

  it('searches users lazily on the active backend with workspace authorization context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'user-1', providerId: 'oidc', username: 'ivan', active: true }],
      nextCursor: 'next',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new AccessControlHttp_Adapter('https://remote.test')
    const controller = new AbortController()

    const page = await service.searchUsers('iv', 'production', 'cursor', controller.signal)

    expect(page.nextCursor).toBe('next')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://remote.test/api/v1/service-users/search?q=iv&limit=20&workspaceIdentity=production&cursor=cursor',
      expect.objectContaining({ credentials: 'include', signal: controller.signal }),
    )
  })

  it('writes grants by user UUID and supports one transactional all-active command', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'grant-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ affected: 3, created: 2, updated: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new AccessControlHttp_Adapter('https://backend.test')

    await service.putGrant({ userId: 'user-1', scopeType: 'workspace', workspaceIdentity: 'dev', role: 'editor' })
    const bulk = await service.bulkWorkspaceGrants({ userId: 'user-1', role: 'viewer', selection: { type: 'all-active' } })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: 'user-1',
      scopeType: 'workspace',
      workspaceIdentity: 'dev',
      role: 'editor',
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      userId: 'user-1',
      role: 'viewer',
      selection: { type: 'all-active' },
    })
    expect(bulk).toEqual({ affected: 3, created: 2, updated: 1 })
  })

  it('loads one user access by UUID without relying on a non-unique username', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new AccessControlHttp_Adapter('https://backend.test')

    await service.listGrants('workspace', undefined, '', '', '00000000-0000-0000-0000-000000000042')

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://backend.test/api/v1/access-grants?scopeType=workspace&limit=50&userId=00000000-0000-0000-0000-000000000042',
    )
  })

  it('preserves structured backend authorization errors for the modal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'last_platform_admin_required',
      message: 'The last Platform Admin cannot be removed',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })))
    const service = new AccessControlHttp_Adapter('https://backend.test')

    await expect(service.deleteGrant('grant-1')).rejects.toMatchObject({
      code: 'last_platform_admin_required',
      status: 409,
      message: 'The last Platform Admin cannot be removed',
    })
  })
})
