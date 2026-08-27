import type { ProgramArtifact, VocabProgramPayload } from '@endge/core'

import { Endge, RMock, RVocabs } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  commitVocabMockGeneration,
  prepareVocabMockGeneration,
} from '@/features/endge-ide/model/vocab-mock/vocab-mock-generator'

describe('vocab Mock generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Endge.domain.reset()
    Endge.program.clear()
    Endge.mock.reset()
  })

  it('preloads every provider Vocab and preserves unrelated Mock keys', async () => {
    const airlines = vocab(1, 'airlines')
    const stations = vocab(2, 'stations')
    Endge.domain.addVocab(airlines)
    Endge.domain.addVocab(stations)
    const existing = new RMock()
    existing.id = 5
    existing.identity = 'fixtures'
    existing.name = existing.identity
    existing.displayName = existing.identity
    existing.source = JSON.stringify({ untouched: { value: true }, airlines: [{ stale: true }] })
    Endge.domain.addMock(existing)

    vi.spyOn(Endge.compiler, 'buildVocab').mockImplementation(entity => artifact(entity))
    const load = vi.spyOn(Endge.vocabs, 'loadRawVocab').mockImplementation(async identity => (
      String(identity) === 'airlines'
        ? Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }))
        : [{ id: 'LED' }]
    ))

    const prepared = await prepareVocabMockGeneration('fixtures')

    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledWith('airlines', { limit: 10, throwOnError: true })
    expect(prepared.overwrittenKeys).toEqual(['airlines'])
    expect(prepared.document).toMatchObject({
      untouched: { value: true },
      stations: [{ id: 'LED' }],
    })
    expect(prepared.document.airlines).toHaveLength(10)
  })

  it('writes Mock before patching Vocab documents', async () => {
    const airlines = vocab(1, 'airlines')
    const stations = vocab(2, 'stations')
    const mock = new RMock()
    mock.id = 5
    mock.identity = 'fixtures'
    mock.name = mock.identity
    mock.displayName = mock.identity
    const calls: string[] = []
    vi.spyOn(Endge.domainRepository, 'saveDocument').mockImplementation(async (identity, type) => {
      calls.push(`${type}:${identity}`)
      return {} as never
    })

    const result = await commitVocabMockGeneration({
      targetIdentity: 'fixtures',
      existingMock: mock,
      document: { airlines: [], stations: [] },
      vocabs: [airlines, stations],
      overwrittenKeys: [],
    })

    expect(calls).toEqual(['mock:fixtures', 'vocabs:airlines', 'vocabs:stations'])
    expect(airlines.source).toContain(`mock: mock('fixtures').path('airlines')`)
    expect(stations.source).toContain(`mock: mock('fixtures').path('stations')`)
    expect(result.savedVocabs).toEqual(['airlines', 'stations'])
  })
})

function vocab(id: number, identity: string): RVocabs {
  const value = new RVocabs()
  value.id = id
  value.identity = identity
  value.name = identity
  value.displayName = identity
  value.source = `defineVocab({
  provider: payload({ baseUrl: 'https://payload.example', collection: '${identity}', auth: { mode: 'none' } }),
  outputs: { items: output().from(response()) },
})`
  return value
}

function artifact(value: RVocabs): ProgramArtifact<VocabProgramPayload> {
  const compiled = Endge.source.compile('vocab', value.source)
  if (!compiled.artifact) {
    throw new Error('Test Vocab did not compile.')
  }
  return {
    ref: { entityType: 'vocab', id: value.id, identity: value.identity },
    sourceHash: 'test',
    compilerVersion: 'test',
    status: 'valid',
    diagnostics: [],
    dependencies: [],
    capabilities: ['compilable', 'runnable', 'data-provider'],
    metadata: { self: {}, nodes: [] },
    payload: compiled.artifact,
  }
}
