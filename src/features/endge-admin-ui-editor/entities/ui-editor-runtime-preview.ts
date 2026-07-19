import type { ComponentPreviewContext } from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import type {
  ComponentSFCProgramPayload,
  ComponentSFCRuntimeHost,
  EndgeStyleSheetArtifact,
  ProgramArtifact,
  ProgramDiagnostic,
  RuntimeHostInputSource,
} from '@endge/core'

import { Endge, RComponentSFC } from '@endge/core'
import { materializeEndgeCSSForDOM } from '@endge/ui-vue'
import { ref, shallowRef } from 'vue'

import {
  destroyComponentPreviewContext,
  prepareComponentPreviewContext,
  resolveComponentPreviewInput,
} from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'
import {
  createPreviewArtifact,
  ensurePreviewPortArtifacts,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'

export type UIEditorRuntimePreviewStatus = 'idle' | 'preparing' | 'active' | 'stale' | 'error'

const UI_EDITOR_PREVIEW_IDENTITY = 'ui-editor-demo-component'
const UI_EDITOR_PREVIEW_SCOPE = Endge.runtime.createAppScope({
  id: 'ui-editor-demo-preview',
  rootPath: 'runtime-preview.ui-editor-demo',
  collisionPolicy: 'replace',
  persistence: 'disabled',
})

/** Owns the single disposable runtime rendered by the feature-local Preview panel. */
export class UIEditorRuntimePreviewSession {
  public readonly runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
  public readonly input = shallowRef<RuntimeHostInputSource>({ kind: 'local', props: {} })
  public readonly status = ref<UIEditorRuntimePreviewStatus>('idle')
  public readonly error = shallowRef<string | null>(null)
  public readonly diagnostics = shallowRef<ProgramDiagnostic[]>([])

  private _context: ComponentPreviewContext | null = null
  private _styleElement: HTMLStyleElement | null = null
  private _generation = 0
  private _queue: Promise<void> = Promise.resolve()

  public markStale(): void {
    if (this.runtime.value) {
      this.status.value = 'stale'
    }
  }

  public launch(source: string): Promise<boolean> {
    const generation = ++this._generation
    let launched = false
    const operation = this._queue
      .catch(() => undefined)
      .then(async () => {
        launched = await this._performLaunch(source, generation)
      })
    this._queue = operation.catch(() => undefined)
    return operation.then(() => launched)
  }

  public async dispose(): Promise<void> {
    ++this._generation
    await this._queue.catch(() => undefined)
    await this._disposeCurrent()
    this.status.value = 'idle'
    this.error.value = null
    this.diagnostics.value = []
  }

  private async _performLaunch(source: string, generation: number): Promise<boolean> {
    if (generation !== this._generation) {
      return false
    }
    this.status.value = 'preparing'
    this.error.value = null

    const model = RComponentSFC.fromPlain({
      id: UI_EDITOR_PREVIEW_IDENTITY,
      identity: UI_EDITOR_PREVIEW_IDENTITY,
      name: 'UI Editor Preview',
      displayName: 'UI Editor Preview',
      source,
    })
    const artifact = createPreviewArtifact(model)
    this.diagnostics.value = artifact.diagnostics
    if (artifact.status === 'error') {
      this.error.value = artifact.diagnostics.find(item => item.severity === 'error')?.message
        ?? 'SFC source содержит ошибки.'
      this.status.value = this.runtime.value ? 'stale' : 'error'
      return false
    }

    ensurePreviewPortArtifacts(artifact.payload)
    await this._disposeCurrent()
    if (generation !== this._generation) {
      return false
    }

    const previewProps = artifact.payload.previewProps ?? {}
    const context = await prepareComponentPreviewContext(
      artifact.payload.previewOptions,
      previewProps,
      model,
      {
        appScope: UI_EDITOR_PREVIEW_SCOPE,
        contextSuffix: 'ui-editor-context',
        meta: previewMeta(),
        resolveStoreRuntime: identity => UI_EDITOR_PREVIEW_SCOPE.resolve('store', identity),
      },
    )
    let nextRuntime: ComponentSFCRuntimeHost | null = null
    try {
      const input = resolveComponentPreviewInput(
        previewProps,
        context,
        'runtime-preview.ui-editor-demo.props',
      )
      const runtime = UI_EDITOR_PREVIEW_SCOPE.execute(model, {
        instanceId: 'component',
        parent: context?.host ?? null,
        artifactReader: createOverlayArtifactReader(artifact),
        persistence: 'disabled',
        meta: {
          ...previewMeta(),
          target: 'dom',
          input,
        },
      }) as ComponentSFCRuntimeHost | null
      if (!runtime || runtime.entityType !== 'component-sfc') {
        throw new Error('Не удалось создать UI Editor preview runtime.')
      }
      nextRuntime = runtime
      if (generation !== this._generation) {
        if (context) {
          await destroyComponentPreviewContext(context)
        }
        else {
          await Endge.runtime.destroyRuntimeTreeAsync(runtime.id)
        }
        return false
      }

      this._context = context
      this.runtime.value = runtime
      this.input.value = input
      this._applyStyle(artifact.payload.ir?.style ?? null)
      this.status.value = 'active'
      return true
    }
    catch (error) {
      if (context) {
        await destroyComponentPreviewContext(context)
      }
      else if (nextRuntime && Endge.runtime.getRuntimeById(nextRuntime.id)) {
        await Endge.runtime.destroyRuntimeTreeAsync(nextRuntime.id).catch(() => {})
      }
      this.error.value = error instanceof Error ? error.message : String(error)
      this.status.value = 'error'
      return false
    }
  }

  private async _disposeCurrent(): Promise<void> {
    const context = this._context
    const runtime = this.runtime.value
    this._context = null
    this.runtime.value = null
    this.input.value = { kind: 'local', props: {} }
    this._styleElement?.remove()
    this._styleElement = null

    if (context) {
      await destroyComponentPreviewContext(context).catch(() => {})
    }
    else if (runtime && Endge.runtime.getRuntimeById(runtime.id)) {
      await Endge.runtime.destroyRuntimeTreeAsync(runtime.id).catch(() => {})
    }
  }

  private _applyStyle(style: EndgeStyleSheetArtifact | null): void {
    if (!style || typeof document === 'undefined') {
      return
    }
    const element = document.createElement('style')
    element.dataset.endgeUiEditorPreviewStyles = ''
    element.textContent = materializeEndgeCSSForDOM([style]).css
    document.head.append(element)
    this._styleElement = element
  }
}

function previewMeta(): Record<string, unknown> {
  return {
    mode: 'preview',
    origin: 'ui-editor-demo',
    previewScope: 'ui-editor-demo-preview',
  }
}

function createOverlayArtifactReader(root: ProgramArtifact<ComponentSFCProgramPayload>) {
  return {
    getArtifact: <TPayload>(entityType: string, id: string | number) => {
      const matchesRoot = entityType === root.ref.entityType
        && (String(id) === String(root.ref.id) || String(id) === root.ref.identity)
      return (matchesRoot ? root : Endge.program.getArtifact(entityType as any, id)) as ProgramArtifact<TPayload> | null
    },
  }
}
