import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseRuntimePreviewHistory,
  runtimePreviewHistoryStorageKey,
} from '@/features/endge-ide/services/runtime-preview/runtime-preview-history'

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

describe('история Runtime Preview', () => {
  beforeEach(() => {
    mocks.workspace = 'workspace-a'
    mocks.execution = {
      tenantIdentity: 'tenant-a',
      projectIdentity: 'project-a',
      environmentIdentity: 'dev',
    }
  })

  it('сохраняет только валидные уникальные цели runtime в исходном порядке', () => {
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

  it('разделяет историю по Workspace и структурному контексту выполнения', () => {
    const first = runtimePreviewHistoryStorageKey()
    mocks.execution.projectIdentity = 'project-b'
    const second = runtimePreviewHistoryStorageKey()

    expect(first).toContain('workspace-a')
    expect(first).toContain('project-a')
    expect(second).toContain('project-b')
    expect(second).not.toBe(first)
  })
})
