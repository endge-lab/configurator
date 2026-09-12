import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EndgeIDEUIState_Module } from '@/features/endge-ide/modules/EndgeIDEUIState_Module'

const mocks = vi.hoisted(() => ({
  workspace: { documentStructure: 'frontend' as 'frontend' | 'custom' },
  workspaceLoaded: true,
  state: undefined as unknown,
  workspaceListeners: new Set<() => void>(),
  stateListeners: new Set<() => void>(),
  setState: vi.fn(),
  removeState: vi.fn(),
  assertWritable: vi.fn(),
}))

vi.mock('@endge/core', () => ({
  Endge: {
    mode: 'application',
    assertWritable: mocks.assertWritable,
    workspace: {
      get isLoaded() {
        return mocks.workspaceLoaded
      },
      get current() {
        return mocks.workspace
      },
      subscribe: (listener: () => void) => {
        mocks.workspaceListeners.add(listener)
        return () => mocks.workspaceListeners.delete(listener)
      },
    },
    context: {
      getState: () => mocks.state,
      setState: mocks.setState,
      removeState: mocks.removeState,
      subscribeState: (_key: string, listener: () => void) => {
        mocks.stateListeners.add(listener)
        return () => mocks.stateListeners.delete(listener)
      },
    },
  },
}))

describe('endge IDE UI state', () => {
  beforeEach(() => {
    mocks.workspace.documentStructure = 'frontend'
    mocks.workspaceLoaded = true
    mocks.state = undefined
    mocks.workspaceListeners.clear()
    mocks.stateListeners.clear()
    vi.clearAllMocks()
  })

  /** Переключатель изменяет персональную проекцию, не мутируя общий Workspace. */
  it('переключает documentStructure через Context state без изменения Workspace', () => {
    const module = new EndgeIDEUIState_Module()
    module.init()

    module.toggleDocumentStructure()

    expect(module.documentStructure.value).toBe('custom')
    expect(mocks.workspace.documentStructure).toBe('frontend')
    expect(mocks.setState).toHaveBeenCalledWith(
      'configurator.domain.document-structure-override',
      { version: 1, value: 'custom' },
    )

    module.toggleDocumentStructure()

    expect(module.documentStructure.value).toBe('frontend')
    expect(mocks.removeState).toHaveBeenCalledWith('configurator.domain.document-structure-override')
  })

  /** Сохранённый override восстанавливается для текущего Context и синхронно обновляет consumers. */
  it('восстанавливает валидный override и реагирует на его изменение', () => {
    mocks.state = { version: 1, value: 'custom' }
    const module = new EndgeIDEUIState_Module()
    module.init()

    expect(module.documentStructure.value).toBe('custom')

    mocks.state = { version: 1, value: 'frontend' }
    for (const listener of mocks.stateListeners) {
      listener()
    }

    expect(module.documentStructure.value).toBe('frontend')
    module.reset()
    expect(mocks.workspaceListeners.size).toBe(0)
    expect(mocks.stateListeners.size).toBe(0)
  })

  /** Повреждённый persisted snapshot не подменяет сохранённую структуру Workspace. */
  it('игнорирует неизвестную версию persisted override', () => {
    mocks.workspace.documentStructure = 'custom'
    mocks.state = { version: 2, value: 'frontend' }
    const module = new EndgeIDEUIState_Module()

    module.init()

    expect(module.documentStructure.value).toBe('custom')
  })
})
