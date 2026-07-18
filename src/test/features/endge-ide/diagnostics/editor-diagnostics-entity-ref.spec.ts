import { describe, expect, it } from 'vitest'

import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'

describe('createEditorDiagnosticsEntityRef', () => {
  it('использует persisted id и identity редактора', () => {
    expect(createEditorDiagnosticsEntityRef('query', { id: 42, identity: 'flight-query' })).toEqual({
      entityType: 'query',
      id: 42,
      identity: 'flight-query',
    })
  })

  it('использует identity как id для новой сущности', () => {
    expect(createEditorDiagnosticsEntityRef('store', { identity: 'flight-store' })).toEqual({
      entityType: 'store',
      id: 'flight-store',
      identity: 'flight-store',
    })
  })

  it('не создаёт ссылку без адресуемого идентификатора', () => {
    expect(createEditorDiagnosticsEntityRef('query', { identity: '  ' })).toBeNull()
    expect(createEditorDiagnosticsEntityRef('query', null)).toBeNull()
  })
})
