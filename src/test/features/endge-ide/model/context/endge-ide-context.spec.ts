import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'

const mocks = vi.hoisted(() => ({
  executionContext: {} as Record<string, unknown>,
  boot: vi.fn(),
  reset: vi.fn(),
  requireActive: vi.fn(() => ({ id: 'vue-shadcn' })),
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
    },
    mock: {
      listProviders: () => [],
      registerProvider: vi.fn(),
    },
    uiRegistry: {
      adapters: { requireActive: mocks.requireActive },
    },
    workspace: {
      defaultSfcAdapterId: 'vue-shadcn',
    },
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
    mocks.executionContext = {}
    mocks.boot.mockReset()
    mocks.reset.mockReset()
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
    }))
    expect(mocks.requireActive).toHaveBeenCalledOnce()
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
})
