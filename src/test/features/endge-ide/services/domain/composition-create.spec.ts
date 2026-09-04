import { describe, expect, it } from 'vitest'

import { resolveCompositionCreatePlacement } from '@/features/endge-ide/services/domain/composition-create'

describe('определение места создания Composition', () => {
  it('создаёт принадлежащую проекту Composition с identity проекта', () => {
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

  it('сохраняет значения query и library по умолчанию при отсутствии owner', () => {
    expect(resolveCompositionCreatePlacement({ queryComposition: true }))
      .toEqual({ kind: 'query', kindIdentity: null })
    expect(resolveCompositionCreatePlacement())
      .toEqual({ kind: 'library', kindIdentity: null })
  })

  it('отклоняет пустой identity owner', () => {
    expect(() => resolveCompositionCreatePlacement({
      owner: { kind: 'project', identity: '   ' },
    })).toThrow('Composition owner identity is required.')
  })
})
