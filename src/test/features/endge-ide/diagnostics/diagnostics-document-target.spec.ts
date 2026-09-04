import { Endge, QueryType } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDiagnosticsDocumentTarget } from '@/features/endge-ide/services/diagnostics/diagnostics-document-target'

describe('целевой документ диагностики', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('сопоставляет общий тип Query компилятора с типом исходного документа', () => {
    vi.spyOn(Endge.domain, 'getQuery').mockReturnValue({
      id: 42,
      identity: 'hub-flights-arrival',
      type: QueryType.REST,
    } as any)

    expect(resolveDiagnosticsDocumentTarget({
      entityType: 'query',
      id: 42,
      identity: 'hub-flights-arrival',
    })).toEqual({
      documentId: 'hub-flights-arrival',
      documentType: QueryType.REST,
    })
  })

  it('открывает прямые типы документов по стабильному identity вместо ID хранилища', () => {
    expect(resolveDiagnosticsDocumentTarget({
      entityType: 'computation',
      id: 17,
      identity: 'groundhandling-process-cell',
    })).toEqual({
      documentId: 'groundhandling-process-cell',
      documentType: 'computation',
    })
  })

  it('не создаёт вкладку Query, если исходный документ отсутствует', () => {
    vi.spyOn(Endge.domain, 'getQuery').mockReturnValue(null)

    expect(resolveDiagnosticsDocumentTarget({
      entityType: 'query',
      id: 404,
      identity: 'missing-query',
    })).toBeNull()
  })
})
