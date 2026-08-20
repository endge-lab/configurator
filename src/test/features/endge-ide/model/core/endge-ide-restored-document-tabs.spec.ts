import { Endge, QueryType } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ENDGE_IDE_DOCUMENT_VIEW_ID, getMissingDocumentTabIds } from '@/features/endge-ide/model/modules/tabs/endge-ide-restored-document-tabs'
import { getDomainDocumentLabel } from '@/features/endge-ide/model/domain/domain-entity-presentation'

describe('endge IDE restored document tabs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds restored document tabs missing from the loaded domain', () => {
    vi.spyOn(Endge.domain, 'getQuery').mockImplementation((documentId) => {
      return documentId === 'existing-query' ? {} as never : null
    })
    vi.spyOn(Endge.domain, 'getConfiguration').mockImplementation((documentId) => {
      return documentId === 'existing-configuration' ? { displayName: 'Редактирование' } as never : null
    })

    expect(getMissingDocumentTabIds([
      {
        id: 'query-missing-query',
        label: 'Missing query',
        viewId: ENDGE_IDE_DOCUMENT_VIEW_ID,
        payload: { documentId: 'missing-query', documentType: QueryType.REST },
      },
      {
        id: 'query-existing-query',
        label: 'Existing query',
        viewId: ENDGE_IDE_DOCUMENT_VIEW_ID,
        payload: { documentId: 'existing-query', documentType: QueryType.REST },
      },
      {
        id: 'malformed-document-tab',
        label: 'Malformed',
        viewId: ENDGE_IDE_DOCUMENT_VIEW_ID,
        payload: {},
      },
      {
        id: 'configuration-existing-configuration',
        label: 'Existing configuration',
        viewId: ENDGE_IDE_DOCUMENT_VIEW_ID,
        payload: { documentId: 'existing-configuration', documentType: 'configuration' },
      },
      {
        id: 'architecture',
        label: 'Архитектура',
        viewId: 'endge-architecture',
      },
    ])).toEqual([
      'query-missing-query',
      'malformed-document-tab',
    ])
    expect(getDomainDocumentLabel('existing-configuration', 'configuration')).toBe('Редактирование')
  })
})
