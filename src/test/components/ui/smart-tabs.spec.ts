import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { loadSmartTabs, saveSmartTabs } from '@/components/ui/smart-tabs/storage'
import { useSmartTabs } from '@/components/ui/smart-tabs/useSmartTabs'
import { resolveSmartTabViewState } from '@/components/ui/smart-tabs/useSmartTabViewState'

function createTab(id: string) {
  return { id, label: id, viewId: 'test-view', closable: true }
}

describe('smart tabs persisted view state', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('migrates v1 without losing open and active tabs', () => {
    values.set('tabs', JSON.stringify({
      v: 1,
      state: {
        openTabs: [createTab('query-orders')],
        activeTabId: 'query-orders',
      },
    }))

    expect(loadSmartTabs('tabs')).toEqual({
      openTabs: [createTab('query-orders')],
      activeTabId: 'query-orders',
      viewStateByTabId: {},
    })
  })

  it('restores valid slices and ignores malformed slices independently', () => {
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
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs' }))!

    expect(api.activeTabId.value).toBe('query-orders')
    expect(api.getTabViewState('query-orders', 'editor.active-tab')).toEqual({
      version: 1,
      value: 'diagnostics',
    })
    expect(api.getTabViewState('query-orders', 'broken')).toBeUndefined()
    expect(api.getTabViewState('closed-tab', 'editor.active-tab')).toBeUndefined()
    scope.stop()
  })

  it('persists a slice and removes it with its owning tab', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs' }))!
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

  it('notifies the owner when tabs are physically closed', () => {
    const onTabClosed = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs', onTabClosed }))!
    api.openTab(createTab('type-order'))
    api.openTab(createTab('query-orders'))

    api.closeTab('query-orders')
    api.closeAll()

    expect(onTabClosed).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'query-orders' }))
    expect(onTabClosed).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'type-order' }))
    scope.stop()
  })

  it('isolates equal slice keys between outer tabs', () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs' }))!
    api.openTab(createTab('query-orders'))
    api.openTab(createTab('query-airports'))

    api.setTabViewState('query-orders', 'editor.active-tab', { version: 1, value: 'source' })
    api.setTabViewState('query-airports', 'editor.active-tab', { version: 1, value: 'diagnostics' })

    expect(api.getTabViewState('query-orders', 'editor.active-tab')?.value).toBe('source')
    expect(api.getTabViewState('query-airports', 'editor.active-tab')?.value).toBe('diagnostics')
    scope.stop()
  })

  it('persists dependency panel layout independently for every document tab', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs' }))!
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

  it('persists shared view state after its originating tab is closed', async () => {
    const scope = effectScope()
    const api = scope.run(() => useSmartTabs({ storageKey: 'tabs' }))!
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

  it('falls back when a slice validator or migration fails', () => {
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

  it('does not throw when storage rejects a write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => undefined,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => saveSmartTabs('tabs', {
      openTabs: [],
      activeTabId: null,
      viewStateByTabId: {},
    })).not.toThrow()
  })

  it('falls back without throwing when storage rejects a read', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage disabled') },
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => loadSmartTabs('tabs')).not.toThrow()
    expect(loadSmartTabs('tabs')).toBeNull()
  })
})
