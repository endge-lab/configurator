import { describe, expect, it, vi } from 'vitest'

import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'

const harness = vi.hoisted(() => {
  const debugReleases: Array<ReturnType<typeof vi.fn>> = []
  const snapshotReleases: Array<ReturnType<typeof vi.fn>> = []
  const method = () => vi.fn()
  const modules = {
    demonstration: {
      init: method(),
      reset: method(),
    },
    domainDrag: { reset: method() },
    modals: {
      init: method(),
      reset: method(),
      openCreateDocument: method(),
    },
    tabs: {
      init: method(),
      reset: method(),
      save: method(),
      closeActiveTabFromHotkey: method(),
      setSaveHandler: method(),
      setCloseTabHandler: method(),
      setCreateDocumentHandler: method(),
      setRunRuntimeHandler: method(),
      setReturnToProjectHandler: method(),
      documentEditorModel: { value: null },
    },
    widgets: {
      init: method(),
      reset: method(),
    },
    hotkeys: {
      init: method(),
      reset: method(),
      setSaveHandler: method(),
      setCloseTabHandler: method(),
      setCreateDocumentHandler: method(),
      setRunRuntimeHandler: method(),
      setReturnToProjectHandler: method(),
    },
    flowCatalog: {
      init: method(),
      reset: method(),
    },
    runtimePreview: {
      init: method(),
      reset: method(),
      canLaunchEditor: method(),
      launchEditor: method(),
      returnToProject: method(),
    },
    problems: {
      init: method(),
      reset: method(),
      returnToProject: method(),
    },
    sourceEditorDialogs: { reset: method() },
    authProfileEditors: { reset: method() },
    integrations: { init: method().mockResolvedValue(undefined), reset: method().mockResolvedValue(undefined) },
    busy: { state: {}, run: <T>(operation: Promise<T>) => operation, reset: method() },
    agentTableActions: { reset: method() },
  }
  return {
    modules,
    debugReleases,
    snapshotReleases,
    debugAcquire: vi.fn(() => {
      const release = vi.fn()
      debugReleases.push(release)
      return { release }
    }),
    snapshotAcquire: vi.fn(() => {
      const release = vi.fn()
      snapshotReleases.push(release)
      return { release }
    }),
    runtimeDebuggerStart: vi.fn(),
    runtimeDebuggerReset: vi.fn(),
  }
})

vi.mock('@endge/raph', () => ({
  Raph: { debug: { acquire: harness.debugAcquire } },
}))

vi.mock('@endge/core', () => ({
  Endge: {
    runtime: { acquireDestroyedHostSnapshots: harness.snapshotAcquire },
    runtimeDebugger: {
      startListening: harness.runtimeDebuggerStart,
      reset: harness.runtimeDebuggerReset,
    },
  },
}))

vi.mock('@/features/endge-ide/model/config/endge-ide-debug-flags', () => ({
  isIDERuntimeDebuggerDisabled: () => false,
  isIDEWidgetsDisabled: () => false,
}))

vi.mock('@/features/endge-ide/model/config/modules.config', () => ({
  createEndgeIDEModules: () => harness.modules,
}))

describe('endgeIDE debug inspection leases', () => {
  it('owns one Configurator lease per active IDE session and releases it on reset', async () => {
    EndgeIDE.setup({} as any)

    await Promise.all([EndgeIDE.init(), EndgeIDE.init()])

    expect(harness.debugAcquire).toHaveBeenCalledTimes(1)
    expect(harness.snapshotAcquire).toHaveBeenCalledWith(50)
    expect(harness.snapshotAcquire).toHaveBeenCalledTimes(1)
    expect(harness.runtimeDebuggerStart).toHaveBeenCalledTimes(1)

    await EndgeIDE.reset()
    expect(harness.debugReleases[0]).toHaveBeenCalledTimes(1)
    expect(harness.snapshotReleases[0]).toHaveBeenCalledTimes(1)
    expect(harness.runtimeDebuggerReset).toHaveBeenCalledTimes(1)

    await EndgeIDE.init()
    expect(harness.debugAcquire).toHaveBeenCalledTimes(2)
    expect(harness.snapshotAcquire).toHaveBeenCalledTimes(2)
    await EndgeIDE.reset()
    expect(harness.debugReleases[1]).toHaveBeenCalledTimes(1)
    expect(harness.snapshotReleases[1]).toHaveBeenCalledTimes(1)
  })

  it('releases both leases when IDE initialization fails', async () => {
    const leaseIndex = harness.debugReleases.length
    harness.modules.integrations.init.mockRejectedValueOnce(new Error('integration init failed'))

    await expect(EndgeIDE.init()).rejects.toThrow('integration init failed')

    expect(harness.debugReleases[leaseIndex]).toHaveBeenCalledTimes(1)
    expect(harness.snapshotReleases[leaseIndex]).toHaveBeenCalledTimes(1)
    expect(harness.runtimeDebuggerReset).toHaveBeenCalled()
  })
})
