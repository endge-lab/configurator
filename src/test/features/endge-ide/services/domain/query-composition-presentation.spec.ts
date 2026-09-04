import { describe, expect, it } from 'vitest'

import {
  isQueryComposition,
  QUERY_COMPOSITION_ROLE,
  setQueryCompositionRole,
} from '../../../../../features/endge-ide/services/domain/query-composition-presentation'

describe('представление query Composition', () => {
  it('добавляет role без потери пользовательских метаданных', () => {
    const meta = setQueryCompositionRole({ owner: 'aodb', endge: { pinned: true } }, true)

    expect(meta).toEqual({
      owner: 'aodb',
      endge: { pinned: true, role: QUERY_COMPOSITION_ROLE },
    })
    expect(isQueryComposition({ meta })).toBe(true)
  })

  it('удаляет только role и сохраняет остальной namespace', () => {
    const meta = setQueryCompositionRole({
      owner: 'aodb',
      endge: { pinned: true, role: QUERY_COMPOSITION_ROLE },
    }, false)

    expect(meta).toEqual({ owner: 'aodb', endge: { pinned: true } })
    expect(isQueryComposition({ meta })).toBe(false)
  })
})
