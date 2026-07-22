import { describe, expect, it } from 'vitest'

import {
  isTableColumnSortPath,
  moveTableDefaultSort,
  parseTableColumnSortPaths,
  parseTableDefaultSort,
  renameTableDefaultSortKey,
  serializeTableColumnSortPaths,
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

  it('round-trips ordered Column sort-by paths', () => {
    const paths = parseTableColumnSortPaths('departureLeg.aircraft.tail, departureLeg.aircraft.type')
    expect(paths).toEqual(['departureLeg.aircraft.tail', 'departureLeg.aircraft.type'])
    expect(serializeTableColumnSortPaths(paths))
      .toBe('departureLeg.aircraft.tail,departureLeg.aircraft.type')
    expect(serializeTableColumnSortPaths([])).toBeNull()
  })

  it('accepts dot paths and DataPath selectors supported by the adapters', () => {
    expect(isTableColumnSortPath('departureLeg.aircraft.tail')).toBe(true)
    expect(isTableColumnSortPath("departureLeg.attributes[name='ACTail'].text")).toBe(true)
    expect(isTableColumnSortPath('row items.value')).toBe(false)
    expect(isTableColumnSortPath('attributes[*].text')).toBe(false)
    expect(isTableColumnSortPath('items..value')).toBe(false)
  })
})
