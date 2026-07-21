/* eslint-disable style/max-statements-per-line, ts/naming-convention */
import type {
  RuntimePreviewCompositionAddress,
  RuntimePreviewDraft,
  RuntimePreviewLifecycleState,
  RuntimePreviewRenderable,
  RuntimePreviewTarget,
  RuntimePreviewTreeNode,
} from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { ComponentPreviewContext } from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import type {
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  CompositionSession,
  EndgeStyleSheetArtifact,
  ProgramArtifact,
  ProjectRuntimeSession,
  RuntimeHost,
  StoreRuntimeHost,
} from '@endge/core'

import { Endge, materializeCompositionPreviewProps, RComponentSFC } from '@endge/core'
import { materializeEndgeCSSForDOM } from '@endge/ui-vue'
import { computed, ref, shallowRef } from 'vue'

import { runtimePreviewKey } from '@/features/endge-ide/domain/types/runtime-preview.types'
import {
  createPreviewComposition,
  ensureCompositionRuntimeArtifacts,
  materializeCompositionRuntimePreviewSource,
  resolvePreviewStoreRuntimes,
} from '@/features/endge-ide/model/composition-preview/composition-preview-state'
import {
  destroyComponentPreviewContext,
  prepareComponentPreviewContext,
  resolveComponentPreviewInput,
} from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import { buildRuntimePreviewTree } from '@/features/endge-ide/model/runtime-preview/runtime-preview-tree-builder'
import {
  createPreviewArtifact,
  ensurePreviewPortArtifacts,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'
import {
  createPreviewStore,
  createPreviewStoreArtifact,
} from '@/features/endge-ide/model/store-preview/store-preview-state'

/** Owns one explicitly launched preview root and all runtime resources below it. */
export class RuntimePreviewInstance {
  public readonly key: string
  public readonly target: RuntimePreviewTarget
  public readonly tree = shallowRef<RuntimePreviewTreeNode[]>([])
  public readonly selectedNodeId = ref<string | null>(null)
  public readonly renderables = shallowRef<RuntimePreviewRenderable[]>([])
  public readonly status = ref<RuntimePreviewLifecycleState>('inactive')
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
  private _componentContext: ComponentPreviewContext | null = null
  private _store: StoreRuntimeHost | null = null
  private _draft: RuntimePreviewDraft | null = null
  private _draftStyleElement: HTMLStyleElement | null = null
  private _generation = 0
  private _queue: Promise<void> = Promise.resolve()

  public constructor(target: RuntimePreviewTarget) {
    this.target = target
    this.key = runtimePreviewKey(target)
    this.tree.value = buildRuntimePreviewTree(target)
    this.selectedNodeId.value = this.tree.value[0]?.id ?? null
  }

  /** Replaces any previous generation of this document with a fresh runtime tree. */
  public launch(draft?: RuntimePreviewDraft): Promise<void> {
    if (arguments.length > 0) { this._draft = draft ?? null }
    const generation = ++this._generation
    const pending = this._queue
      .catch(() => undefined)
      .then(() => this.performLaunch(generation))
    this._queue = pending.catch(() => undefined)
    return pending
  }

  private async performLaunch(generation: number): Promise<void> {
    if (generation !== this._generation) { return }
    this.status.value = 'preparing'
    this.error.value = null
    await this.disposeRuntime()
    if (generation !== this._generation) { return }
    this.tree.value = buildRuntimePreviewTree(this.target)
    this.selectedNodeId.value = this.tree.value[0]?.id ?? null
    try {
      if (this.target.entityType === 'project') {
        this._project = await Endge.runtime.project.mount(this.target.identity, { autoActivate: 'none' })
        for (const handle of this._project.compositions.getAll()) { await handle.activate() }
      }
      else if (this.target.entityType === 'composition') {
        if (this._draft) {
          this._composition = await this.mountDraftComposition(this._draft)
        }
        else {
          const artifact = Endge.program.getCompositionArtifact(this.target.identity)
          const props = materializeCompositionPreviewProps(artifact?.payload.previewProps)
          this._composition = await Endge.runtime.composition.mount(this.target.identity, { props })
        }
      }
      else if (this.target.entityType === 'component-sfc') {
        this._component = await this.mountComponent(this.target.identity, this._draft)
      }
      else {
        this._store = await this.mountStore(this.target.identity, this._draft)
      }
      if (generation !== this._generation) {
        await this.disposeRuntime()
        return
      }
      this.status.value = 'active'
      this.refresh()
    }
    catch (error) {
      await this.disposeRuntime()
      if (generation !== this._generation) { return }
      this.status.value = 'error'
      this.error.value = error instanceof Error ? error.message : String(error)
      this.refresh()
      throw error
    }
  }

  public async select(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    this.selectedNodeId.value = node.id
    this.error.value = null
    if (this.status.value === 'inactive' || this.status.value === 'stopped' || this.status.value === 'error' || this.status.value === 'preparing') {
      this.refresh()
      return
    }
    try {
      await this.activateNode(node)
      this.refresh()
    }
    catch (error) {
      this.error.value = error instanceof Error ? error.message : String(error)
      this.refresh()
    }
  }

  public lifecycleState(node: RuntimePreviewTreeNode): RuntimePreviewLifecycleState {
    void this.revision.value
    if (node.parentId == null) { return this.status.value }
    try {
      if (!node.composition) { return 'inactive' }
      if (node.kind === 'composition') { return this.compositionState(node.composition) }
      const composition = this.resolveComposition(node.composition)
      if (!composition) { return 'inactive' }
      if (node.kind === 'scope' || node.kind === 'resource') { return scopeState(composition.getScope(node.scopePath ?? '')) }
      return handleState(composition.getRuntimeHandle(node.runtimePath ?? '')?.state)
    }
    catch {
      return 'error'
    }
  }

  public async pause(): Promise<void> {
    await this.waitForCurrentOperation()
    if (this.status.value !== 'active') { return }
    if (this._project) {
      for (const handle of this._project.compositions.getAll()) {
        if (handle.state === 'active') { await handle.pause() }
      }
    }
    else if (this._composition) {
      await this._composition.host.getScope('scope_default')?.pause()
    }
    else if (this._component) {
      await this._component.pause()
    }
    else if (this._store) {
      await this._store.pause()
    }
    this.status.value = 'paused'
    this.refresh()
  }

  public async resume(): Promise<void> {
    await this.waitForCurrentOperation()
    if (this.status.value !== 'paused') { return }
    if (this._project) {
      for (const handle of this._project.compositions.getAll()) {
        if (handle.state === 'paused') { await handle.resume() }
      }
    }
    else if (this._composition) {
      await this._composition.host.getScope('scope_default')?.activate()
    }
    else if (this._component) {
      await this._component.resume()
    }
    else if (this._store) {
      await this._store.resume()
    }
    this.status.value = 'active'
    this.refresh()
  }

  public async stop(): Promise<void> {
    const generation = ++this._generation
    const pending = this._queue
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this._generation) { return }
        await this.disposeRuntime()
        if (generation !== this._generation) { return }
        this.status.value = 'stopped'
        this.error.value = null
        this.refresh()
      })
    this._queue = pending.catch(() => undefined)
    await pending
  }

  public restart(): Promise<void> {
    return this.launch()
  }

  public async dispose(): Promise<void> {
    const generation = ++this._generation
    const pending = this._queue
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this._generation) { return }
        await this.disposeRuntime()
        this.status.value = 'disposed'
        this.refresh()
      })
    this._queue = pending.catch(() => undefined)
    await pending
  }

  public async pauseNode(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    if (node.parentId == null) { return this.pause() }
    await this.controlNode(node, 'pause')
  }

  public async resumeNode(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    if (node.parentId == null) { return this.resume() }
    await this.activateNode(node)
    this.refresh()
  }

  public async stopNode(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    if (node.parentId == null) { return this.stop() }
    await this.controlNode(node, 'deactivate')
  }

  public async restartNode(nodeId: string): Promise<void> {
    const node = this.findNode(nodeId)
    if (!node) { return }
    if (node.parentId == null) { return this.restart() }
    await this.controlNode(node, 'deactivate')
    await this.activateNode(node)
    this.refresh()
  }

  public refresh(): void {
    this.revision.value += 1
    this.refreshRenderables()
  }

  private async waitForCurrentOperation(): Promise<void> {
    await this._queue.catch(() => undefined)
  }

  private async mountComponent(identity: string, draft: RuntimePreviewDraft | null): Promise<ComponentSFCRuntimeHost> {
    const model = draft
      ? RComponentSFC.fromPlain({
          id: draft.id ?? identity,
          identity,
          tag: draft.tag,
          name: draft.name || draft.displayName || identity,
          displayName: draft.displayName || draft.name || identity,
          source: draft.source,
        })
      : Endge.domain.getComponentSFC(identity)
    const artifact = draft && model
      ? createPreviewArtifact(model)
      : Endge.program.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
    if (!model || !artifact || artifact.status === 'error') { throw new Error(`[RuntimePreview] Component SFC "${identity}" is unavailable.`) }
    const previewProps = artifact.payload.previewProps ?? {}
    ensurePreviewPortArtifacts(artifact.payload)
    this.applyDraftStyle(draft ? artifact.payload.ir?.style ?? null : null)
    const context = await prepareComponentPreviewContext(
      artifact.payload.previewOptions,
      previewProps,
      model,
      {
        contextSuffix: 'debug-sfc-context',
        meta: { mode: 'debug-preview' },
      },
    )
    try {
      const input = resolveComponentPreviewInput(
        previewProps,
        context,
        `runtime-preview.sfc.${encodeURIComponent(identity)}.props`,
      )
      const runtime = Endge.runtime.execute(model, {
        parent: context?.host ?? null,
        ...(draft ? { artifactReader: createOverlayArtifactReader(artifact) } : {}),
        persistence: 'disabled',
        meta: { mode: 'debug-preview', target: 'dom', input },
      }) as ComponentSFCRuntimeHost | null
      if (!runtime) { throw new Error(`[RuntimePreview] Component SFC "${identity}" cannot be mounted.`) }
      this._componentContext = context
      return runtime
    }
    catch (error) {
      await destroyComponentPreviewContext(context)
      throw error
    }
  }

  private async mountStore(identity: string, draft: RuntimePreviewDraft | null): Promise<StoreRuntimeHost> {
    const model = draft ? createPreviewStore(draft, identity) : Endge.domain.getStore(identity)
    const artifact = draft && model ? createPreviewStoreArtifact(model) : Endge.program.getStoreArtifact(identity)
    if (!model || !artifact || artifact.status === 'error') { throw new Error(`[RuntimePreview] Store "${identity}" is unavailable.`) }
    const runtime = Endge.runtime.execute(model, {
      ...(draft ? { artifactReader: createOverlayArtifactReader(artifact) } : {}),
      persistence: 'disabled',
      meta: { mode: 'debug-preview' },
    }) as StoreRuntimeHost | null
    if (!runtime) { throw new Error(`[RuntimePreview] Store "${identity}" cannot be mounted.`) }
    return runtime
  }

  private async mountDraftComposition(draft: RuntimePreviewDraft): Promise<CompositionSession> {
    await Endge.build()
    ensureCompositionRuntimeArtifacts(draft.source, new Set([this.target.identity]))
    const model = createPreviewComposition({
      ...draft,
      identity: this.target.identity,
      source: materializeCompositionRuntimePreviewSource(draft.source),
    })
    const artifact = Endge.compiler.buildComposition(model)
    if (artifact.status === 'error') {
      throw new Error(artifact.diagnostics.find(item => item.severity === 'error')?.message
        ?? 'Composition source содержит ошибки.')
    }
    const host = Endge.runtime.execute(model, {
      persistence: 'disabled',
      meta: {
        mode: 'debug-preview',
        dataRuntimes: resolvePreviewStoreRuntimes(artifact.payload.data),
        input: {
          kind: 'local',
          props: materializeCompositionPreviewProps(artifact.payload.previewProps),
        },
      },
    }) as CompositionRuntimeHost | null
    if (!host) { throw new Error(`[RuntimePreview] Composition "${this.target.identity}" cannot be mounted.`) }
    try {
      await host.mountGraph()
    }
    catch (error) {
      await Endge.runtime.destroyRuntimeTreeAsync(host.id)
      throw error
    }
    let mounted = true
    return {
      id: host.id,
      host,
      outputs: host.getOutputs(),
      output: <T = unknown>(name: string) => host.getOutput(name) as T | undefined,
      unmount: async () => {
        if (!mounted) { return }
        mounted = false
        await host.getScope('scope_default')?.dispose()
        await Endge.runtime.destroyRuntimeTreeAsync(host.id)
      },
    }
  }

  private applyDraftStyle(style: EndgeStyleSheetArtifact | null): void {
    this._draftStyleElement?.remove()
    this._draftStyleElement = null
    if (!style || typeof document === 'undefined') { return }
    const element = document.createElement('style')
    element.dataset.endgeRuntimePreviewStyles = this.key
    element.textContent = materializeEndgeCSSForDOM([style]).css
    document.head.append(element)
    this._draftStyleElement = element
  }

  private async activateNode(node: RuntimePreviewTreeNode): Promise<void> {
    if (node.parentId == null) { return }
    if (!node.composition) { return }
    const composition = await this.resolveCompositionAsync(node.composition)
    if (node.kind === 'composition') { await composition.getScope('scope_default')?.activate() }
    else if (node.kind === 'scope' || node.kind === 'resource') { await composition.getScope(node.scopePath ?? '')?.activate() }
    else if (node.kind === 'runtime') { await composition.getRuntimeHandle(node.runtimePath ?? '')?.activate() }
  }

  private async controlNode(node: RuntimePreviewTreeNode, operation: 'pause' | 'deactivate'): Promise<void> {
    if (!node.composition || node.kind === 'resource') { return }
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
    const composition = this.resolveComposition(node.composition)
    if (!composition) { return }
    if (node.kind === 'scope') {
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
      const parent = this.resolveComposition(parentAddress)
      const runtimePath = node.composition.invocationPath.at(-1) ?? ''
      const handle = parent?.getRuntimeHandle(runtimePath)
      if (operation === 'pause') {
        await handle?.pause()
      }
      else { await handle?.deactivate() }
    }
    this.refresh()
  }

  private async resolveCompositionAsync(address: RuntimePreviewCompositionAddress): Promise<CompositionRuntimeHost> {
    let host: CompositionRuntimeHost
    if (this._project) {
      host = (await this._project.compositions.require(address.rootIdentity).activate()).host
    }
    else if (this._composition?.host.entityIdentity === address.rootIdentity) {
      host = this._composition.host
    }
    else { throw new Error(`[RuntimePreview] Root Composition "${address.rootIdentity}" is inactive.`) }
    for (const path of address.invocationPath) {
      const nested = await host.getRuntimeHandle(path)?.activate()
      if (!nested || nested.entityType !== 'composition') { throw new Error(`[RuntimePreview] Nested Composition runtime "${path}" is unavailable.`) }
      host = nested as CompositionRuntimeHost
    }
    return host
  }

  private resolveComposition(address: RuntimePreviewCompositionAddress): CompositionRuntimeHost | null {
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

  private compositionState(address: RuntimePreviewCompositionAddress): RuntimePreviewLifecycleState {
    if (!address.invocationPath.length) {
      if (this._project) { return handleState(this._project.compositions.get(address.rootIdentity)?.state) }
      return scopeState(this._composition?.host.getScope('scope_default') ?? null)
    }
    const parent = this.resolveComposition({ ...address, invocationPath: address.invocationPath.slice(0, -1) })
    return handleState(parent?.getRuntimeHandle(address.invocationPath.at(-1) ?? '')?.state)
  }

  private refreshRenderables(): void {
    const selected = this.selectedNode.value
    if (!selected || this.status.value === 'stopped' || this.status.value === 'error' || this.status.value === 'preparing') {
      this.renderables.value = []
      return
    }
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
      const composition = this.resolveComposition(selected.composition)
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

  private collectInactiveRenderableChildren(node: RuntimePreviewTreeNode): RuntimePreviewTreeNode[] {
    if (node.kind !== 'composition' && node.kind !== 'scope' && node.kind !== 'project') { return [] }
    const result: RuntimePreviewTreeNode[] = []
    const visit = (current: RuntimePreviewTreeNode) => {
      for (const child of current.children) {
        if (child.kind === 'composition') { continue }
        if (child.renderable && this.lifecycleState(child) === 'inactive') { result.push(child) }
        if (child.kind === 'scope') { visit(child) }
      }
    }
    visit(node)
    return result
  }

  public findNode(id: string | null): RuntimePreviewTreeNode | null {
    if (!id) { return null }
    const visit = (nodes: RuntimePreviewTreeNode[]): RuntimePreviewTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) { return node }
        const found = visit(node.children)
        if (found) { return found }
      }
      return null
    }
    return visit(this.tree.value)
  }

  private async disposeRuntime(): Promise<void> {
    const project = this._project
    const composition = this._composition
    const component = this._component
    const componentContext = this._componentContext
    const store = this._store
    this._project = null
    this._composition = null
    this._component = null
    this._componentContext = null
    this._store = null
    this._draftStyleElement?.remove()
    this._draftStyleElement = null
    this.renderables.value = []
    if (project) { await project.unmount().catch(() => {}) }
    if (composition) { await composition.unmount().catch(() => {}) }
    if (componentContext) { await destroyComponentPreviewContext(componentContext).catch(() => {}) }
    if (component && Endge.runtime.getRuntimeById(component.id)) { await Endge.runtime.destroyRuntimeTreeAsync(component.id).catch(() => {}) }
    if (store && Endge.runtime.getRuntimeById(store.id)) { await Endge.runtime.destroyRuntimeTreeAsync(store.id).catch(() => {}) }
  }
}

function createOverlayArtifactReader(root: ProgramArtifact<unknown>) {
  return {
    getArtifact: <TPayload>(entityType: string, id: string | number) => {
      const matchesRoot = entityType === root.ref.entityType
        && (String(id) === String(root.ref.id) || String(id) === root.ref.identity)
      return (matchesRoot ? root : Endge.program.getArtifact(entityType as any, id)) as ProgramArtifact<TPayload> | null
    },
  }
}

function handleState(state: string | undefined): RuntimePreviewLifecycleState {
  if (state === 'active') { return 'active' }
  if (state === 'paused') { return 'paused' }
  if (state === 'disposed') { return 'disposed' }
  return 'inactive'
}

function scopeState(scope: { state: string } | null): RuntimePreviewLifecycleState {
  if (!scope) { return 'inactive' }
  if (scope.state === 'active') { return 'active' }
  if (scope.state === 'paused') { return 'paused' }
  if (scope.state === 'activating' || scope.state === 'resuming') { return 'activating' }
  if (scope.state === 'pausing' || scope.state === 'deactivating') { return 'pausing' }
  if (scope.state === 'error') { return 'error' }
  if (scope.state === 'disposed') { return 'disposed' }
  return 'inactive'
}

function isPreviewRenderableActive(host: RuntimeHost<any, any>): boolean {
  return !['paused', 'pausing', 'stopping', 'stopped', 'unmounted', 'destroyed', 'error'].includes(host.status)
}

function toRenderable(runtime: RuntimeHost<any, any>, index: number): RuntimePreviewRenderable {
  if (runtime.runtimeType === 'filter-view-runtime-host') { return { kind: 'filter-view', key: runtime.id, title: runtime.title, runtime: runtime as any } }
  if (runtime.entityType === 'component-sfc') {
    const component = runtime as ComponentSFCRuntimeHost
    return {
      kind: 'component-sfc',
      key: runtime.id,
      title: runtime.title,
      runtime: component,
      input: component.getInputSource() ?? { kind: 'local', props: {} },
    }
  }
  if (runtime.entityType === 'store') { return { kind: 'store', key: runtime.id, title: runtime.title, runtime: runtime as StoreRuntimeHost } }
  return { kind: 'runtime', key: `${runtime.id}:${index}`, title: runtime.title, runtime }
}
