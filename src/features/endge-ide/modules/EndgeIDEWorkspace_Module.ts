import type { EndgeIDEBusy_Module } from './EndgeIDEBusy_Module'
import type { EndgeIDEUIState_Module } from './EndgeIDEUIState_Module'
import type { WorkflowDependency, WorkflowViewport } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { Endge, isExternallyManaged } from '@endge/core'
import { reactive, shallowRef } from 'vue'
import { RWorkspaceEditor } from '@/features/endge-ide/domain/entities/RWorkspaceEditor'
import { DocumentMetadataSession } from '@/features/endge-ide/services/document-metadata-session'
import { buildWorkspaceWorkflowTree } from '@/features/endge-ide/services/workspace-workflow/workspace-workflow-tree'

/** Владеет workspace editor-сессией, её persistence и отдельным Workflow. */
export class EndgeIDEWorkspace_Module {
  public readonly editor = shallowRef<RWorkspaceEditor | null>(null)
  public readonly root = shallowRef<WorkflowDependency | null>(null)
  public readonly metadataSession = shallowRef<DocumentMetadataSession | null>(null)
  private _offWorkspace: (() => void) | null = null
  private _offDomain: (() => void) | null = null
  private _saving = false
  private _generation = 0

  public constructor(
    private readonly _busy: EndgeIDEBusy_Module,
    private readonly _uiState: EndgeIDEUIState_Module,
    private readonly _onDataModeChange: () => Promise<void>,
  ) {}

  public open(): void {
    if (!this._offWorkspace) {
      this._offWorkspace = Endge.workspace.subscribe(() => {
        if (!Endge.workspace.isLoaded) {
          this.editor.value = null
        }
        else if (!this._saving && (!this.editor.value?.dirty || this.editor.value.identity !== Endge.workspace.current.identity)) {
          const initialized = this.editor.value?.workflow.initialized
          this._createEditor()
          if (initialized) {
            this.prepareWorkflow()
          }
        }
      })
      this._offDomain = Endge.domain.subscribe(() => {
        if (this.editor.value?.workflow.initialized) {
          this.prepareWorkflow()
        }
      })
    }
    if (!this.editor.value || this.editor.value.identity !== Endge.workspace.current.identity) {
      this._createEditor()
    }
  }

  public prepareWorkflow(): void {
    const editor = this.editor.value
    if (!editor || !Endge.workspace.isLoaded || editor.identity !== Endge.workspace.current.identity) {
      return
    }
    const restore = !editor.workflow.initialized
    const root = buildWorkspaceWorkflowTree({ ...Endge.workspace.current, displayName: editor.displayName })
    this.root.value = root
    editor.workflow.replaceRoots([root])
    if (restore) {
      editor.workflow.restoreViewState(this._uiState.read(this._viewKey(), null))
    }
  }

  public toggleResources(id: string): void {
    const workflow = this.editor.value?.workflow
    if (workflow) {
      workflow.toggleResources(id)
      this._uiState.write(this._viewKey(), workflow.viewState)
    }
  }

  public arrange(): void {
    Endge.assertWritable()
    const workflow = this.editor.value?.workflow
    if (workflow) {
      workflow.resetLayout()
      this._uiState.write(this._viewKey(), workflow.viewState)
    }
  }

  public setViewport(viewport: WorkflowViewport): void {
    const workflow = this.editor.value?.workflow
    if (workflow) {
      workflow.setViewport(viewport)
      this._uiState.write(this._viewKey(), workflow.viewState)
    }
  }

  public async save(): Promise<void> {
    Endge.assertWritable()
    const editor = this.editor.value
    if (!editor || !editor.displayName.trim() || this._busy.value) {
      return
    }
    if (editor.identity !== Endge.workspace.current.identity) {
      throw new Error('Workspace editor belongs to a different workspace')
    }
    const generation = this._generation
    const previousDataMode = Endge.context.dataMode
    if (this.metadataSession.value && !this.metadataSession.value.prepareBeforeSave()) {
      throw new Error(this.metadataSession.value.error ?? 'Исправьте JSON metadata.')
    }
    const document = editor.toDocument(Endge.workspace.current)
    const snapshot = editor.snapshot()
    this._saving = true
    try {
      await this._busy.run(Endge.domainRepository.saveDocument(editor.identity, 'workspace', { model: document }))
      if (generation === this._generation && this.editor.value === editor) {
        editor.acceptSaved(snapshot)
        this.metadataSession.value?.acceptSaved()
        if (previousDataMode !== Endge.context.dataMode) {
          await this._onDataModeChange()
        }
      }
    }
    finally {
      if (generation === this._generation) {
        this._saving = false
      }
    }
  }

  public reset(): void {
    this._generation++
    this._offDomain?.()
    this._offWorkspace?.()
    this._offDomain = null
    this._offWorkspace = null
    this._saving = false
    this.editor.value = null
    this.metadataSession.value = null
    this.root.value = null
  }

  private _createEditor(): void {
    this.editor.value = reactive(new RWorkspaceEditor(Endge.workspace.current)) as RWorkspaceEditor
    this.metadataSession.value = reactive(new DocumentMetadataSession(
      'workspace',
      this.editor.value,
      this.editor.value,
      Endge.mode === 'debugger' || isExternallyManaged(Endge.workspace.current),
    )) as DocumentMetadataSession
  }

  private _viewKey(): string {
    return `configurator.workspace-workflow.${this.editor.value?.identity ?? ''}`
  }
}
