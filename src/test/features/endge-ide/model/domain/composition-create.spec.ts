import { describe, expect, it } from 'vitest'

import { resolveCompositionCreatePlacement } from '@/features/endge-ide/model/domain/composition-create'

describe('resolveCompositionCreatePlacement', () => {
  it('creates a project-owned Composition with the project identity', () => {
    expect(resolveCompositionCreatePlacement({
      owner: {
        kind: 'project',
        identity: ' project-dev ',
      },
    })).toEqual({
      kind: 'project',
      kindIdentity: 'project-dev',
    })
  })

  it('keeps query and library defaults when there is no owner', () => {
    expect(resolveCompositionCreatePlacement({ queryComposition: true }))
      .toEqual({ kind: 'query', kindIdentity: null })
    expect(resolveCompositionCreatePlacement())
      .toEqual({ kind: 'library', kindIdentity: null })
  })

  it('rejects an empty owner identity', () => {
    expect(() => resolveCompositionCreatePlacement({
      owner: { kind: 'project', identity: '   ' },
    })).toThrow('Composition owner identity is required.')
  })
})
