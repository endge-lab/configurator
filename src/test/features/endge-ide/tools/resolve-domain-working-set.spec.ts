import type { DomainWorkingSetRef } from '@/features/endge-ide/domain/types/domain-working-set.type'

import { describe, expect, it } from 'vitest'

import {
  getDomainWorkingSetRefKey,
  resolveDomainWorkingSet,
} from '@/features/endge-ide/tools/resolve-domain-working-set'

function ref(entityType: string, identity: string): DomainWorkingSetRef {
  return { entityType, id: identity, identity }
}

describe('разрешение рабочего набора домена', () => {
  it('следует только по исходящим зависимостям и не включает других потребителей', () => {
    const compositionA = ref('composition', 'composition-a')
    const compositionB = ref('composition', 'composition-b')
    const dataView = ref('data-view', 'schedule-view')
    const store = ref('store', 'schedule-store')
    const edges = new Map([
      [getDomainWorkingSetRefKey(compositionA), [dataView]],
      [getDomainWorkingSetRefKey(compositionB), [dataView]],
      [getDomainWorkingSetRefKey(dataView), [store]],
    ])

    const result = resolveDomainWorkingSet([compositionA], {
      dependenciesOf: source => edges.get(getDomainWorkingSetRefKey(source)) ?? [],
    })

    expect([...result.members.keys()]).toEqual([
      'composition:composition-a',
      'data-view:schedule-view',
      'store:schedule-store',
    ])
    expect(result.members.has('composition:composition-b')).toBe(false)
  })

  it('добавляет цепочку owner как контекст без раскрытия зависимостей owner', () => {
    const composition = ref('composition', 'owned-composition')
    const owner = ref('owner', 'schedule-owner')
    const parentOwner = ref('owner-group', 'main-owner-group')
    const unrelated = ref('composition', 'unrelated-composition')

    const result = resolveDomainWorkingSet([composition], {
      dependenciesOf: source => source.entityType === 'owner' ? [unrelated] : [],
      ownerOf: (source) => {
        if (source.entityType === 'composition') {
          return owner
        }
        if (source.entityType === 'owner') {
          return parentOwner
        }
        return null
      },
    })

    expect(result.members.get('owner:schedule-owner')?.role).toBe('context')
    expect(result.members.get('owner-group:main-owner-group')?.role).toBe('context')
    expect(result.members.has('composition:unrelated-composition')).toBe(false)
  })

  it('дедублицирует общие зависимости нескольких корней и останавливает циклы', () => {
    const rootA = ref('composition', 'a')
    const rootB = ref('composition', 'b')
    const shared = ref('data-view', 'shared')
    const edges = new Map([
      [getDomainWorkingSetRefKey(rootA), [shared]],
      [getDomainWorkingSetRefKey(rootB), [shared]],
      [getDomainWorkingSetRefKey(shared), [rootA]],
    ])

    const result = resolveDomainWorkingSet([rootA, rootB], {
      dependenciesOf: source => edges.get(getDomainWorkingSetRefKey(source)) ?? [],
    })

    expect(result.members.size).toBe(3)
    expect(result.members.get('data-view:shared')).toMatchObject({
      role: 'dependency',
      depth: 1,
    })
  })
})
