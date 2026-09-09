import { describe, expect, it } from 'vitest'

import { resolveCompositionCreatePlacement } from '@/features/endge-ide/services/domain/composition-create'

describe('определение места создания Composition', () => {
  it('сохраняет значения query и library по умолчанию при отсутствии owner', () => {
    expect(resolveCompositionCreatePlacement({ queryComposition: true }))
      .toEqual({ kind: 'query', kindIdentity: null })
    expect(resolveCompositionCreatePlacement())
      .toEqual({ kind: 'library', kindIdentity: null })
  })
})
