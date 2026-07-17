/* eslint-disable style/max-statements-per-line, ts/naming-convention */
import type {
  EndgePreviewTarget,
  PreviewCompositionAddress,
  PreviewLifecycleState,
  PreviewRenderable,
  PreviewRuntimeTreeNode,
} from '@/features/endge-preview/domain/types/preview.types'
import type {
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  CompositionSession,
  ProjectRuntimeSession,
  RuntimeHost,
  StoreRuntimeHost,
} from '@endge/core'

import { Endge } from '@endge/core'
import { computed, ref, shallowRef } from 'vue'

import { EndgeConfigurator } from '@/features/endge-configurator/model/endge-configurator'
import { buildPreviewRuntimeTree } from '@/features/endge-preview/model/tree/preview-runtime-tree-builder'

export class EndgePreviewSession {
  public readonly target = shallowRef<EndgePreviewTarget | null>(null)
  public readonly tree = shallowRef<PreviewRuntimeTreeNode[]>([])
  public readonly selectedNodeId = ref<string | null>(null)
  public readonly renderables = shallowRef<PreviewRenderable[]>([])
  public readonly status = ref<'idle' | 'preparing' | 'active' | 'error'>('idle')
  public readonly error = shallowRef<string | null>(null)
  public readonly revision = ref(0)
  public readonly selectedNode = computed(() => this.findNode(this.selectedNodeId.value))
  public readonly inactiveRenderableChildren = computed(() => {
    void this.revision.value
    const selected = this.selectedNode.value
    return selected ? this.collectInactiveRenderableChildren(selected) : []
  })

  private _project: ProjectRuntimeSession | null = null
  private _composition: CompositionSession | null = null
  private _component: ComponentSFCRuntimeHost | null = null
  private _store: StoreRuntimeHost | null = null
  private _focusedRootComposition: string | null = null
  private _generation = 0
  private _openQueue: Promise<void> = Promise.resolve()
  private _runtimeOff: (() => void) | null = null
  private _scopeOff: (() => void) | null = null
  private _surfaceOff: (() => void) | null = null

  public init(): void {
    this._runtimeOff ??= Endge.runtime.subscribe(() => this.refresh())
    this._scopeOff ??= Endge.runtime.scopes.subscribe(() => this.refresh())
    this._surfaceOff ??= EndgeConfigurator.registerSurface('endge-preview', {
      beforeContextReset: () => this.suspendForContextReset(),
      afterContextBoot: () => this.reopen(),
    })
  }

  public reset(): void {
    this._runtimeOff?.()
    this._scopeOff?.()
    this._surfaceOff?.()
    this._runtimeOff = null
    this._scopeOff = null
    this._surfaceOff = null
    void this.disposeRuntime(true)
  }

  public async open(target: EndgePreviewTarget): Promise<void> {
    const generation = ++this._generation
    const pending = this._openQueue
      .catch(() => undefined)
      .then(() => this.performOpen(target, generation))
    this._openQueue = pending.catch(() => undefined)
    return pending
  }

  private async performOpen(target: EndgePreviewTarget, generation: number): Promise<void> {
    if (generation !== this._generation) { return }
    const normalized: EndgePreviewTarget = {
      entityType: target.entityType,
      identity: String(target.identity ?? '').trim(),
    }
    if (!normalized.identity) { throw new Error('[EndgePreview] target identity is required.') }
    this.status.value = 'preparing'
    this.error.value = null
    await this.disposeRuntime(false)
    this.target.value = normalized
    try {
      if (normalized.entityType === 'project') { this._project = await Endge.runtime.project.mount(normalized.identity) }
      else if (normalized.entityType === 'composition') { this._composition = await Endge.runtime.composition.mount(normalized.identity) }
      else if (normalized.entityType === 'component-sfc') { this._component = await this.mountComponent(normalized.identity) }
      else { this._store = await this.mountStore(normalized.identity) }
      if (generation !== this._generation) { return }
      this.tree.value = buildPreviewRuntimeTree(normalized)
      this.selectedNodeId.value = this.tree.value[0]?.id ?? null
      this.status.value = 'active'
      this.refreshRenderables()
    }
    catch (error) {
      if (generation !== this._generation) { return }
      this.status.value = 'error'
      this.error.value = error instanceof Error ? error.message : String(error)
      this.tree.value = buildPreviewRuntimeTree(normalized)
      throw error
    }
  }

  public async reopen(): Promise<void> {
    const target = this.target.value
    if (target) { await this.open(target) }
  }

  public async select(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    this.error.value = null
    try {
      await this.activateNode(node)
      this.selectedNodeId.value = node.id
      this.refresh()
    }
    catch (error) {
      this.error.value = error instanceof Error ? error.message : String(error)
    }
  }

  public lifecycleState(node: PreviewRuntimeTreeNode): PreviewLifecycleState {
    void this.revision.value
    try {
      if (node.kind === 'project') { return this._project ? 'active' : 'inactive' }
      if (node.kind === 'component-sfc') { return hostState(this._component) }
      if (node.entityType === 'store' && !node.composition) { return hostState(this._store) }
      if (!node.composition) { return 'inactive' }
      if (node.kind === 'composition') { return this.compositionState(node.composition) }
      const composition = this.resolveComposition(node.composition, false)
      if (!composition) { return 'inactive' }
      if (node.kind === 'scope') { return scopeState(composition.getScope(node.scopePath ?? '')) }
      if (node.kind === 'resource') { return scopeState(composition.getScope(node.scopePath ?? '')) }
      return handleState(composition.getRuntimeHandle(node.runtimePath ?? '')?.state)
    }
    catch { return 'error' }
  }

  public async pauseSelected(): Promise<void> {
    const node = this.selectedNode.value
    if (!node) { return }
    await this.controlNode(node, 'pause')
  }

  public async resumeSelected(): Promise<void> {
    const node = this.selectedNode.value
    if (!node) { return }
    await this.activateNode(node)
    this.refresh()
  }

  public async stopSelected(): Promise<void> {
    const node = this.selectedNode.value
    if (!node) { return }
    await this.controlNode(node, 'deactivate')
  }

  public async restartSelected(): Promise<void> {
    await this.stopSelected()
    await this.resumeSelected()
  }

  public async dispose(): Promise<void> {
    this._generation += 1
    await this._openQueue.catch(() => undefined)
    await this.disposeRuntime(true)
    this._runtimeOff?.()
    this._scopeOff?.()
    this._surfaceOff?.()
    this._runtimeOff = this._scopeOff = this._surfaceOff = null
  }

  private async suspendForContextReset(): Promise<void> {
    this._generation += 1
    await this._openQueue.catch(() => undefined)
    await this.disposeRuntime(false)
  }

  private async mountComponent(identity: string): Promise<ComponentSFCRuntimeHost> {
    const model = Endge.domain.getComponentSFC(identity)
    const artifact = Endge.program.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
    if (!model || !artifact || artifact.status === 'error') { throw new Error(`[EndgePreview] Component SFC "${identity}" is unavailable.`) }
    const props = artifact.payload.previewProps ?? {}
    const runtime = Endge.runtime.execute(model, {
      persistence: 'disabled',
      meta: { target: 'dom', input: { kind: 'local', props } },
    }) as ComponentSFCRuntimeHost | null
    if (!runtime) { throw new Error(`[EndgePreview] Component SFC "${identity}" cannot be mounted.`) }
    return runtime
  }

  private async mountStore(identity: string): Promise<StoreRuntimeHost> {
    const model = Endge.domain.getStore(identity)
    const artifact = Endge.program.getStoreArtifact(identity)
    if (!model || !artifact || artifact.status === 'error') { throw new Error(`[EndgePreview] Store "${identity}" is unavailable.`) }
    const runtime = Endge.runtime.execute(model, {
      persistence: 'disabled',
      meta: { mode: 'debug-preview' },
    }) as StoreRuntimeHost | null
    if (!runtime) { throw new Error(`[EndgePreview] Store "${identity}" cannot be mounted.`) }
    return runtime
  }

  private async activateNode(node: PreviewRuntimeTreeNode): Promise<void> {
    if (node.kind === 'project') { return }
    if (node.kind === 'component-sfc') {
      if (!this._component) { this._component = await this.mountComponent(node.identity) }
      else if (this._component.status === 'paused') { await this._component.resume() }
      return
    }
    if (node.entityType === 'store' && !node.composition) {
      if (!this._store) { this._store = await this.mountStore(node.identity) }
      else if (this._store.status === 'paused') { await this._store.resume() }
      return
    }
    if (!node.composition) { return }
    if (this._project && this._focusedRootComposition !== node.composition.rootIdentity) {
      if (this._focusedRootComposition) { await this._project.compositions.get(this._focusedRootComposition)?.pause() }
      await this._project.compositions.require(node.composition.rootIdentity).activate()
      this._focusedRootComposition = node.composition.rootIdentity
    }
    const composition = await this.resolveCompositionAsync(node.composition)
    if (node.kind === 'composition') { await composition.getScope('scope_default')?.activate() }
    else if (node.kind === 'scope' || node.kind === 'resource') { await composition.getScope(node.scopePath ?? '')?.activate() }
    else if (node.kind === 'runtime') { await composition.getRuntimeHandle(node.runtimePath ?? '')?.activate() }
  }

  private async controlNode(node: PreviewRuntimeTreeNode, operation: 'pause' | 'deactivate'): Promise<void> {
    if (node.kind === 'project') { return }
    if (node.kind === 'component-sfc') {
      if (operation === 'pause') {
        await this._component?.pause()
      }
      else if (this._component) {
        await Endge.runtime.destroyRuntimeTreeAsync(this._component.id)
        this._component = null
      }
      this.refresh()
      return
    }
    if (node.entityType === 'store' && !node.composition) {
      if (operation === 'pause') {
        await this._store?.pause()
      }
      else if (this._store) {
        await Endge.runtime.destroyRuntimeTreeAsync(this._store.id)
        this._store = null
      }
      this.refresh()
      return
    }
    if (!node.composition) { return }
    if (node.kind === 'composition' && node.composition.invocationPath.length === 0 && this._project) {
      const handle = this._project.compositions.require(node.composition.rootIdentity)
      if (operation === 'pause') {
        await handle.pause()
      }
      else { await handle.deactivate() }
      this.refresh()
      return
    }
    if (node.kind === 'composition' && node.composition.invocationPath.length === 0 && this._composition) {
      const scope = this._composition.host.getScope('scope_default')
      if (operation === 'pause') {
        await scope?.pause()
      }
      else { await scope?.deactivate() }
      this.refresh()
      return
    }
    const composition = this.resolveComposition(node.composition, false)
    if (!composition) { return }
    if (node.kind === 'scope' || node.kind === 'resource') {
      const scope = composition.getScope(node.scopePath ?? '')
      if (operation === 'pause') {
        await scope?.pause()
      }
      else { await scope?.deactivate() }
    }
    else if (node.kind === 'runtime') {
      const handle = composition.getRuntimeHandle(node.runtimePath ?? '')
      if (operation === 'pause') {
        await handle?.pause()
      }
      else { await handle?.deactivate() }
    }
    else if (node.kind === 'composition' && node.composition.invocationPath.length) {
      const parentAddress = { ...node.composition, invocationPath: node.composition.invocationPath.slice(0, -1) }
      const parent = this.resolveComposition(parentAddress, false)
      const handle = parent?.getRuntimeHandle(node.composition.invocationPath[node.composition.invocationPath.length - 1] ?? '')
      if (operation === 'pause') {
        await handle?.pause()
      }
      else { await handle?.deactivate() }
    }
    this.refresh()
  }

  private async resolveCompositionAsync(address: PreviewCompositionAddress): Promise<CompositionRuntimeHost> {
    let host: CompositionRuntimeHost
    if (this._project) {
      host = (await this._project.compositions.require(address.rootIdentity).activate()).host
    }
    else if (this._composition && this._composition.host.entityIdentity === address.rootIdentity) {
      host = this._composition.host
    }
    else { throw new Error(`[EndgePreview] Root Composition "${address.rootIdentity}" is inactive.`) }
    for (const path of address.invocationPath) {
      const nested = await host.getRuntimeHandle(path)?.activate()
      if (!nested || nested.entityType !== 'composition') { throw new Error(`[EndgePreview] Nested Composition runtime "${path}" is unavailable.`) }
      host = nested as CompositionRuntimeHost
    }
    return host
  }

  private resolveComposition(address: PreviewCompositionAddress, _activate: false): CompositionRuntimeHost | null {
    let host = this._project?.compositions.get(address.rootIdentity)?.host
      ?? (this._composition?.host.entityIdentity === address.rootIdentity ? this._composition.host : null)
    if (!host) { return null }
    for (const path of address.invocationPath) {
      const nested = host.getRuntimeHandle(path)?.runtime
      if (!nested || nested.entityType !== 'composition') { return null }
      host = nested as CompositionRuntimeHost
    }
    return host
  }

  private compositionState(address: PreviewCompositionAddress): PreviewLifecycleState {
    if (!address.invocationPath.length) {
      if (this._project) { return handleState(this._project.compositions.get(address.rootIdentity)?.state) }
      return scopeState(this._composition?.host.getScope('scope_default') ?? null)
    }
    const parent = this.resolveComposition({ ...address, invocationPath: address.invocationPath.slice(0, -1) }, false)
    return handleState(parent?.getRuntimeHandle(address.invocationPath[address.invocationPath.length - 1] ?? '')?.state)
  }

  private refresh(): void {
    this.revision.value += 1
    this.refreshRenderables()
  }

  private refreshRenderables(): void {
    const selected = this.selectedNode.value
    if (!selected) { this.renderables.value = []; return }
    const runtimes: RuntimeHost<any, any>[] = []
    if (selected.kind === 'project') {
      for (const handle of this._project?.compositions.getAll() ?? []) {
        if (handle.state === 'active' && handle.host) { runtimes.push(...this.renderableChildren(handle.host)) }
      }
    }
    else if (selected.kind === 'component-sfc' && this._component && isPreviewRenderableActive(this._component)) {
      runtimes.push(this._component)
    }
    else if (selected.entityType === 'store' && !selected.composition && this._store && isPreviewRenderableActive(this._store)) {
      runtimes.push(this._store)
    }
    else if (selected.composition) {
      const composition = this.resolveComposition(selected.composition, false)
      if (composition) {
        if (selected.kind === 'runtime') {
          const runtime = composition.getRuntimeHandle(selected.runtimePath ?? '')?.runtime
          if (runtime?.hasCapability('renderable') && isPreviewRenderableActive(runtime)) { runtimes.push(runtime) }
        }
        else if (selected.kind === 'composition') {
          runtimes.push(...this.renderableChildren(composition))
        }
        else if (selected.kind === 'scope') {
          runtimes.push(...this.renderableChildren(composition, selected.scopePath))
        }
      }
    }
    this.renderables.value = runtimes.map((runtime, index) => toRenderable(runtime, index))
  }

  private renderableChildren(host: CompositionRuntimeHost, scopePath?: string | null): RuntimeHost<any, any>[] {
    return host.getChildren()
      .filter(child => child.descriptor.kind !== 'composition')
      .filter(child => !scopePath || child.descriptor.scopePath === scopePath || child.descriptor.scopePath.startsWith(`${scopePath}.`))
      .map(child => child.runtime)
      .filter(runtime => runtime.hasCapability('renderable') && isPreviewRenderableActive(runtime))
  }

  private collectInactiveRenderableChildren(node: PreviewRuntimeTreeNode): PreviewRuntimeTreeNode[] {
    if (node.kind !== 'composition' && node.kind !== 'scope' && node.kind !== 'project') { return [] }
    const result: PreviewRuntimeTreeNode[] = []
    const visit = (current: PreviewRuntimeTreeNode) => {
      for (const child of current.children) {
        if (child.kind === 'composition') { continue }
        if (child.renderable && this.lifecycleState(child) === 'inactive') { result.push(child) }
        if (child.kind === 'scope') { visit(child) }
      }
    }
    visit(node)
    return result
  }

  private findNode(id: string | null): PreviewRuntimeTreeNode | null {
    if (!id) { return null }
    const visit = (nodes: PreviewRuntimeTreeNode[]): PreviewRuntimeTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) { return node }
        const found = visit(node.children)
        if (found) { return found }
      }
      return null
    }
    return visit(this.tree.value)
  }

  private async disposeRuntime(clearTarget: boolean): Promise<void> {
    const project = this._project
    const composition = this._composition
    const component = this._component
    const store = this._store
    this._project = null
    this._composition = null
    this._component = null
    this._store = null
    this._focusedRootComposition = null
    this.renderables.value = []
    if (project) { await project.unmount().catch(() => {}) }
    if (composition) { await composition.unmount().catch(() => {}) }
    if (component && Endge.runtime.getRuntimeById(component.id)) { await Endge.runtime.destroyRuntimeTreeAsync(component.id).catch(() => {}) }
    if (store && Endge.runtime.getRuntimeById(store.id)) { await Endge.runtime.destroyRuntimeTreeAsync(store.id).catch(() => {}) }
    if (clearTarget) {
      this.target.value = null
      this.tree.value = []
      this.selectedNodeId.value = null
      this.status.value = 'idle'
      this.error.value = null
    }
  }
}

function handleState(state: string | undefined): PreviewLifecycleState {
  if (state === 'active') { return 'active' }
  if (state === 'paused') { return 'paused' }
  if (state === 'disposed') { return 'disposed' }
  return 'inactive'
}

function scopeState(scope: { state: string } | null): PreviewLifecycleState {
  if (!scope) { return 'inactive' }
  if (scope.state === 'active') { return 'active' }
  if (scope.state === 'paused') { return 'paused' }
  if (scope.state === 'activating' || scope.state === 'resuming') { return 'activating' }
  if (scope.state === 'pausing' || scope.state === 'deactivating') { return 'pausing' }
  if (scope.state === 'error') { return 'error' }
  if (scope.state === 'disposed') { return 'disposed' }
  return 'inactive'
}

function hostState(host: RuntimeHost<any, any> | null): PreviewLifecycleState {
  if (!host) { return 'inactive' }
  if (host.status === 'active' || host.status === 'running') { return 'active' }
  if (host.status === 'paused') { return 'paused' }
  if (host.status === 'pausing' || host.status === 'stopping') { return 'pausing' }
  if (host.status === 'error') { return 'error' }
  if (host.status === 'destroyed') { return 'disposed' }
  return 'inactive'
}

function isPreviewRenderableActive(host: RuntimeHost<any, any>): boolean {
  return host.status !== 'paused'
    && host.status !== 'pausing'
    && host.status !== 'stopping'
    && host.status !== 'stopped'
    && host.status !== 'unmounted'
    && host.status !== 'destroyed'
    && host.status !== 'error'
}

function toRenderable(runtime: RuntimeHost<any, any>, index: number): PreviewRenderable {
  if (runtime.runtimeType === 'filter-view-runtime-host') { return { kind: 'filter-view', key: runtime.id, title: runtime.title, runtime: runtime as any } }
  if (runtime.entityType === 'component-sfc') {
    return {
      kind: 'component-sfc',
      key: runtime.id,
      title: runtime.title,
      runtime: runtime as ComponentSFCRuntimeHost,
      input: (runtime as ComponentSFCRuntimeHost).getInputSource() ?? { kind: 'local', props: {} },
    }
  }
  if (runtime.entityType === 'store') { return { kind: 'store', key: runtime.id, title: runtime.title, runtime: runtime as StoreRuntimeHost } }
  return { kind: 'runtime', key: `${runtime.id}:${index}`, title: runtime.title, runtime }
}
