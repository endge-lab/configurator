import { describe, expect, it } from 'vitest'

import { restoreDomainWorkingSetFilter } from '@/features/endge-ide/services/domain-working-set/domain-working-set-persistence'

describe('восстановление фильтра рабочего набора домена', () => {
  const available = [
    { entityType: 'composition', id: 41, identity: 'schedule-composition' },
    { entityType: 'data-view', id: 42, identity: 'schedule-view' },
  ]

  it('восстанавливает включённые корни по стабильному identity при изменении ID базы данных', () => {
    expect(restoreDomainWorkingSetFilter({
      enabled: true,
      roots: [{ entityType: 'composition', id: 1, identity: 'schedule-composition' }],
    }, available)).toEqual({
      enabled: true,
      roots: [{ entityType: 'composition', id: 41, identity: 'schedule-composition' }],
    })
  })

  it('полностью сбрасывает фильтр, если хотя бы один корень больше не существует', () => {
    expect(restoreDomainWorkingSetFilter({
      enabled: true,
      roots: [
        { entityType: 'composition', id: 1, identity: 'schedule-composition' },
        { entityType: 'store', id: 2, identity: 'removed-store' },
      ],
    }, available)).toBeNull()
  })

  it('не восстанавливает отключённое или некорректное состояние', () => {
    expect(restoreDomainWorkingSetFilter({ enabled: false, roots: available }, available)).toBeNull()
    expect(restoreDomainWorkingSetFilter({ enabled: true, roots: [] }, available)).toBeNull()
  })
})
