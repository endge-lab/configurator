import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveSourceReferenceDocumentTarget } from '@/features/endge-ide/services/source-reference/source-reference-document-target'

describe('целевой документ ссылки Source', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('открывает Type по стабильному identity вместо отображаемого имени', () => {
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
