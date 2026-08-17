import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearConfiguratorBrowserState,
  clearConfiguratorLoginRedirectGuard,
  ConfiguratorSession_Module,
  ConfiguratorSession_Service,
  startConfiguratorLogin,
} from '@/features/configurator-session'
import { CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY_PREFIX } from '@/features/configurator-session/model/config/configurator-session'

const BACKEND_URL = 'https://backend.test'
const CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY
  = `${CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY_PREFIX}:${encodeURIComponent(BACKEND_URL)}`

function sessionResponse(): Response {
  return new Response(JSON.stringify({
    user: {
      id: 'developer-id',
      providerId: 'keycloak',
      subject: 'developer-subject',
      issuer: 'https://identity.test/realms/endge',
      username: 'developer',
      displayName: 'Developer',
      active: true,
      ignoredClaim: 'must-not-leak',
    },
    platformAdmin: false,
    workspaces: [{
      id: 'workspace-id',
      identity: 'workspace-a',
      displayName: 'Workspace A',
      active: true,
      role: 'editor',
      configuration: { mustNotLeak: true },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installWindow(): { assign: ReturnType<typeof vi.fn>, storage: Map<string, string> } {
  const storage = new Map<string, string>()
  const assign = vi.fn()
  vi.stubGlobal('window', {
    location: {
      origin: 'https://configurator.test',
      href: 'https://configurator.test/editor?project=demo',
      assign,
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  return { assign, storage }
}

describe('configurator developer session', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses one credentialed session request and keeps only the safe projection', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse())
    vi.stubGlobal('fetch', fetchMock)
    const module = new ConfiguratorSession_Module(
      new ConfiguratorSession_Service('https://backend.test/'),
    )

    const [left, right] = await Promise.all([module.check(), module.check()])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://backend.test/auth/session', expect.objectContaining({
      credentials: 'include',
    }))
    expect(left).toEqual(right)
    expect(module.state).toEqual({
      status: 'authenticated',
      session: {
        developer: {
          id: 'developer-id',
          providerId: 'keycloak',
          subject: 'developer-subject',
          issuer: 'https://identity.test/realms/endge',
          username: 'developer',
          displayName: 'Developer',
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
      },
    })
  })

  it('builds returnTo once and stops a redirect loop for two minutes', () => {
    const { assign } = installWindow()

    expect(startConfiguratorLogin('https://backend.test/auth/login', BACKEND_URL)).toEqual({ redirected: true })
    expect(assign).toHaveBeenCalledOnce()
    const target = new URL(assign.mock.calls[0]![0])
    expect(target.searchParams.get('returnTo')).toBe('https://configurator.test/editor?project=demo')

    expect(startConfiguratorLogin('https://backend.test/auth/login', BACKEND_URL)).toMatchObject({
      redirected: false,
      code: 'auth_redirect_loop',
    })
    expect(assign).toHaveBeenCalledOnce()
  })

  it('clears the redirect marker after a successful session check', () => {
    const { storage } = installWindow()
    storage.set(CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY, String(Date.now()))

    clearConfiguratorLoginRedirectGuard(BACKEND_URL)

    expect(storage.has(CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY)).toBe(false)
  })

  it('posts logout with credentials and clears module state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const module = new ConfiguratorSession_Module(
      new ConfiguratorSession_Service('https://backend.test'),
    )
    await module.check()

    await module.logout()

    expect(fetchMock).toHaveBeenLastCalledWith('https://backend.test/auth/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(module.state).toEqual({ status: 'idle' })
  })

  it('clears Configurator browser storage during forced logout', () => {
    const localStorageClear = vi.fn()
    const sessionStorageClear = vi.fn()
    vi.stubGlobal('window', {
      localStorage: { clear: localStorageClear },
      sessionStorage: { clear: sessionStorageClear },
    })

    clearConfiguratorBrowserState()

    expect(localStorageClear).toHaveBeenCalledOnce()
    expect(sessionStorageClear).toHaveBeenCalledOnce()
  })
})
