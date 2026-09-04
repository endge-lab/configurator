import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  init: vi.fn(),
}))

class MemoryStorage implements Storage {
  private readonly _values = new Map<string, string>()
  public get length(): number { return this._values.size }
  public clear(): void { this._values.clear() }
  public getItem(key: string): string | null { return this._values.get(key) ?? null }
  public key(index: number): string | null { return [...this._values.keys()][index] ?? null }
  public removeItem(key: string): void { this._values.delete(key) }
  public setItem(key: string, value: string): void { this._values.set(key, value) }
}

vi.mock('@/features/endge-ide/bootstrap/endge-runtime-plugins', () => ({}))
vi.mock('@/features/endge-ide/bootstrap/endge-renderer-plugins', () => ({}))
vi.mock('@/features/endge-ide/EndgeIDE', () => ({
  EndgeIDE: {
    setup: vi.fn(),
    reset: vi.fn(),
  },
}))
vi.mock('@/features/endge-ide/config/endge-backend', () => ({
  getEndgeBackendConfig: mocks.config,
}))
vi.mock('@/app/modules/ConfiguratorContext_Module', () => ({
  ConfiguratorContext_Module: class {
    public init = mocks.init
    public reset = vi.fn()
  },
}))
vi.mock('@/app/modules/ConfiguratorI18n_Module', () => ({
  ConfiguratorI18n_Module: class {
    public availableLocales = { value: [] }
    public init = vi.fn()
    public reset = vi.fn()
  },
}))

describe('инициализация Endge IDE через backend', () => {
  let Configurator: typeof import('@/app').Configurator

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    mocks.init.mockReset()
    mocks.config.mockReset()
    vi.stubEnv('VITE_ENDGE_WORKSPACE_IDENTITY', 'workspace-a')
    mocks.config.mockReturnValue({
      serviceBackendURL: 'https://backend.test',
      primaryBackendURL: 'https://backend.test',
      activeBackendURL: 'https://backend.test',
    })
    const bootstrapModule = await import('@/app')
    Configurator = bootstrapModule.Configurator
  })

  it('проверяет пользовательскую сессию перед продолжением запуска service backend', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
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
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })).mockResolvedValueOnce(new Response(JSON.stringify({
      items: [],
      total: 0,
      canManage: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      sessionStorage: { removeItem: vi.fn() },
    })
    const backendConfig = {
      serviceBackendURL: 'https://backend.test',
      primaryBackendURL: 'https://backend.test',
      activeBackendURL: 'https://backend.test',
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
      workspaceIdentity: 'workspace-a',
    })
  })

  it('перенаправляет при отсутствии сессии и останавливает запуск Core', async () => {
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
      primaryBackendURL: 'https://backend.test',
      activeBackendURL: 'https://backend.test',
    })

    await expect(Configurator.init()).resolves.toBe('redirecting')

    expect(assign).toHaveBeenCalledOnce()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('предлагает явно повторить вход, если после callback сессия по-прежнему отсутствует', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'unauthorized',
      loginUrl: 'https://backend.test/auth/login',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })))
    const assign = vi.fn()
    const sessionStorage = new MemoryStorage()
    sessionStorage.setItem(
      'endge:configurator-login-redirect:v2:https%3A%2F%2Fbackend.test',
      String(Date.now()),
    )
    vi.stubGlobal('window', {
      location: {
        origin: 'https://configurator.test',
        href: 'https://configurator.test/editor',
        assign,
      },
      sessionStorage,
    })

    await expect(Configurator.init()).resolves.toBe('authentication-required')

    expect(assign).not.toHaveBeenCalled()
    expect(Configurator.authenticationRequirement).toEqual({
      backendURL: 'https://backend.test',
      loginUrl: 'https://backend.test/auth/login',
    })

    Configurator.retryAuthentication()

    expect(assign).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith(
      'https://backend.test/auth/login?returnTo=https%3A%2F%2Fconfigurator.test%2Feditor',
    )
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('запускает Viewer с возможностями провайдера только для чтения', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { id: 'developer-id', providerId: 'keycloak', subject: 'subject', issuer: 'https://issuer', active: true },
        platformAdmin: false,
        workspaces: [{ id: 'workspace-id', identity: 'workspace-a', displayName: 'Workspace A', active: true, role: 'viewer' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
        total: 0,
        canManage: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('window', { sessionStorage: { removeItem: vi.fn() } })
    mocks.config.mockReturnValue({
      serviceBackendURL: 'https://backend.test',
      primaryBackendURL: 'https://backend.test',
      activeBackendURL: 'https://backend.test',
    })

    await expect(Configurator.init()).resolves.toBe('ready')

    expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({
      workspaceRole: 'viewer',
      domainProvider: expect.objectContaining({
        capabilities: { snapshot: true, mutations: false, softDelete: false, restore: false },
      }),
    }))
  })

  it('требует выбрать Workspace без запуска Endge, если сохранённое и начальное значения недоступны', async () => {
    vi.stubEnv('VITE_ENDGE_WORKSPACE_IDENTITY', '')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { id: 'developer-id', providerId: 'keycloak', subject: 'subject', issuer: 'https://issuer', active: true },
        platformAdmin: false,
        workspaces: [{ id: 'workspace-id', identity: 'workspace-a', displayName: 'Workspace A', active: true, role: 'editor' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
        total: 0,
        canManage: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('window', { sessionStorage: { removeItem: vi.fn() } })

    await expect(Configurator.init()).resolves.toBe('workspace-selection-required')

    expect(Configurator.workspaceSelection).toHaveLength(1)
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('сохраняет выбор недоступного удалённого backend и предоставляет восстанавливаемую ошибку запуска', async () => {
    vi.resetModules()
    const localStorage = new MemoryStorage()
    localStorage.setItem('endge:configurator:active-backend-url:v1', 'https://remote.test')
    vi.stubGlobal('window', {
      localStorage,
      sessionStorage: { removeItem: vi.fn() },
    })
    mocks.config.mockReturnValue({
      serviceBackendURL: 'https://remote.test',
      primaryBackendURL: 'https://primary.test',
      activeBackendURL: 'https://remote.test',
    })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { id: 'developer-id', providerId: 'keycloak', subject: 'subject', issuer: 'https://issuer', active: true },
        platformAdmin: true,
        workspaces: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'remote', name: 'Remote', baseUrl: 'https://remote.test' }],
        total: 1,
        canManage: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')))

    const { Configurator: RemoteConfigurator } = await import('@/app')

    await expect(RemoteConfigurator.init()).resolves.toBe('backend-connection-failed')

    expect(localStorage.getItem('endge:configurator:active-backend-url:v1')).toBe('https://remote.test')
    expect(RemoteConfigurator.backendConnectionFailure).toEqual({
      backendURL: 'https://remote.test',
      code: 'session_unavailable',
      message: 'Failed to fetch',
    })
    expect(mocks.init).not.toHaveBeenCalled()
  })
})
