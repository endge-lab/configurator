import { describe, expect, it } from 'vitest'

import {
  isTableColumnSortPath,
  moveTableDefaultSort,
  parseTableColumnSortPaths,
  parseTableDefaultSort,
  renameTableDefaultSortKey,
  serializeTableColumnSortPaths,
  updateTableDefaultSort,
} from '@/features/endge-ide/services/component-sfc-editor/table-column-sort-state'

describe('визуальное состояние сортировки колонок таблицы', () => {
  it('читает направления в порядке приоритета и использует asc, если направление отсутствует', () => {
    expect(parseTableDefaultSort('status:asc,broken:up,flight,date:desc')).toEqual([
      { key: 'status', direction: 'asc' },
      { key: 'flight', direction: 'asc' },
      { key: 'date', direction: 'desc' },
    ])
  })

  it('обновляет направление на месте и сохраняет несвязанные невалидные токены', () => {
    expect(updateTableDefaultSort('status:asc,broken:up,date:desc', 'status', 'desc'))
      .toBe('status:desc,broken:up,date:desc')
  })

  it('удаляет значение после очистки последней сортировки по умолчанию', () => {
    expect(updateTableDefaultSort('status:asc', 'status', null)).toBeNull()
  })

  it('переименовывает ключ без изменения его приоритета', () => {
    expect(renameTableDefaultSortKey('status:asc,date:desc', 'status', 'state'))
      .toBe('state:asc,date:desc')
  })

  it('перемещает один элемент сортировки, сохраняя невалидные токены Source', () => {
    expect(moveTableDefaultSort('status:asc,broken:up,date:desc', 'date', -1))
      .toBe('date:desc,broken:up,status:asc')
  })

  it('сохраняет упорядоченные пути sort-by Column при двустороннем преобразовании', () => {
    const paths = parseTableColumnSortPaths('departureLeg.aircraft.tail, departureLeg.aircraft.type')
    expect(paths).toEqual(['departureLeg.aircraft.tail', 'departureLeg.aircraft.type'])
    expect(serializeTableColumnSortPaths(paths))
      .toBe('departureLeg.aircraft.tail,departureLeg.aircraft.type')
    expect(serializeTableColumnSortPaths([])).toBeNull()
  })

  it('принимает dot paths и селекторы DataPath, поддерживаемые адаптерами', () => {
    expect(isTableColumnSortPath('departureLeg.aircraft.tail')).toBe(true)
    expect(isTableColumnSortPath('departureLeg.attributes[name=\'ACTail\'].text')).toBe(true)
    expect(isTableColumnSortPath('row items.value')).toBe(false)
    expect(isTableColumnSortPath('attributes[*].text')).toBe(false)
    expect(isTableColumnSortPath('items..value')).toBe(false)
  })
})
