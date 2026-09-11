import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfiguratorContext_Module } from '@/app/modules/ConfiguratorContext_Module'

const mocks = vi.hoisted(() => ({
  executionContext: {} as Record<string, unknown>,
  mockEnabled: false,
  dataModeOverridden: false,
  boot: vi.fn(),
  reset: vi.fn(),
  setDataMode: vi.fn(),
  clearDataModeOverride: vi.fn(),
  readDataModeOverride: vi.fn(),
  writeDataModeOverride: vi.fn(),
  clearStoredDataModeOverride: vi.fn(),
  requireActive: vi.fn((_requirement?: Record<string, unknown>) => ({ id: 'vue-native' })),
  resolveAvailable: vi.fn(() => ({ id: 'vue-native' })),
}))

vi.mock('@endge/core', () => ({
  ENDGE_CORE_MOCK_PROVIDERS: [],
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL: 'endge.sfc-render-adapter',
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION: 1,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS: [],
  Endge: {
    boot: mocks.boot,
    reset: mocks.reset,
    context: {
      getExecutionContext: () => ({ ...mocks.executionContext }),
      get isMockEnabled() {
        return mocks.mockEnabled
      },
      get isDataModeOverridden() {
        return mocks.dataModeOverridden
      },
      setDataMode: mocks.setDataMode,
      clearDataModeOverride: mocks.clearDataModeOverride,
    },
    mock: {
      listProviders: () => [],
      registerProvider: vi.fn(),
    },
    uiRegistry: {
      adapters: {
        requireActive: mocks.requireActive,
        resolveAvailable: mocks.resolveAvailable,
      },
    },
    workspace: {
      current: { identity: 'workspace' },
      defaultSfcAdapterId: 'vue-native',
    },
  },
}))

vi.mock('@/features/endge-ide/services/context/configurator-data-mode-repository', () => ({
  configuratorDataModeRepository: {
    read: mocks.readDataModeOverride,
    write: mocks.writeDataModeOverride,
    clear: mocks.clearStoredDataModeOverride,
  },
}))

describe('контекст EndgeIDE', () => {
  let context: ConfiguratorContext_Module
  const backendConfig = {
    serviceBackendURL: 'https://backend.test',
    primaryBackendURL: 'https://backend.test',
    activeBackendURL: 'https://backend.test',
  }
  const domainProvider = {
    id: 'service-backend',
    capabilities: { snapshot: true as const, mutations: true, softDelete: true, restore: true },
    etag: null,
    loadWorkspace: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    softDeleteDocument: vi.fn(),
    restoreDocument: vi.fn(),
    moveDocuments: vi.fn(),
    updateWorkspace: vi.fn(),
  }

  beforeEach(async () => {
    context = new ConfiguratorContext_Module({ start: vi.fn(), stop: vi.fn() })
    vi.stubEnv('VITE_ENDGE_SERVICE_BACKEND_URL', 'https://backend.test')
    vi.stubEnv('VITE_ENDGE_WORKSPACE_IDENTITY', 'workspace')
    vi.stubEnv('VITE_ENDGE_FACETS', '{"organization":"acme","application":"portal","deployment":"local"}')
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@sentry.test/2')
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'local')
    vi.stubEnv('VITE_SENTRY_RELEASE', 'endge-local@1')
    mocks.executionContext = {}
    mocks.mockEnabled = false
    mocks.dataModeOverridden = false
    mocks.boot.mockReset()
    mocks.reset.mockReset()
    mocks.setDataMode.mockReset()
    mocks.setDataMode.mockImplementation((mode: 'live' | 'mock') => {
      mocks.mockEnabled = mode === 'mock'
      mocks.dataModeOverridden = true
    })
    mocks.clearDataModeOverride.mockReset()
    mocks.clearDataModeOverride.mockImplementation(() => {
      mocks.dataModeOverridden = false
    })
    mocks.readDataModeOverride.mockReset()
    mocks.readDataModeOverride.mockReturnValue(null)
    mocks.writeDataModeOverride.mockReset()
    mocks.clearStoredDataModeOverride.mockReset()
    mocks.requireActive.mockClear()
    mocks.resolveAvailable.mockClear()
    mocks.boot.mockImplementation(async (ctx: { context: Record<string, unknown> }) => {
      mocks.executionContext = { ...ctx.context }
    })
    await context.reset()
    mocks.reset.mockClear()
  })

  it('запускает начальный контекст IDE и проверяет его renderer', async () => {
    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })

    expect(mocks.boot).toHaveBeenCalledWith(expect.objectContaining({
      dataProvider: 'default',
      scope: { workspaceIdentity: 'workspace' },
      context: {
        facets: { organization: 'acme', application: 'portal', deployment: 'local' },
      },
      domainProvider,
      vars: {
        ENDPOINT_AUTH: undefined,
        SENTRY_DSN: 'http://public@sentry.test/2',
        SENTRY_ENVIRONMENT: 'local',
        SENTRY_RELEASE: 'endge-local@1',
      },
    }))
    expect(mocks.requireActive).toHaveBeenCalledWith({
      protocol: 'endge.sfc-render-adapter',
      protocolVersion: 1,
      requiredRendererKeys: [],
      requiredRootKeys: ['shell', 'sfc', 'sfc-runtime', 'filter-view'],
    })
    expect(mocks.requireActive.mock.calls[0]?.[0]).not.toHaveProperty('renderer')
  })

  /** Откатывает уже запущенный Core и разрешает повторный init после ошибки renderer contract. */
  it('откатывает Core при ошибке проверки после запуска и разрешает повторную попытку', async () => {
    mocks.requireActive.mockImplementationOnce(() => {
      throw new Error('renderer unavailable')
    })

    await expect(context.init({ backendConfig, domainProvider, workspaceRole: 'editor' }))
      .rejects
      .toThrow('renderer unavailable')

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(context.isInitialized).toBe(false)

    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })

    expect(mocks.boot).toHaveBeenCalledTimes(2)
    expect(context.isInitialized).toBe(true)
  })

  it('освобождает зарегистрированные surfaces перед перезапуском контекста фасетов', async () => {
    const beforeContextReset = vi.fn()
    const unregister = context.registerSurface('test-surface', { beforeContextReset })
    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })
    mocks.boot.mockClear()

    await context.switchContext({ facets: { organization: 'acme', application: 'mobile', deployment: 'local' } })

    expect(beforeContextReset).toHaveBeenCalledOnce()
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.boot).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        facets: { organization: 'acme', application: 'mobile', deployment: 'local' },
      }),
    }))
    unregister()
  })

  it('при reload не превращает сохранённые selections в обязательный explicit context', async () => {
    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })
    vi.stubEnv('VITE_ENDGE_FACETS', '')
    mocks.boot.mockClear()

    await context.reloadCurrentContext()

    expect(mocks.boot).toHaveBeenCalledWith(expect.objectContaining({ context: {} }))
  })

  it('возвращается к предыдущему контексту после неудачного перезапуска', async () => {
    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })
    mocks.boot.mockClear()
    mocks.boot.mockImplementation(async (ctx: { context: Record<string, unknown> }) => {
      if ((ctx.context.facets as Record<string, string> | undefined)?.application === 'broken') {
        throw new Error('boot failed')
      }
      mocks.executionContext = { ...ctx.context }
    })

    await expect(context.switchContext({
      facets: { organization: 'acme', application: 'broken', deployment: 'broken-stage' },
    })).rejects.toThrow('boot failed')

    expect(mocks.boot).toHaveBeenLastCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        facets: { organization: 'acme', application: 'portal', deployment: 'local' },
      }),
    }))
    expect(context.currentContext).toMatchObject({
      facets: { organization: 'acme', application: 'portal', deployment: 'local' },
    })
  })

  it('сохраняет переопределение Configurator вне Core и применяет его к EndgeContext_Module', () => {
    const listener = vi.fn()
    const off = context.subscribe(listener)

    context.setMockEnabled(true)

    expect(mocks.writeDataModeOverride).toHaveBeenCalledWith('https://backend.test', 'workspace', 'mock')
    expect(mocks.setDataMode).toHaveBeenCalledWith('mock')
    expect(context.isMockEnabled).toBe(true)
    expect(context.isDataModeOverridden).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it('восстанавливает ограниченное Workspace переопределение Configurator после запуска', async () => {
    mocks.readDataModeOverride.mockReturnValue('mock')

    await context.init({ backendConfig, domainProvider, workspaceRole: 'editor' })

    expect(mocks.readDataModeOverride).toHaveBeenCalledWith('https://backend.test', 'workspace')
    expect(mocks.setDataMode).toHaveBeenCalledWith('mock')
  })
})
