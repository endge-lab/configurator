import { describe, expect, it } from 'vitest'

import {
  parseTableDefaultPin,
  updateTableDefaultPin,
} from '@/features/endge-ide/services/component-sfc-editor/table-column-pin-state'

describe('визуальное состояние закрепления колонок таблицы', () => {
  it('читает только первую валидную сторону для каждого ключа', () => {
    expect([...parseTableDefaultPin('flight:left,status:right,broken:start,flight:right')]).toEqual([
      ['flight', 'left'],
      ['status', 'right'],
    ])
  })

  it('обновляет один ключ и сохраняет несвязанные исходные токены', () => {
    expect(updateTableDefaultPin(
      'flight:left,broken:start,status:right,flight:right',
      'flight',
      'right',
    )).toBe('broken:start,status:right,flight:right')
  })

  it('удаляет значение атрибута после снятия последнего закрепления', () => {
    expect(updateTableDefaultPin('flight:left', 'flight', null)).toBeNull()
  })
})
