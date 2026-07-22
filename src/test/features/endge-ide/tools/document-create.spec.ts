import { describe, expect, it } from 'vitest'

import { DOCUMENT_CREATE_DESCRIPTORS } from '@/features/endge-ide/model/config/document-create'
import { suggestDocumentIdentity } from '@/features/endge-ide/tools/document-create'

describe('document create helpers', () => {
  it('suggests a stable identity from Russian and English text', () => {
    expect(suggestDocumentIdentity('Модель расчёта тарифов')).toBe('model-rascheta-tarifov')
    expect(suggestDocumentIdentity('Flight Board / Main')).toBe('flight-board-main')
  })

  it('declares unique descriptor types and capability-backed descriptions', () => {
    const types = DOCUMENT_CREATE_DESCRIPTORS.map(item => item.type)

    expect(new Set(types).size).toBe(types.length)
    expect(DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === 'integration')).toMatchObject({
      supportsFolder: false,
      supportsDescription: true,
    })
    expect(DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === 'query-rest')).toMatchObject({
      supportsFolder: true,
      supportsDescription: false,
    })
  })
})
