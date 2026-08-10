import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  init: vi.fn(),
}))

vi.mock('@/features/endge-ide/model/bootstrap/endge-runtime-plugins', () => ({}))
vi.mock('@/features/endge-ide/model/bootstrap/endge-renderer-plugins', () => ({}))
vi.mock('@/features/endge-ide/model/config/endge-backend', () => ({
  getEndgeBackendConfig: mocks.config,
}))
vi.mock('@/app/model/modules/context/ConfiguratorContext_Module', () => ({
  ConfiguratorContext_Module: class {
    public init = mocks.init
    public reset = vi.fn()
  },
}))
vi.mock('@/app/model/modules/i18n/ConfiguratorI18n_Module', () => ({
  ConfiguratorI18n_Module: class {
    public availableLocales = { value: [] }
    public init = vi.fn()
    public reset = vi.fn()
  },
}))

describe('endge IDE backend bootstrap', () => {
  let Configurator: typeof import('@/app').Configurator

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    mocks.init.mockReset()
    mocks.config.mockReset()
    vi.stubEnv('VITE_ENDGE_WORKSPACE_IDENTITY', 'workspace-a')
    const bootstrapModule = await import('@/app')
    Configurator = bootstrapModule.Configurator
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
        role: 'editor',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      sessionStorage: { removeItem: vi.fn() },
    })
    const backendConfig = {
      serviceBackendURL: 'https://backend.test',
    }
    mocks.config.mockReturnValue(backendConfig)

    await expect(Configurator.init()).resolves.toBe('ready')

    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/auth/session', expect.objectContaining({
      credentials: 'include',
    }))
    expect(mocks.init).toHaveBeenCalledWith({
      backendConfig,
      domainProvider: expect.objectContaining({
        id: 'service-backend',
        capabilities: { snapshot: true, mutations: true, softDelete: true, restore: true },
      }),
      workspaceRole: 'editor',
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
      serviceBackendURL: 'https://backend.test',
    })

    await expect(Configurator.init()).resolves.toBe('redirecting')

    expect(assign).toHaveBeenCalledOnce()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('boots Viewer with read-only provider capabilities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: { id: 'developer-id', providerId: 'keycloak', subject: 'subject', issuer: 'https://issuer', active: true },
      platformAdmin: false,
      workspaces: [{ id: 'workspace-id', identity: 'workspace-a', displayName: 'Workspace A', active: true, role: 'viewer' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('window', { sessionStorage: { removeItem: vi.fn() } })
    mocks.config.mockReturnValue({ serviceBackendURL: 'https://backend.test' })

    await expect(Configurator.init()).resolves.toBe('ready')

    expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({
      workspaceRole: 'viewer',
      domainProvider: expect.objectContaining({
        capabilities: { snapshot: true, mutations: false, softDelete: false, restore: false },
      }),
    }))
  })
})
