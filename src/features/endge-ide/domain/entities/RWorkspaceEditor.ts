import type { EndgeConfiguration, EndgeDataMode, EndgeWorkspaceDefinition, EndgeWorkspaceDocumentStructure } from '@endge/core'
import { WorkspaceWorkflow } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { readWorkflowLayout, writeWorkflowLayout } from '@/features/workspace-workflow/tools/workflow-layout'

/** Черновик настроек и раскладки Workspace; project metadata не изменяется. */
export class RWorkspaceEditor {
  public readonly identity: string
  public displayName: string
  public dataMode: EndgeDataMode
  public documentStructure: EndgeWorkspaceDocumentStructure
  public configuration: EndgeConfiguration
  public meta: Record<string, unknown>
  public readonly workflow: WorkspaceWorkflow
  private _savedSnapshot: string

  public constructor(workspace: EndgeWorkspaceDefinition) {
    this.identity = workspace.identity
    this.displayName = workspace.displayName
    this.dataMode = workspace.dataMode
    this.documentStructure = workspace.documentStructure ?? 'frontend'
    this.configuration = JSON.parse(JSON.stringify(workspace.configuration)) as EndgeConfiguration
    this.meta = JSON.parse(JSON.stringify(workspace.meta ?? {})) as Record<string, unknown>
    this.workflow = new WorkspaceWorkflow(readWorkflowLayout(workspace.meta ?? {}))
    this._savedSnapshot = this.snapshot()
  }

  /** Merge затрагивает только принадлежащие этому редактору поля Workspace. */
  public toDocument(workspace: EndgeWorkspaceDefinition): EndgeWorkspaceDefinition {
    return JSON.parse(JSON.stringify({
      ...workspace,
      displayName: this.displayName.trim(),
      dataMode: this.dataMode,
      documentStructure: this.documentStructure,
      configuration: this.configuration,
      meta: writeWorkflowLayout(this.meta, this.workflow.layout),
    })) as EndgeWorkspaceDefinition
  }

  public snapshot(): string {
    return JSON.stringify({
      displayName: this.displayName,
      dataMode: this.dataMode,
      documentStructure: this.documentStructure,
      configuration: this.configuration,
      meta: this.meta,
      layout: this.workflow.layout,
    })
  }

  public acceptSaved(snapshot: string): void {
    this._savedSnapshot = snapshot
  }

  public get dirty(): boolean {
    return this.snapshot() !== this._savedSnapshot
  }
}
