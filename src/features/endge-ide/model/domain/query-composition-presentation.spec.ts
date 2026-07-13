import { describe, expect, it } from 'vitest'

import {
  isQueryComposition,
  QUERY_COMPOSITION_ROLE,
  setQueryCompositionRole,
} from './query-composition-presentation'

describe('query Composition presentation', () => {
  it('adds the role without losing user metadata', () => {
    const meta = setQueryCompositionRole({ owner: 'aodb', endge: { pinned: true } }, true)

    expect(meta).toEqual({
      owner: 'aodb',
      endge: { pinned: true, role: QUERY_COMPOSITION_ROLE },
    })
    expect(isQueryComposition({ meta })).toBe(true)
  })

  it('removes only the role and keeps the remaining namespace', () => {
    const meta = setQueryCompositionRole({
      owner: 'aodb',
      endge: { pinned: true, role: QUERY_COMPOSITION_ROLE },
    }, false)

    expect(meta).toEqual({ owner: 'aodb', endge: { pinned: true } })
    expect(isQueryComposition({ meta })).toBe(false)
  })
})
