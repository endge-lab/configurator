import type { REntity } from '@endge/core'
import type { ClassConstructor } from 'class-transformer'

import { RComposition, RConverter, RQuery, RStore } from '@endge/core'
import { Serialize } from '@endge/utils'
import { describe, expect, it } from 'vitest'

describe('endge runtime singleton resolution', () => {
  it.each([
    ['query', RQuery],
    ['store', RStore],
    ['composition', RComposition],
    ['converter', RConverter],
  ] as const)('keeps decorated base fields while deserializing %s documents', (_kind, Entity) => {
    const document = Serialize.fromJSON(Entity as ClassConstructor<REntity>, {
      id: 17,
      identity: 'ground-handling',
      name: 'Ground handling',
      displayName: 'Ground handling',
    })

    expect(document).toMatchObject({
      id: 17,
      identity: 'ground-handling',
      name: 'Ground handling',
      displayName: 'Ground handling',
    })
  })
})
