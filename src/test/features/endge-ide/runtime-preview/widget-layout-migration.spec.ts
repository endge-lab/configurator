import { describe, expect, it } from 'vitest'

import { migratePersistedWidgetId, removePersistedWidgetId } from '@/components/layouts/grid/layout'

describe('миграция layout виджета Runtime Preview', () => {
  it('копирует сохранённое реактивное состояние без structuredClone над proxy', () => {
    expect(() => migratePersistedWidgetId('preview-runtime-tree', 'runtime-tree')).not.toThrow()
  })

  it('удаляет устаревший ID виджета без reset layout', () => {
    expect(() => removePersistedWidgetId('help')).not.toThrow()
  })
})
