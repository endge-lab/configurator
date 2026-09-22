import { describe, expect, it } from 'vitest'

import { DOCUMENT_CREATE_DESCRIPTORS } from '@/features/endge-ide/config/document-create'
import { suggestDocumentIdentity } from '@/features/endge-ide/tools/document-create'

describe('вспомогательные функции создания документа', () => {
  it('предлагает стабильный identity из русского и английского текста', () => {
    expect(suggestDocumentIdentity('Модель расчёта тарифов')).toBe('model-rascheta-tarifov')
    expect(suggestDocumentIdentity('Flight Board / Main')).toBe('flight-board-main')
  })

  it('объявляет уникальные типы descriptor и описания на основе capabilities', () => {
    const types = DOCUMENT_CREATE_DESCRIPTORS.map(item => item.type)

    expect(new Set(types).size).toBe(types.length)
    expect(DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === 'update')).toMatchObject({
      supportsFolder: false,
      supportsDescription: true,
    })
    expect(DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === 'query-rest')).toMatchObject({
      supportsFolder: true,
      supportsDescription: false,
    })
    expect(DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === 'query-gql')).toMatchObject({
      supportsFolder: true,
      supportsDescription: false,
    })
  })
})
