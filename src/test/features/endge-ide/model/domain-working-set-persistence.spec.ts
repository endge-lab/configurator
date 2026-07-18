import { describe, expect, it } from 'vitest'

import { restoreDomainWorkingSetFilter } from '@/features/endge-ide/model/domain-working-set/domain-working-set-persistence'

describe('restoreDomainWorkingSetFilter', () => {
  const available = [
    { entityType: 'composition', id: 41, identity: 'schedule-composition' },
    { entityType: 'data-view', id: 42, identity: 'schedule-view' },
  ]

  it('restores enabled roots by stable identity when database ids changed', () => {
    expect(restoreDomainWorkingSetFilter({
      enabled: true,
      roots: [{ entityType: 'composition', id: 1, identity: 'schedule-composition' }],
    }, available)).toEqual({
      enabled: true,
      roots: [{ entityType: 'composition', id: 41, identity: 'schedule-composition' }],
    })
  })

  it('resets the whole filter when at least one root no longer exists', () => {
    expect(restoreDomainWorkingSetFilter({
      enabled: true,
      roots: [
        { entityType: 'composition', id: 1, identity: 'schedule-composition' },
        { entityType: 'store', id: 2, identity: 'removed-store' },
      ],
    }, available)).toBeNull()
  })

  it('does not restore disabled or malformed state', () => {
    expect(restoreDomainWorkingSetFilter({ enabled: false, roots: available }, available)).toBeNull()
    expect(restoreDomainWorkingSetFilter({ enabled: true, roots: [] }, available)).toBeNull()
  })
})
