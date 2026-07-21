import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'

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
  requireActive: vi.fn((_requirement?: Record<string, unknown>) => ({ id: 'vue-shadcn' })),
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
      adapters: { requireActive: mocks.requireActive },
    },
    workspace: {
      current: { identity: 'workspace' },
      defaultSfcAdapterId: 'vue-shadcn',
    },
  },
}))

vi.mock('@/features/endge-ide/model/context/configurator-data-mode-repository', () => ({
  configuratorDataModeRepository: {
    read: mocks.readDataModeOverride,
    write: mocks.writeDataModeOverride,
    clear: mocks.clearStoredDataModeOverride,
  },
}))

describe('endgeIDE context', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_PAYLOAD_BASE_URL', 'https://payload.test')
    vi.stubEnv('VITE_PAYLOAD_SECRET', 'secret')
    vi.stubEnv('VITE_ENDGE_WORKSPACE_IDENTITY', 'workspace')
    vi.stubEnv('VITE_ENDGE_TENANT_IDENTITY', 'tenant')
    vi.stubEnv('VITE_ENDGE_PROJECT_IDENTITY', 'project')
    vi.stubEnv('VITE_ENDGE_ENVIRONMENT_IDENTITY', 'dev')
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
    mocks.boot.mockImplementation(async (ctx: { context: Record<string, unknown> }) => {
      mocks.executionContext = { ...ctx.context }
    })
    await EndgeIDEContext.reset()
    mocks.reset.mockClear()
  })

  it('boots the initial IDE context and validates its renderer', async () => {
    await EndgeIDEContext.init()

    expect(mocks.boot).toHaveBeenCalledWith(expect.objectContaining({
      dataProvider: 'payload',
      scope: { workspaceIdentity: 'workspace' },
      context: {
        tenantIdentity: 'tenant',
        projectIdentity: 'project',
        environmentIdentity: 'dev',
      },
      payload: {
        baseAPI: 'https://payload.test',
        secret: 'secret',
      },
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

  it('disposes registered surfaces before a project context reboot', async () => {
    const beforeContextReset = vi.fn()
    const unregister = EndgeIDEContext.registerSurface('test-surface', { beforeContextReset })
    await EndgeIDEContext.init()
    mocks.boot.mockClear()

    await EndgeIDEContext.switchContext({ projectIdentity: 'next-project' })

    expect(beforeContextReset).toHaveBeenCalledOnce()
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.boot).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        projectIdentity: 'next-project',
        environmentIdentity: undefined,
      }),
    }))
    unregister()
  })

  it('rolls back to the previous context after a failed reboot', async () => {
    await EndgeIDEContext.init()
    mocks.boot.mockClear()
    mocks.boot.mockImplementation(async (ctx: { context: Record<string, unknown> }) => {
      if (ctx.context.projectIdentity === 'broken') {
        throw new Error('boot failed')
      }
      mocks.executionContext = { ...ctx.context }
    })

    await expect(EndgeIDEContext.switchContext({
      projectIdentity: 'broken',
      environmentIdentity: 'broken-env',
    })).rejects.toThrow('boot failed')

    expect(mocks.boot).toHaveBeenLastCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        projectIdentity: 'project',
        environmentIdentity: 'dev',
      }),
    }))
    expect(EndgeIDEContext.currentContext).toMatchObject({
      projectIdentity: 'project',
      environmentIdentity: 'dev',
    })
  })

  it('persists the Configurator override outside Core and applies it to EndgeContext', () => {
    const listener = vi.fn()
    const off = EndgeIDEContext.subscribe(listener)

    EndgeIDEContext.setMockEnabled(true)

    expect(mocks.writeDataModeOverride).toHaveBeenCalledWith('workspace', 'mock')
    expect(mocks.setDataMode).toHaveBeenCalledWith('mock')
    expect(EndgeIDEContext.isMockEnabled).toBe(true)
    expect(EndgeIDEContext.isDataModeOverridden).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it('restores the Workspace-scoped Configurator override after boot', async () => {
    mocks.readDataModeOverride.mockReturnValue('mock')

    await EndgeIDEContext.init()

    expect(mocks.readDataModeOverride).toHaveBeenCalledWith('workspace')
    expect(mocks.setDataMode).toHaveBeenCalledWith('mock')
  })
})
