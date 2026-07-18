import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  deleteEntity,
  executeDrop,
} from '@/features/endge-ide/model/domain/domain-drag-drop'

describe('domain management actions', () => {
  it('rejects deletion of an integration-managed document', async () => {
    await expect(deleteEntity({
      id: '7',
      identity: 'example.operations',
      name: 'Operations',
      type: 'file',
      docType: 'integration',
      sectionType: DomainSectionType.Integration,
      managedBy: 'integration',
      managedById: 'installation-1',
    })).rejects.toThrow('Управляемый извне документ нельзя удалить')
  })

  it('rejects folder movement in the global integration registry', async () => {
    const result = await executeDrop([{
      id: '7',
      identity: 'example.operations',
      docType: 'integration',
      sectionType: DomainSectionType.Integration,
      rootId: 'root-integrations',
    }], {
      targetRootId: 'root-integrations',
      dropFolderId: null,
    })

    expect(result).toEqual({
      moved: 0,
      skipped: 1,
      errors: ['Глобальный реестр интеграций не поддерживает папки'],
    })
  })
})
