import { ComponentType, QueryType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor'
import { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor'
import { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor'
import { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor'
import {
  createRuntimePreviewLaunchRequest,
  createRuntimePreviewLaunchRequestFromDocument,
} from '@/features/endge-ide/model/runtime-preview/runtime-preview-launch-request'

describe('runtime Preview launch request', () => {
  it('maps runtime-capable source editors to their current draft', () => {
    const component = Object.assign(new RComponentSFCEditor(), {
      id: 7,
      identity: 'flight-table',
      tag: 'flight-table',
      name: 'Flight table',
      displayName: 'Flight table',
      source: '<template><div /></template>',
    })
    const composition = Object.assign(new RCompositionEditor(), {
      id: 8,
      identity: 'flight-page',
      name: 'Flight page',
      source: 'composition source',
      sourceVersion: 2,
    })
    const store = Object.assign(new RStoreEditor(), {
      id: 9,
      identity: 'flights',
      name: 'Flights',
      source: 'store source',
      sourceVersion: 3,
    })

    expect(createRuntimePreviewLaunchRequest(component)?.draft?.source).toBe(component.source)
    expect(createRuntimePreviewLaunchRequest(composition)?.draft?.sourceVersion).toBe(2)
    expect(createRuntimePreviewLaunchRequest(store)?.draft?.source).toBe(store.source)
  })

  it('launches a project without a synthetic draft and rejects unsupported editors', () => {
    const project = Object.assign(new RProjectEditor(), { identity: 'operations' })

    expect(createRuntimePreviewLaunchRequest(project)).toEqual({
      entityType: 'project',
      identity: 'operations',
    })
    expect(createRuntimePreviewLaunchRequest({ identity: 'query' })).toBeNull()
  })

  it('maps persisted runtime documents and ignores unsupported or unidentified documents', () => {
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: 'project', identity: 'operations' })).toEqual({
      entityType: 'project',
      identity: 'operations',
    })
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: 'composition', identity: 'flight-page' })).toEqual({
      entityType: 'composition',
      identity: 'flight-page',
    })
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: ComponentType.SFC, identity: 'flight-table' })).toEqual({
      entityType: 'component-sfc',
      identity: 'flight-table',
    })
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: 'store', identity: 'flights' })).toEqual({
      entityType: 'store',
      identity: 'flights',
    })
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: QueryType.REST, identity: 'flights' })).toBeNull()
    expect(createRuntimePreviewLaunchRequestFromDocument({ docType: 'store', identity: ' ' })).toBeNull()
  })
})
