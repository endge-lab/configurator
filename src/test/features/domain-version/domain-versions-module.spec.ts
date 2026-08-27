import type { DomainStatus } from '@/features/domain-version/domain/types/domain-version.type'
import type { DomainVersionHttp_Adapter } from '@/features/domain-version/model/adapters/DomainVersionHttp_Adapter'

import { describe, expect, it, vi } from 'vitest'

import { DomainVersionServiceError } from '@/features/domain-version/model/adapters/DomainVersionHttp_Adapter'
import { DomainVersions_Module } from '@/features/domain-version/model/DomainVersions_Module'

const target = { backendURL: 'https://test.example.com', workspace: 'default' }

describe('domain versions module', () => {
  it('stores a clean domain version for one backend and workspace target', async () => {
    const value: DomainStatus = {
      workspace: 'default',
      state: 'clean',
      domainVersion: 'dv1:sha256:abc',
      lastCommittedDomainVersion: 'dv1:sha256:abc',
      commitId: 'commit-id',
      commitMessage: 'Ready',
      committedAt: '2026-08-18T00:00:00Z',
      pendingRevisionCount: 0,
    }
    const get = vi.fn().mockResolvedValue(value)
    const module = new DomainVersions_Module({ get } as unknown as DomainVersionHttp_Adapter)

    await module.refresh(target)

    expect(module.state(target)).toMatchObject({ status: 'ready', value })
    expect(get).toHaveBeenCalledOnce()
  })

  it('keeps dirty state without presenting a current domain version', async () => {
    const get = vi.fn().mockResolvedValue({
      workspace: 'default',
      state: 'dirty',
      lastCommittedDomainVersion: 'dv1:sha256:previous',
      commitId: 'commit-id',
      commitMessage: 'Previous',
      committedAt: '2026-08-18T00:00:00Z',
      pendingRevisionCount: 3,
    } satisfies DomainStatus)
    const module = new DomainVersions_Module({ get } as unknown as DomainVersionHttp_Adapter)

    await module.refresh(target)

    expect(module.state(target)).toMatchObject({
      status: 'ready',
      value: { state: 'dirty', pendingRevisionCount: 3 },
    })
    expect((module.state(target) as { value: DomainStatus }).value).not.toHaveProperty('domainVersion')
  })

  it('keeps authentication failures local to the unavailable target', async () => {
    const get = vi.fn().mockRejectedValue(new DomainVersionServiceError('unauthorized', 'Login required', 401))
    const module = new DomainVersions_Module({ get } as unknown as DomainVersionHttp_Adapter)

    await module.refresh(target)

    expect(module.state(target)).toMatchObject({ status: 'error', code: 'unauthorized' })
    expect(module.state({ ...target, workspace: 'other' })).toEqual({ status: 'idle' })
  })
})
