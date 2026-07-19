import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseRuntimePreviewHistory,
  runtimePreviewHistoryStorageKey,
} from '@/features/endge-ide/model/runtime-preview/runtime-preview-history'

const mocks = vi.hoisted(() => ({
  workspace: 'workspace-a',
  execution: {
    tenantIdentity: 'tenant-a',
    projectIdentity: 'project-a',
    environmentIdentity: 'dev',
  },
}))

vi.mock('@endge/core', () => ({
  Endge: {
    context: {
      getCurrentWorkspace: () => mocks.workspace,
      getExecutionContext: () => ({ ...mocks.execution }),
    },
  },
}))

describe('runtime Preview history', () => {
  beforeEach(() => {
    mocks.workspace = 'workspace-a'
    mocks.execution = {
      tenantIdentity: 'tenant-a',
      projectIdentity: 'project-a',
      environmentIdentity: 'dev',
    }
  })

  it('keeps only valid unique runtime targets in their original order', () => {
    expect(parseRuntimePreviewHistory({
      version: 1,
      targets: [
        { entityType: 'composition', identity: 'entry' },
        { entityType: 'store', identity: ' flights ' },
        { entityType: 'composition', identity: 'entry' },
        { entityType: 'query', identity: 'ignored' },
        { entityType: 'store', identity: '' },
      ],
    })).toEqual([
      { entityType: 'composition', identity: 'entry' },
      { entityType: 'store', identity: 'flights' },
    ])
  })

  it('scopes history by workspace and structural execution context', () => {
    const first = runtimePreviewHistoryStorageKey()
    mocks.execution.projectIdentity = 'project-b'
    const second = runtimePreviewHistoryStorageKey()

    expect(first).toContain('workspace-a')
    expect(first).toContain('project-a')
    expect(second).toContain('project-b')
    expect(second).not.toBe(first)
  })
})
