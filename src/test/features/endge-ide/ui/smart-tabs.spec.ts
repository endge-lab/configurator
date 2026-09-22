import type { SmartTabsPersistence } from '@/features/endge-ide/ui/smart-tabs/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { loadSmartTabs, saveSmartTabs } from '@/features/endge-ide/ui/smart-tabs/storage'
import { useSmartTabs } from '@/features/endge-ide/ui/smart-tabs/useSmartTabs'
import { resolveSmartTabViewState } from '@/features/endge-ide/ui/smart-tabs/useSmartTabViewState'

function createTab(id: string) {
  return { id, label: id, viewId: 'test-view', closable: true }
}

describe('сохраняемое состояние представлений Smart Tabs', () => {
  const values = new Map<string, string>()
  const persistence: SmartTabsPersistence = {
    read: <T>(key: string, fallback: T): T => {
      const raw = values.get(key)
      return raw == null ? fallback : JSON.parse(raw) as T
    },
    write: (key, value) => values.set(key, JSON.stringify(value)),
    remove: key => values.delete(key),
  }

  beforeEach(() => {
    values.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('мигрирует v1 без потери открытых и активной вкладок', () => {
    values.set('tabs', JSON.stringify({
      v: 1,
      state: {
        openTabs: [createTab('query-orders')],
        activeTabId: 'query-orders',
      },
    }))

    expect(loadSmartTabs(persistence, 'tabs')).toEqual({
      openTabs: [createTab('query-orders')],
      activeTabId: 'query-orders',
      viewStateByTabId: {},
    })
  })

  it('восстанавливает корректные slices и независимо игнорирует повреждённые', () => {
    values.set('tabs', JSON.stringify({
      v: 2,
      state: {
        openTabs: [createTab('query-orders')],
        activeTabId: 'query-orders',
        viewStateByTabId: {
          'query-orders': {
            'editor.active-tab': { version: 1, value: 'diagnostics' },
            'broken': { version: 0, value: 'bad' },
          },
          'closed-tab': {
            'editor.active-tab': { version: 1, value: 'source' },
          },
        },
      },
    }))

    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence }))!

    expect(api.activeTabId.value).toBe('query-orders')
    expect(api.getTabViewState('query-orders', 'editor.active-tab')).toEqual({
      version: 1,
      value: 'diagnostics',
    })
    expect(api.getTabViewState('query-orders', 'broken')).toBeUndefined()
    expect(api.getTabViewState('closed-tab', 'editor.active-tab')).toBeUndefined()
    scope.stop()
  })

  it('сохраняет slice и удаляет его вместе с владеющей вкладкой', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence }))!
    api.openTab(createTab('query-orders'))
    api.setTabViewState('query-orders', 'editor.active-tab', {
      version: 1,
      value: 'source',
    })
    await nextTick()

    expect(JSON.parse(values.get('tabs')!).state.viewStateByTabId).toEqual({
      'query-orders': {
        'editor.active-tab': { version: 1, value: 'source' },
      },
    })

    api.closeTab('query-orders')
    await nextTick()
    expect(JSON.parse(values.get('tabs')!).state.viewStateByTabId).toEqual({})
    scope.stop()
  })

  it('уведомляет владельца при физическом закрытии вкладок', () => {
    const onTabClosed = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence, onTabClosed }))!
    api.openTab(createTab('type-order'))
    api.openTab(createTab('query-orders'))

    api.closeTab('query-orders')
    api.closeAll()

    expect(onTabClosed).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'query-orders' }))
    expect(onTabClosed).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'type-order' }))
    scope.stop()
  })

  it('изолирует одинаковые ключи slice между внешними вкладками', () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence }))!
    api.openTab(createTab('query-orders'))
    api.openTab(createTab('query-airports'))

    api.setTabViewState('query-orders', 'editor.active-tab', { version: 1, value: 'source' })
    api.setTabViewState('query-airports', 'editor.active-tab', { version: 1, value: 'diagnostics' })

    expect(api.getTabViewState('query-orders', 'editor.active-tab')?.value).toBe('source')
    expect(api.getTabViewState('query-airports', 'editor.active-tab')?.value).toBe('diagnostics')
    scope.stop()
  })

  it('независимо сохраняет layout панели зависимостей для каждой вкладки документа', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence }))!
    api.openTab(createTab('store-arrival'))
    api.openTab(createTab('store-departure'))

    api.setTabViewState('store-arrival', 'document.dependencies.visible', { version: 1, value: true })
    api.setTabViewState('store-arrival', 'document.dependencies.split-ratio', { version: 1, value: 0.64 })
    api.setTabViewState('store-departure', 'document.dependencies.visible', { version: 1, value: false })
    await nextTick()

    const persisted = JSON.parse(values.get('tabs')!).state.viewStateByTabId
    expect(persisted['store-arrival']).toMatchObject({
      'document.dependencies.visible': { version: 1, value: true },
      'document.dependencies.split-ratio': { version: 1, value: 0.64 },
    })
    expect(persisted['store-departure']).toMatchObject({
      'document.dependencies.visible': { version: 1, value: false },
    })
    scope.stop()
  })

  it('сохраняет общее состояние представления после закрытия исходной вкладки', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', persistence }))!
    api.openTab(createTab('type-order'))
    api.setSharedViewState('type-editor.visual-workspace', {
      version: 1,
      value: { showPreview: true, showExample: false, layouts: { 'schema-preview': [0.4, 0.6] } },
    })
    api.closeTab('type-order')
    await nextTick()

    expect(api.getSharedViewState('type-editor.visual-workspace')?.value).toEqual({
      showPreview: true,
      showExample: false,
      layouts: { 'schema-preview': [0.4, 0.6] },
    })
    expect(JSON.parse(values.get('tabs')!).state.sharedViewState).toEqual({
      'type-editor.visual-workspace': {
        version: 1,
        value: { showPreview: true, showExample: false, layouts: { 'schema-preview': [0.4, 0.6] } },
      },
    })
    scope.stop()
  })

  it('использует запасное значение при ошибке валидатора или миграции slice', () => {
    const options = {
      version: 2,
      defaultValue: () => 'source',
      validate: (value: unknown) => value === 'source' || value === 'general',
      migrate: () => {
        throw new Error('broken migration')
      },
    }

    expect(resolveSmartTabViewState({ version: 2, value: 'removed-tab' }, options)).toEqual({
      restored: false,
      value: 'source',
    })
    expect(resolveSmartTabViewState({ version: 1, value: 'general' }, options)).toEqual({
      restored: false,
      value: 'source',
    })
  })

  it('не выбрасывает ошибку при отказе storage записать данные', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rejectedPersistence: SmartTabsPersistence = {
      read: <T>(_key: string, fallback: T) => fallback,
      write: () => { throw new Error('quota exceeded') },
      remove: () => undefined,
    }

    expect(() => saveSmartTabs(rejectedPersistence, 'tabs', {
      openTabs: [],
      activeTabId: null,
      viewStateByTabId: {},
    })).not.toThrow()
  })

  it('использует запасное значение без ошибки при отказе storage прочитать данные', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rejectedPersistence: SmartTabsPersistence = {
      read: () => { throw new Error('storage disabled') },
      write: () => undefined,
      remove: () => undefined,
    }

    expect(() => loadSmartTabs(rejectedPersistence, 'tabs')).not.toThrow()
    expect(loadSmartTabs(rejectedPersistence, 'tabs')).toBeNull()
  })
})
