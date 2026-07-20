import { describe, expect, it } from 'vitest'

import {
  parseTableDefaultHidden,
  updateTableDefaultHidden,
} from '@/features/endge-ide/model/component-sfc-editor/table-column-visibility-state'

describe('table visual column visibility state', () => {
  it('reads a sparse list of hidden column keys', () => {
    expect([...parseTableDefaultHidden('gate, status,gate')]).toEqual(['gate', 'status'])
  })

  it('hides a column without changing unrelated keys', () => {
    expect(updateTableDefaultHidden('gate,status,status', 'flight', true)).toBe('gate,status,status,flight')
  })

  it('removes the attribute value when the last column becomes visible', () => {
    expect(updateTableDefaultHidden('gate', 'gate', false)).toBeNull()
  })
})
