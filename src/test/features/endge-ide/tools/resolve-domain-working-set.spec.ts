import type { DomainWorkingSetRef } from '@/features/endge-ide/domain/types/domain-working-set.type'

import { describe, expect, it } from 'vitest'

import {
  getDomainWorkingSetRefKey,
  resolveDomainWorkingSet,
} from '@/features/endge-ide/tools/resolve-domain-working-set'

function ref(entityType: string, identity: string): DomainWorkingSetRef {
  return { entityType, id: identity, identity }
}

describe('resolveDomainWorkingSet', () => {
  it('follows only outgoing dependencies and does not include other consumers', () => {
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

  it('adds the owner chain as context without expanding owner dependencies', () => {
    const composition = ref('composition', 'project-composition')
    const project = ref('project', 'schedule-project')
    const tenant = ref('tenant', 'main-tenant')
    const unrelated = ref('composition', 'unrelated-composition')

    const result = resolveDomainWorkingSet([composition], {
      dependenciesOf: source => source.entityType === 'project' ? [unrelated] : [],
      ownerOf: (source) => {
        if (source.entityType === 'composition') {
          return project
        }
        if (source.entityType === 'project') {
          return tenant
        }
        return null
      },
    })

    expect(result.members.get('project:schedule-project')?.role).toBe('context')
    expect(result.members.get('tenant:main-tenant')?.role).toBe('context')
    expect(result.members.has('composition:unrelated-composition')).toBe(false)
  })

  it('deduplicates shared dependencies across multiple roots and stops cycles', () => {
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
