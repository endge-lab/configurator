import { describe, expect, it } from 'vitest'

import {
  parseTableDefaultHidden,
  updateTableDefaultHidden,
} from '@/features/endge-ide/services/component-sfc-editor/table-column-visibility-state'

describe('визуальное состояние видимости колонок таблицы', () => {
  it('читает разреженный список ключей скрытых колонок', () => {
    expect([...parseTableDefaultHidden('gate, status,gate')]).toEqual(['gate', 'status'])
  })

  it('скрывает колонку без изменения несвязанных ключей', () => {
    expect(updateTableDefaultHidden('gate,status,status', 'flight', true)).toBe('gate,status,status,flight')
  })

  it('удаляет значение атрибута, когда последняя колонка становится видимой', () => {
    expect(updateTableDefaultHidden('gate', 'gate', false)).toBeNull()
  })
})
