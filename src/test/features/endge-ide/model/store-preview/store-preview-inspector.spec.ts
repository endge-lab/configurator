import type { StoreRuntimeHost } from '@endge/core'

import { describe, expect, it } from 'vitest'

import { readStorePreviewFields } from '../../../../../features/endge-ide/model/store-preview/store-preview-inspector'

describe('store preview inspector', () => {
  it('projects value and derived fields with their canonical Raph paths', () => {
    const runtime = {
      getDataSnapshot: () => ({
        raw: { pairsArrival: [{ id: 'arrival-1' }] },
        table: [{ id: 'arrival-1' }],
      }),
      getDataPath: (path = '') => path
        ? `runtime-preview.stores.groundhandling-db.${path}`
        : 'runtime-preview.stores.groundhandling-db',
      getFields: () => [
        {
          key: 'raw',
          kind: 'value',
          initial: { kind: 'mock', identity: 'groundhandling' },
        },
        {
          key: 'table',
          kind: 'derived',
          source: 'raw',
          dataViews: [
            { kind: 'external', identity: 'groundhandling-table' },
            { kind: 'inline', source: 'defineDataView({})' },
          ],
        },
      ],
    } as unknown as StoreRuntimeHost

    expect(readStorePreviewFields(runtime)).toEqual([
      expect.objectContaining({
        key: 'raw',
        kind: 'value',
        initializer: 'mock',
        mockIdentity: 'groundhandling',
        raphPath: 'runtime-preview.stores.groundhandling-db.raw',
        value: { pairsArrival: [{ id: 'arrival-1' }] },
      }),
      expect.objectContaining({
        key: 'table',
        kind: 'derived',
        source: 'raw',
        dataViews: ['groundhandling-table', 'inline'],
        raphPath: 'runtime-preview.stores.groundhandling-db.table',
        value: [{ id: 'arrival-1' }],
      }),
    ])
  })
})
