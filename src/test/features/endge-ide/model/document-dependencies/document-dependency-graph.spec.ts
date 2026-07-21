import type { ProgramArtifact } from '@endge/core'

import { Endge, RMock, RStore } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildDocumentDependencyHierarchy,
  buildDocumentDependencyTree,
} from '@/features/endge-ide/model/document-dependencies/document-dependency-graph'

describe('document dependency graph', () => {
  afterEach(() => {
    Endge.program.clear()
    Endge.domain.reset()
    Endge.mock.reset()
  })

  it('uses live Store source as the current-tab dependency overlay', () => {
    addMock('persisted-mock', 101)
    addMock('draft-mock', 102)
    const store = addStore('flight-store', 'persisted-mock')
    addStoreArtifact(store, 'persisted-mock')

    const result = buildDocumentDependencyTree({
      documentType: 'store',
      id: store.id,
      identity: store.identity,
      displayName: store.name,
      source: storeSource('draft-mock'),
    })

    expect(result.status).toBe('valid')
    expect(result.root?.children).toHaveLength(1)
    expect(result.root?.children[0]).toMatchObject({
      identity: 'draft-mock',
      documentType: 'mock',
      relationRole: 'store-initial:raw',
    })
  })

  it('builds reverse usage from compiled Program dependencies', () => {
    const mock = addMock('groundhandling', 201)
    const store = addStore('groundhandling-store', mock.identity)
    addStoreArtifact(store, mock.identity)

    const result = buildDocumentDependencyHierarchy({
      documentType: 'mock',
      id: mock.id,
      identity: mock.identity,
      displayName: mock.name,
    })

    expect(result.root?.children[0]).toMatchObject({
      kind: 'group',
      title: 'Используется в',
    })
    expect(result.root?.children[0]?.children[0]).toMatchObject({
      identity: 'groundhandling-store',
      documentType: 'store',
      relationRole: 'store-initial:raw',
    })
  })

  it('keeps the root and reverse graph available when draft compilation fails', () => {
    const store = addStore('broken-store', 'missing-mock')

    const result = buildDocumentDependencyHierarchy({
      documentType: 'store',
      id: store.id,
      identity: store.identity,
      source: 'defineStore({',
    })

    expect(result.status).toBe('compile-error')
    expect(result.root).not.toBeNull()
    expect(result.root?.status).toBe('compile-error')
    expect(result.root?.children.map(node => node.title)).toEqual([
      'Используется в',
      'Зависимости',
    ])
  })
})

function addMock(identity: string, id: number): RMock {
  const mock = new RMock()
  mock.id = id
  mock.identity = identity
  mock.name = identity
  mock.displayName = identity
  Endge.domain.addMock(mock)
  return mock
}

function addStore(identity: string, mockIdentity: string): RStore {
  const store = new RStore()
  store.id = 300 + identity.length
  store.identity = identity
  store.name = identity
  store.displayName = identity
  store.source = storeSource(mockIdentity)
  Endge.domain.addStore(store)
  return store
}

function storeSource(mockIdentity: string): string {
  return `defineStore({ data: { raw: value(mock('${mockIdentity}')) } })`
}

function addStoreArtifact(store: RStore, mockIdentity: string): void {
  const artifact: ProgramArtifact = {
    ref: { entityType: 'store', id: store.id, identity: store.identity },
    sourceHash: 'test-store',
    compilerVersion: 'test',
    status: 'valid',
    diagnostics: [],
    dependencies: [{
      entityType: 'mock-data',
      id: mockIdentity,
      identity: mockIdentity,
      role: 'store-initial:raw',
    }],
    capabilities: ['compilable'],
    metadata: { self: {}, nodes: [] },
    payload: {},
  }
  Endge.program.addArtifact(artifact)
}
