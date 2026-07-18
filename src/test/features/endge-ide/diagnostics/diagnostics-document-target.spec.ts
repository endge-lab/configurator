import { Endge, QueryType } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDiagnosticsDocumentTarget } from '@/features/endge-ide/model/diagnostics/diagnostics-document-target'

describe('diagnostics document target', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves generic compiler query type to its authoring document type', () => {
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

  it('opens direct document types by stable identity instead of storage id', () => {
    expect(resolveDiagnosticsDocumentTarget({
      entityType: 'computation',
      id: 17,
      identity: 'groundhandling-process-cell',
    })).toEqual({
      documentId: 'groundhandling-process-cell',
      documentType: 'computation',
    })
  })

  it('does not create a query tab when the source document is absent', () => {
    vi.spyOn(Endge.domain, 'getQuery').mockReturnValue(null)

    expect(resolveDiagnosticsDocumentTarget({
      entityType: 'query',
      id: 404,
      identity: 'missing-query',
    })).toBeNull()
  })
})
