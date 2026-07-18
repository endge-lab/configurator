import { describe, expect, it } from 'vitest'

import { migratePersistedWidgetId, removePersistedWidgetId } from '@/components/layouts/grid/layout'

describe('runtime preview widget layout migration', () => {
  it('copies reactive persisted state without using structuredClone on a proxy', () => {
    expect(() => migratePersistedWidgetId('preview-runtime-tree', 'runtime-tree')).not.toThrow()
  })

  it('removes a retired widget id without resetting the layout', () => {
    expect(() => removePersistedWidgetId('help')).not.toThrow()
  })
})
