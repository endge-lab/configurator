import { describe, expect, it } from 'vitest'

import {
  moveTableDefaultSort,
  parseTableDefaultSort,
  renameTableDefaultSortKey,
  updateTableDefaultSort,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-sort-state'

describe('table visual column sort state', () => {
  it('reads directions in priority order and defaults a missing direction to asc', () => {
    expect(parseTableDefaultSort('status:asc,broken:up,flight,date:desc')).toEqual([
      { key: 'status', direction: 'asc' },
      { key: 'flight', direction: 'asc' },
      { key: 'date', direction: 'desc' },
    ])
  })

  it('updates direction in place and preserves unrelated invalid tokens', () => {
    expect(updateTableDefaultSort('status:asc,broken:up,date:desc', 'status', 'desc'))
      .toBe('status:desc,broken:up,date:desc')
  })

  it('removes the value when the last default sort is cleared', () => {
    expect(updateTableDefaultSort('status:asc', 'status', null)).toBeNull()
  })

  it('renames a key without changing its priority', () => {
    expect(renameTableDefaultSortKey('status:asc,date:desc', 'status', 'state'))
      .toBe('state:asc,date:desc')
  })

  it('moves one sort item while keeping invalid source tokens', () => {
    expect(moveTableDefaultSort('status:asc,broken:up,date:desc', 'date', -1))
      .toBe('date:desc,broken:up,status:asc')
  })
})
