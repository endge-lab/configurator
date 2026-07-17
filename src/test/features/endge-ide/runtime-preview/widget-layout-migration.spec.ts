import { describe, expect, it } from 'vitest'

import { migratePersistedWidgetId } from '@/components/layouts/grid/layout'

describe('runtime preview widget layout migration', () => {
  it('copies reactive persisted state without using structuredClone on a proxy', () => {
    expect(() => migratePersistedWidgetId('preview-runtime-tree', 'runtime-tree')).not.toThrow()
  })
})
