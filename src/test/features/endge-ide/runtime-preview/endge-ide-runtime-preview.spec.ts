import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'

import { EndgeIDERuntimePreview } from '@/features/endge-ide/model/runtime-preview/endge-ide-runtime-preview'

const mocks = vi.hoisted(() => ({
  valid: true,
  showWidget: vi.fn(),
  toastError: vi.fn(),
  instances: [] as any[],
  rememberedTargets: [] as Array<{ entityType: string, identity: string }>,
  readHistory: vi.fn(),
  writeHistory: vi.fn(),
  surfaceLifecycle: null as {
    beforeContextReset?: () => Promise<void> | void
    afterContextBoot?: () => Promise<void> | void
  } | null,
  leftArea: { expanded: true, activeWidget: 'runtime-tree' },
}))

vi.mock('@endge/core', () => ({
  Endge: {
    runtime: {
      subscribe: vi.fn(() => vi.fn()),
      scopes: { subscribe: vi.fn(() => vi.fn()) },
    },
  },
}))

vi.mock('vue-sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/components/layouts/grid', () => ({
  getLayoutState: () => ({ widgets: ref({ areas: { left: mocks.leftArea } }) }),
  showWidget: mocks.showWidget,
}))
vi.mock('@/features/endge-ide/model/context/endge-ide-context', () => ({
  EndgeIDEContext: {
    registerSurface: vi.fn((_id: string, lifecycle: { beforeContextReset?: () => Promise<void> | void }) => {
      mocks.surfaceLifecycle = lifecycle
      return vi.fn()
    }),
  },
}))
vi.mock('@/features/endge-ide/model/runtime-preview/runtime-preview-history', () => ({
  readRuntimePreviewHistory: mocks.readHistory,
  writeRuntimePreviewHistory: mocks.writeHistory,
}))
vi.mock('@/features/endge-ide/model/runtime-preview/runtime-preview-context-guard', () => ({
  validateRuntimePreviewContext: () => mocks.valid
    ? { valid: true }
    : { valid: false, message: 'Context mismatch', description: 'Switch context first' },
}))
vi.mock('@/features/endge-ide/model/runtime-preview/runtime-preview-instance', () => ({
  RuntimePreviewInstance: class RuntimePreviewInstance {
    public key: string
    public tree = shallowRef<any[]>([])
    public selectedNodeId = ref<string | null>(null)
    public selectedNode = computed(() => null)
    public status = ref('inactive')
    public error = ref<string | null>(null)
    public renderables = shallowRef<any[]>([])
    public inactiveRenderableChildren = computed(() => [])
    public launch = vi.fn(async () => { this.status.value = 'active' })
    public select = vi.fn(async () => undefined)
    public pause = vi.fn(async () => { this.status.value = 'paused' })
    public resume = vi.fn(async () => { this.status.value = 'active' })
    public stop = vi.fn(async () => { this.status.value = 'stopped' })
    public restart = vi.fn(async () => { this.status.value = 'active' })
    public dispose = vi.fn(async () => { this.status.value = 'disposed' })
    public pauseNode = vi.fn(async () => undefined)
    public resumeNode = vi.fn(async () => undefined)
    public stopNode = vi.fn(async () => undefined)
    public restartNode = vi.fn(async () => undefined)
    public lifecycleState = vi.fn(() => this.status.value)
    public refresh = vi.fn()

    public constructor(target: { entityType: string, identity: string }) {
      this.target = target
      this.key = `${target.entityType}:${target.identity}`
      mocks.instances.push(this)
    }

    public target: { entityType: string, identity: string }
  },
}))

describe('endgeIDE Runtime Preview manager', () => {
  beforeEach(() => {
    mocks.valid = true
    mocks.showWidget.mockReset()
    mocks.toastError.mockReset()
    mocks.instances.splice(0)
    mocks.rememberedTargets = []
    mocks.readHistory.mockReset()
    mocks.readHistory.mockImplementation(() => [...mocks.rememberedTargets])
    mocks.writeHistory.mockReset()
    mocks.surfaceLifecycle = null
    mocks.leftArea.expanded = true
    mocks.leftArea.activeWidget = 'runtime-tree'
  })

  it('passes the current editor draft to the stable runtime entry', async () => {
    const manager = new EndgeIDERuntimePreview()
    const draft = { identity: 'table', source: '<template><div /></template>' }

    await manager.launch({ entityType: 'component-sfc', identity: 'table', draft })

    expect(mocks.instances[0].launch).toHaveBeenCalledWith(draft)
  })

  it('returns from Runtime Tree to Project without disposing runtimes', async () => {
    const manager = new EndgeIDERuntimePreview()
    await manager.launch({ entityType: 'store', identity: 'flights' })
    mocks.showWidget.mockClear()

    expect(manager.returnToProject()).toBe(true)
    expect(mocks.showWidget).toHaveBeenCalledWith('project')
    expect(mocks.instances[0].dispose).not.toHaveBeenCalled()
  })

  it('starts empty and keeps multiple explicitly launched roots', async () => {
    const manager = new EndgeIDERuntimePreview()

    expect(manager.entries.value).toEqual([])
    await manager.launch({ entityType: 'composition', identity: 'entry' })
    await manager.launch({ entityType: 'component-sfc', identity: 'table' })

    expect(manager.entries.value.map(item => item.key)).toEqual([
      'composition:entry',
      'component-sfc:table',
    ])
    expect(manager.selectedEntryKey.value).toBe('component-sfc:table')
    expect(mocks.showWidget).toHaveBeenCalledTimes(2)
  })

  it('restores remembered roots as inactive entries without launching them', () => {
    mocks.rememberedTargets = [
      { entityType: 'composition', identity: 'entry' },
      { entityType: 'store', identity: 'flights' },
    ]
    const manager = new EndgeIDERuntimePreview()

    manager.init()

    expect(manager.entries.value.map(item => item.key)).toEqual([
      'composition:entry',
      'store:flights',
    ])
    expect(mocks.instances.every(instance => instance.status.value === 'inactive')).toBe(true)
    expect(mocks.instances.every(instance => instance.launch.mock.calls.length === 0)).toBe(true)
    manager.reset()
  })

  it('keeps restored inactive roots when another entity is launched explicitly', async () => {
    mocks.rememberedTargets = [{ entityType: 'composition', identity: 'remembered' }]
    const manager = new EndgeIDERuntimePreview()
    manager.init()

    await manager.launch({ entityType: 'store', identity: 'flights' })

    expect(manager.entries.value.map(item => item.key)).toEqual([
      'composition:remembered',
      'store:flights',
    ])
    expect(mocks.instances[0].launch).not.toHaveBeenCalled()
    expect(mocks.instances[1].launch).toHaveBeenCalledOnce()
    expect(mocks.writeHistory).toHaveBeenLastCalledWith([
      { entityType: 'composition', identity: 'remembered' },
      { entityType: 'store', identity: 'flights' },
    ])
    manager.reset()
  })

  it('launches a document batch in order, deduplicates targets, and reveals the tree once', async () => {
    const manager = new EndgeIDERuntimePreview()

    const launched = await manager.launchAll([
      { entityType: 'store', identity: 'flights' },
      { entityType: 'composition', identity: 'entry' },
      { entityType: 'store', identity: 'flights' },
    ])

    expect(launched).toBe(2)
    expect(manager.entries.value.map(item => item.key)).toEqual([
      'store:flights',
      'composition:entry',
    ])
    expect(mocks.instances[0].launch.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.instances[1].launch.mock.invocationCallOrder[0],
    )
    expect(mocks.showWidget).toHaveBeenCalledOnce()
    expect(mocks.showWidget).toHaveBeenCalledWith('runtime-tree')
  })

  it('reveals the Runtime Tree for an empty batch', async () => {
    const manager = new EndgeIDERuntimePreview()

    expect(await manager.launchAll([])).toBe(0)
    expect(mocks.showWidget).toHaveBeenCalledWith('runtime-tree')
  })

  it('serializes duplicate documents through the same stable entry and launches a fresh generation', async () => {
    const manager = new EndgeIDERuntimePreview()

    await manager.launch({ entityType: 'store', identity: 'flights' })
    await manager.launch({ entityType: 'store', identity: 'flights' })

    expect(manager.entries.value).toHaveLength(1)
    expect(mocks.instances).toHaveLength(1)
    expect(mocks.instances[0].launch).toHaveBeenCalledTimes(2)
  })

  it('does not create or replace an entry when context validation fails', async () => {
    const manager = new EndgeIDERuntimePreview()
    await manager.launch({ entityType: 'store', identity: 'flights' })
    mocks.valid = false

    expect(await manager.launch({ entityType: 'project', identity: 'other' })).toBe(false)
    expect(manager.entries.value.map(item => item.key)).toEqual(['store:flights'])
    expect(mocks.toastError).toHaveBeenCalledOnce()
  })

  it('pauses and stops all roots without removing them and disposes everything on reset', async () => {
    const manager = new EndgeIDERuntimePreview()
    await manager.launch({ entityType: 'composition', identity: 'entry' })
    await manager.launch({ entityType: 'store', identity: 'flights' })

    await manager.pauseAll()
    expect(mocks.instances.every(instance => instance.pause.mock.calls.length === 1)).toBe(true)

    await manager.stopAll()
    expect(mocks.instances.every(instance => instance.stop.mock.calls.length === 1)).toBe(true)
    expect(manager.entries.value).toHaveLength(2)

    await manager.disposeAll()
    expect(mocks.instances.every(instance => instance.dispose.mock.calls.length === 1)).toBe(true)
    expect(manager.entries.value).toEqual([])
    expect(manager.selectedEntryKey.value).toBeNull()
  })

  it('starts inactive, stopped, and failed roots while resuming paused roots', async () => {
    const manager = new EndgeIDERuntimePreview()
    const statuses = ['inactive', 'paused', 'stopped', 'error', 'active', 'preparing'] as const

    for (const [index, status] of statuses.entries()) {
      await manager.launch({ entityType: 'store', identity: `store-${index}` })
      mocks.instances[index].status.value = status
      mocks.instances[index].resume.mockClear()
      mocks.instances[index].restart.mockClear()
    }

    await manager.startAll()

    expect(mocks.instances[0].restart).toHaveBeenCalledOnce()
    expect(mocks.instances[1].resume).toHaveBeenCalledOnce()
    expect(mocks.instances[2].restart).toHaveBeenCalledOnce()
    expect(mocks.instances[3].restart).toHaveBeenCalledOnce()
    expect(mocks.instances[4].resume).not.toHaveBeenCalled()
    expect(mocks.instances[4].restart).not.toHaveBeenCalled()
    expect(mocks.instances[5].resume).not.toHaveBeenCalled()
    expect(mocks.instances[5].restart).not.toHaveBeenCalled()
  })

  it('restarts mounted roots after a data mode change and preserves paused state', async () => {
    const manager = new EndgeIDERuntimePreview()
    await manager.launch({ entityType: 'store', identity: 'active' })
    await manager.launch({ entityType: 'composition', identity: 'paused' })
    await manager.launch({ entityType: 'store', identity: 'inactive' })
    mocks.instances[1].status.value = 'paused'
    mocks.instances[2].status.value = 'inactive'
    for (const instance of mocks.instances) {
      instance.restart.mockClear()
      instance.pause.mockClear()
    }

    await manager.restartForDataModeChange()

    expect(mocks.instances[0].restart).toHaveBeenCalledOnce()
    expect(mocks.instances[1].restart).toHaveBeenCalledOnce()
    expect(mocks.instances[1].pause).toHaveBeenCalledOnce()
    expect(mocks.instances[2].restart).not.toHaveBeenCalled()
  })

  it('removes every root and clears remembered history only on explicit remove-all', async () => {
    const manager = new EndgeIDERuntimePreview()
    await manager.launch({ entityType: 'composition', identity: 'entry' })
    await manager.launch({ entityType: 'store', identity: 'flights' })
    mocks.writeHistory.mockClear()

    await manager.removeAll()

    expect(manager.entries.value).toEqual([])
    expect(mocks.instances.every(instance => instance.dispose.mock.calls.length === 1)).toBe(true)
    expect(mocks.writeHistory).toHaveBeenCalledOnce()
    expect(mocks.writeHistory).toHaveBeenCalledWith([])
  })

  it('clears every runtime before a context reset', async () => {
    const manager = new EndgeIDERuntimePreview()
    manager.init()
    await manager.launch({ entityType: 'composition', identity: 'entry' })
    await manager.launch({ entityType: 'store', identity: 'flights' })

    await mocks.surfaceLifecycle?.beforeContextReset?.()

    expect(manager.entries.value).toEqual([])
    expect(mocks.instances.every(instance => instance.dispose.mock.calls.length === 1)).toBe(true)
    expect(mocks.writeHistory).not.toHaveBeenLastCalledWith([])

    mocks.rememberedTargets = [{ entityType: 'store', identity: 'remembered' }]
    await mocks.surfaceLifecycle?.afterContextBoot?.()
    expect(manager.entries.value.map(item => item.key)).toEqual(['store:remembered'])
    expect(mocks.instances.at(-1).launch).not.toHaveBeenCalled()
    manager.reset()
  })
})
