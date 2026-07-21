import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveSourceReferenceDocumentTarget } from '@/features/endge-ide/model/source-reference/source-reference-document-target'

describe('source reference document target', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a Type by stable identity instead of its display name', () => {
    vi.spyOn(Endge.domain, 'getType').mockReturnValue({
      identity: 'Customer',
      name: 'Customer model',
      isPrimitive: false,
    } as any)
    const target = resolveSourceReferenceDocumentTarget({
      target: 'type',
      identity: 'Customer',
      range: { start: 0, end: 8 },
    })

    expect(target).toEqual({
      documentId: 'Customer',
      documentType: 'type',
    })
  })
})
