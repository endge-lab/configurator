import { beforeEach, describe, expect, it, vi } from 'vitest'

import { collectRuntimePreviewAuthProfiles } from '@/features/endge-ide/services/runtime-preview/runtime-preview-auth'

const mocks = vi.hoisted(() => ({
  mockMode: false,
  artifacts: new Map<string, any>(),
  profiles: new Map<string, any>(),
  defaultProfile: null as any,
}))

vi.mock('@endge/core', () => ({
  Endge: {
    context: {
      get isMockEnabled() { return mocks.mockMode },
    },
    domain: { getCompositions: () => [] },
    program: { getArtifact: (type: string, identity: string) => mocks.artifacts.get(`${type}:${identity}`) ?? null },
    auth: {
      profiles: {
        getDefault: () => mocks.defaultProfile,
        requireActive: (identity: string) => mocks.profiles.get(identity),
      },
    },
  },
}))

describe('runtime Preview auth preflight', () => {
  beforeEach(() => {
    mocks.mockMode = false
    mocks.artifacts.clear()
    mocks.profiles.clear()
    mocks.defaultProfile = profile('default-auth')
    mocks.profiles.set('default-auth', mocks.defaultProfile)
    mocks.profiles.set('service-auth', profile('service-auth'))
  })

  it('collects auth profiles in mock preview for a non-blocking warning', () => {
    mocks.mockMode = true
    mocks.artifacts.set('composition:root', artifact('composition', [dependency('query', 'inherited')]))
    mocks.artifacts.set('query:inherited', artifact('query', [], { auth: { mode: 'inherit' } }))

    expect(collectRuntimePreviewAuthProfiles({ entityType: 'composition', identity: 'root' }))
      .toEqual([mocks.defaultProfile])
  })

  it('collects inherited and explicit Query profiles from the program graph', () => {
    mocks.artifacts.set('composition:root', artifact('composition', [dependency('query', 'inherited'), dependency('query', 'explicit')]))
    mocks.artifacts.set('query:inherited', artifact('query', [], { auth: { mode: 'inherit' } }))
    mocks.artifacts.set('query:explicit', artifact('query', [], { auth: { mode: 'profile', profile: 'service-auth' } }))

    expect(collectRuntimePreviewAuthProfiles({ entityType: 'composition', identity: 'root' }).map(item => item.identity))
      .toEqual(['default-auth', 'service-auth'])
  })
})

function profile(identity: string): any {
  return { id: identity, identity, displayName: identity, adapterId: 'oidc', config: {}, credentials: {}, session: { storage: 'memory', persistRefreshToken: false }, active: true }
}

function dependency(entityType: string, identity: string): any {
  return { entityType, identity }
}

function artifact(entityType: string, dependencies: any[], payload: Record<string, unknown> = {}): any {
  return { status: 'valid', entityType, identity: entityType, dependencies, payload }
}
