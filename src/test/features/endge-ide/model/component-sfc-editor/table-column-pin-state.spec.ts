import { describe, expect, it } from 'vitest'

import {
  parseTableDefaultPin,
  updateTableDefaultPin,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-pin-state'

describe('table visual column pin state', () => {
  it('reads only the first valid side for every key', () => {
    expect([...parseTableDefaultPin('flight:left,status:right,broken:start,flight:right')]).toEqual([
      ['flight', 'left'],
      ['status', 'right'],
    ])
  })

  it('updates one key and preserves unrelated raw tokens', () => {
    expect(updateTableDefaultPin(
      'flight:left,broken:start,status:right,flight:right',
      'flight',
      'right',
    )).toBe('broken:start,status:right,flight:right')
  })

  it('removes the attribute value when the last pin is cleared', () => {
    expect(updateTableDefaultPin('flight:left', 'flight', null)).toBeNull()
  })
})
