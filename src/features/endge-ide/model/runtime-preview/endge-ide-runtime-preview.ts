/* eslint-disable style/max-statements-per-line */
import type {
  RuntimePreviewLaunchRequest,
  RuntimePreviewLifecycleState,
  RuntimePreviewTreeNode,
} from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { getLayoutState, showWidget } from '@/components/layouts/grid'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, runtimePreviewKey } from '@/features/endge-ide/domain/types/runtime-preview.types'
import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'
import { validateRuntimePreviewContext } from '@/features/endge-ide/model/runtime-preview/runtime-preview-context-guard'
import { readRuntimePreviewHistory, writeRuntimePreviewHistory } from '@/features/endge-ide/model/runtime-preview/runtime-preview-history'
import { RuntimePreviewInstance } from '@/features/endge-ide/model/runtime-preview/runtime-preview-instance'
import { createRuntimePreviewLaunchRequest } from '@/features/endge-ide/model/runtime-preview/runtime-preview-launch-request'

/** Persistent multi-root Runtime Preview workspace owned by EndgeIDE. */
export class EndgeIDERuntimePreview {
  public readonly entries = shallowRef<RuntimePreviewInstance[]>([])
  public readonly selectedEntryKey = ref<string | null>(null)
  public readonly selectedEntry = computed(() => this.get(this.selectedEntryKey.value))
  public readonly selectedNode = computed(() => this.selectedEntry.value?.selectedNode.value ?? null)

  private readonly _instances = new Map<string, RuntimePreviewInstance>()
  private _runtimeOff: (() => void) | null = null
  private _scopeOff: (() => void) | null = null
  private _surfaceOff: (() => void) | null = null
  private _initialized = false

  public init(): void {
    if (this._initialized) { return }
    this._runtimeOff = Endge.runtime.subscribe(() => this._refresh())
    this._scopeOff = Endge.runtime.scopes.subscribe(() => this._refresh())
    this._surfaceOff = EndgeIDEContext.registerSurface('endge-ide-runtime-preview', {
      beforeContextReset: () => this.disposeAll(),
      afterContextBoot: () => this._restoreRememberedEntries(),
    })
    this._restoreRememberedEntries()
    this._initialized = true
  }

  public reset(): void {
    this._runtimeOff?.()
    this._scopeOff?.()
    this._surfaceOff?.()
    this._runtimeOff = null
    this._scopeOff = null
    this._surfaceOff = null
    this._initialized = false
    void this.disposeAll()
  }

  public async launch(rawTarget: RuntimePreviewLaunchRequest): Promise<boolean> {
    return this._launch(rawTarget, true)
  }

  /** Launches persisted document targets in selection order and reveals the tree once after the batch. */
  public async launchAll(rawTargets: readonly RuntimePreviewLaunchRequest[]): Promise<number> {
    const targets = [...new Map(rawTargets.map(target => [runtimePreviewKey(target), target])).values()]
    let launched = 0
    for (const target of targets) {
      if (await this._launch(target, false)) { launched += 1 }
    }
    showWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
    return launched
  }

  private async _launch(rawTarget: RuntimePreviewLaunchRequest, revealTree: boolean): Promise<boolean> {
    const identity = String(rawTarget.identity ?? '').trim()
    if (!identity) {
      toast.error('Невозможно запустить Runtime Preview', { description: 'У документа отсутствует identity.' })
      return false
    }
    const target = { entityType: rawTarget.entityType, identity } as const
    const validation = validateRuntimePreviewContext(target)
    if (!validation.valid) {
      toast.error(validation.message ?? 'Runtime Preview недоступен', { description: validation.description })
      return false
    }

    const key = runtimePreviewKey(target)
    let instance = this._instances.get(key)
    if (!instance) {
      instance = new RuntimePreviewInstance(target)
      this._instances.set(key, instance)
      this._syncEntries()
      this._persistEntries()
    }
    this.selectedEntryKey.value = key
    if (revealTree) { showWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID) }
    try {
      await instance.launch(rawTarget.draft)
      return true
    }
    catch (error) {
      toast.error('Не удалось запустить Runtime Preview', {
        description: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /** Launches the active editor only when its document type has a runtime contract. */
  public launchEditor(editor: unknown): Promise<boolean> {
    const request = createRuntimePreviewLaunchRequest(editor)
    return request ? this.launch(request) : Promise.resolve(false)
  }

  public canLaunchEditor(editor: unknown): boolean {
    return createRuntimePreviewLaunchRequest(editor) != null
  }

  /** Escape navigation: leave Runtime Preview without stopping its runtimes. */
  public returnToProject(): boolean {
    const area = getLayoutState().widgets.value.areas.left
    if (!area.expanded || area.activeWidget !== ENDGE_IDE_RUNTIME_TREE_WIDGET_ID) { return false }
    showWidget('project')
    return true
  }

  public get(key: string | null): RuntimePreviewInstance | null {
    return key ? this._instances.get(key) ?? null : null
  }

  public async select(entryKey: string, nodeId: string): Promise<void> {
    const instance = this.get(entryKey)
    if (!instance) { return }
    this.selectedEntryKey.value = entryKey
    await instance.select(nodeId)
  }

  public lifecycleState(entryKey: string, node: RuntimePreviewTreeNode): RuntimePreviewLifecycleState {
    return this.get(entryKey)?.lifecycleState(node) ?? 'disposed'
  }

  public async pause(instanceId: string): Promise<void> {
    await this.get(instanceId)?.pause()
  }

  public async resume(instanceId: string): Promise<void> {
    await this.get(instanceId)?.resume()
  }

  public async stop(instanceId: string): Promise<void> {
    await this.get(instanceId)?.stop()
  }

  public async restart(instanceId: string): Promise<void> {
    await this.get(instanceId)?.restart()
  }

  public async remove(instanceId: string): Promise<void> {
    const instance = this.get(instanceId)
    if (!instance) { return }
    await instance.dispose()
    this._instances.delete(instanceId)
    if (this.selectedEntryKey.value === instanceId) { this.selectedEntryKey.value = this.entries.value.find(item => item.key !== instanceId)?.key ?? null }
    this._syncEntries()
    this._persistEntries()
  }

  public async pauseAll(): Promise<void> {
    await Promise.all(this.entries.value.map(instance => instance.pause()))
  }

  /** Starts every idle root and resumes roots paused by the user. */
  public async startAll(): Promise<void> {
    await Promise.all(this.entries.value.map((instance) => {
      if (instance.status.value === 'paused') { return instance.resume() }
      if (instance.status.value === 'inactive' || instance.status.value === 'stopped' || instance.status.value === 'error') {
        return instance.restart()
      }
      return Promise.resolve()
    }))
  }

  public async stopAll(): Promise<void> {
    await Promise.all(this.entries.value.map(instance => instance.stop()))
  }

  /** Removes every remembered root and disposes any runtime still owned by it. */
  public async removeAll(): Promise<void> {
    await this.disposeAll()
    writeRuntimePreviewHistory([])
  }

  public async pauseNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.pauseNode(nodeId)
  }

  public async resumeNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.resumeNode(nodeId)
  }

  public async stopNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.stopNode(nodeId)
  }

  public async restartNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.restartNode(nodeId)
  }

  public async pauseSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) { await instance.pauseNode(node.id) }
  }

  public async resumeSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) { await instance.resumeNode(node.id) }
  }

  public async stopSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) { await instance.stopNode(node.id) }
  }

  public async restartSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) { await instance.restartNode(node.id) }
  }

  public async disposeAll(): Promise<void> {
    const instances = [...this._instances.values()]
    this._instances.clear()
    this.entries.value = []
    this.selectedEntryKey.value = null
    await Promise.all(instances.map(instance => instance.dispose()))
  }

  private _refresh(): void {
    for (const instance of this._instances.values()) { instance.refresh() }
  }

  private _syncEntries(): void {
    this.entries.value = [...this._instances.values()]
  }

  private _restoreRememberedEntries(): void {
    if (this._instances.size > 0) { return }
    for (const target of readRuntimePreviewHistory()) {
      const instance = new RuntimePreviewInstance(target)
      this._instances.set(instance.key, instance)
    }
    this._syncEntries()
  }

  private _persistEntries(): void {
    writeRuntimePreviewHistory(this.entries.value.map(instance => instance.target))
  }
}
