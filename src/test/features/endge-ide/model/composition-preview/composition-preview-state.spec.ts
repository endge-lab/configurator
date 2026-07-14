import { Endge, RComposition, RQuery } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import { ensureCompositionRuntimeArtifacts } from '../../../../../features/endge-ide/model/composition-preview/composition-preview-state'

describe('Composition preview artifacts', () => {
  afterEach(() => {
    Endge.program.clear()
    Endge.domain.reset()
  })

  it('builds nested Composition dependencies before the preview owner', () => {
    const query = new RQuery()
    query.id = 1
    query.identity = 'groundhandling-query'
    query.name = 'Ground handling query'
    query.sourceVersion = 2
    query.source = `
defineQuery({
  kind: 'rest',
  request: {
    endpoint: 'https://example.test',
    path: '/groundhandling',
    method: 'POST',
  },
  outputs: {
    raw: output().from(response()),
  },
})
`

    const child = new RComposition()
    child.id = 2
    child.identity = 'groundhandling-default'
    child.name = 'Ground handling requests'
    child.source = `
defineComposition({
  runtimes: {
    query: query('groundhandling-query'),
  },
  outputs: {
    rows: output().fromRuntime('query').select('raw'),
  },
})
`

    Endge.domain.addQuery(query)
    Endge.domain.addComposition(child)

    ensureCompositionRuntimeArtifacts(`
defineComposition({
  runtimes: {
    requests: composition('groundhandling-default'),
  },
})
`, new Set(['groundhandling-page']))

    expect(Endge.program.getQueryArtifact('groundhandling-query')?.status).toBe('valid')
    expect(Endge.program.getCompositionArtifact('groundhandling-default')?.status).toBe('valid')
  })
})
