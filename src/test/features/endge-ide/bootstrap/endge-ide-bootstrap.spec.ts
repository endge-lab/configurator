import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bootstrapEndgeIDE } from '@/features/endge-ide/model/bootstrap/endge-ide-bootstrap'

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  init: vi.fn(),
}))

vi.mock('@/features/endge-ide/model/bootstrap/endge-runtime-plugins', () => ({}))
vi.mock('@/features/endge-ide/model/bootstrap/endge-renderer-plugins', () => ({}))
vi.mock('@/features/endge-ide/model/config/endge-backend', () => ({
  getEndgeBackendConfig: mocks.config,
}))
vi.mock('@/features/endge-ide/model/context/endge-ide-context', () => ({
  EndgeIDEContext: { init: mocks.init },
}))

describe('endge IDE backend bootstrap', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    mocks.init.mockReset()
    mocks.config.mockReset()
  })

  it('keeps Payload mode free of developer-session requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const backendConfig = {
      mode: 'payload' as const,
      payloadBaseURL: 'https://payload.test/api',
      payloadSecret: 'legacy-secret',
    }
    mocks.config.mockReturnValue(backendConfig)

    await expect(bootstrapEndgeIDE()).resolves.toBe(true)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.init).toHaveBeenCalledWith({ backendConfig })
  })

  it('checks developer session before continuing service-backend boot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: {
        id: 'developer-id',
        providerId: 'keycloak',
        subject: 'developer-subject',
        issuer: 'https://identity.test/realms/endge',
        active: true,
      },
      platformAdmin: false,
      workspaces: [{
        id: 'workspace-id',
        identity: 'workspace-a',
        displayName: 'Workspace A',
        active: true,
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      sessionStorage: { removeItem: vi.fn() },
    })
    const backendConfig = {
      mode: 'service-backend' as const,
      serviceBackendURL: 'https://backend.test',
    }
    mocks.config.mockReturnValue(backendConfig)

    await expect(bootstrapEndgeIDE()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/auth/session', expect.objectContaining({
      credentials: 'include',
    }))
    expect(mocks.init).toHaveBeenCalledWith({
      backendConfig,
      domainProvider: expect.objectContaining({
        id: 'service-backend',
        capabilities: { snapshot: true, mutations: false },
      }),
    })
  })

  it('redirects on missing session and stops Core boot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'unauthorized',
      loginUrl: 'https://backend.test/auth/login',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })))
    const assign = vi.fn()
    vi.stubGlobal('window', {
      location: {
        origin: 'https://configurator.test',
        href: 'https://configurator.test/editor',
        assign,
      },
      sessionStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    })
    mocks.config.mockReturnValue({
      mode: 'service-backend',
      serviceBackendURL: 'https://backend.test',
    })

    await expect(bootstrapEndgeIDE()).resolves.toBe(false)

    expect(assign).toHaveBeenCalledOnce()
    expect(mocks.init).not.toHaveBeenCalled()
  })
})
