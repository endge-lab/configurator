import { describe, expect, it, vi } from 'vitest'

import { RuntimePreviewInstance } from '@/features/endge-ide/model/runtime-preview/runtime-preview-instance'

vi.mock('@endge/core', () => ({
  Endge: {},
  RComponentSFC: {},
}))
vi.mock('@endge/ui-vue', () => ({ materializeEndgeCSSForDOM: vi.fn() }))
vi.mock('@/features/endge-ide/model/runtime-preview/runtime-preview-tree-builder', () => ({
  buildRuntimePreviewTree: () => [{
    id: 'composition:entry',
    parentId: null,
    kind: 'composition',
    title: 'Entry',
    subtitle: null,
    entityType: 'composition',
    identity: 'entry',
    presentation: null,
    activationMode: 'startup',
    composition: { rootIdentity: 'entry', invocationPath: [] },
    runtimePath: null,
    scopePath: null,
    resourcePath: null,
    renderable: false,
    children: [{
      id: 'composition:entry:runtime:table',
      parentId: 'composition:entry',
      kind: 'runtime',
      title: 'Table',
      subtitle: null,
      entityType: 'component-sfc',
      identity: 'table',
      presentation: null,
      activationMode: 'manual',
      composition: { rootIdentity: 'entry', invocationPath: [] },
      runtimePath: 'table',
      scopePath: 'scope_default',
      resourcePath: null,
      renderable: true,
      children: [],
    }],
  }],
}))
vi.mock('@/features/endge-ide/model/composition-preview/composition-preview-state', () => ({
  createPreviewComposition: vi.fn(),
  ensureCompositionRuntimeArtifacts: vi.fn(),
  resolvePreviewStoreRuntimes: vi.fn(),
}))
vi.mock('@/features/endge-ide/model/preview-runtime/component-preview-runtime', () => ({
  destroyComponentPreviewContext: vi.fn(),
  prepareComponentPreviewContext: vi.fn(),
  resolveComponentPreviewInput: vi.fn(),
}))
vi.mock('@/features/endge-ide/model/sfc-preview/sfc-preview-state', () => ({
  createPreviewArtifact: vi.fn(),
  ensurePreviewPortArtifacts: vi.fn(),
}))
vi.mock('@/features/endge-ide/model/store-preview/store-preview-state', () => ({
  createPreviewStore: vi.fn(),
  createPreviewStoreArtifact: vi.fn(),
}))

describe('runtime Preview inactive entry', () => {
  it('allows selecting a remembered child without activating its runtime', async () => {
    const instance = new RuntimePreviewInstance({ entityType: 'composition', identity: 'entry' })

    await instance.select('composition:entry:runtime:table')

    expect(instance.selectedNodeId.value).toBe('composition:entry:runtime:table')
    expect(instance.status.value).toBe('inactive')
    expect(instance.error.value).toBeNull()
    expect(instance.renderables.value).toEqual([])
  })
})
