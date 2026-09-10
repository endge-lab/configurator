import type { DomainDocumentType, EndgeExecutionContext, EndgeRuntimeSnapshot, RuntimeHostSnapshot } from '@endge/core'
import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { Endge, FilterType, QueryType } from '@endge/core'
import { computed, reactive, shallowRef } from 'vue'
import { RuntimeInspectionRenderer } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-renderer'
import { buildRuntimeInspectionTree } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-tree'
import { buildWorkspaceWorkflowTree } from '@/features/endge-ide/services/workspace-workflow/workspace-workflow-tree'
import { readRuntimeInspectionData } from '@/features/endge-ide/tools/read-runtime-inspection-data'
import { collectRuntimeWorkflowActivity } from '@/features/endge-ide/tools/runtime-workflow-activity'
import { WorkspaceWorkflow } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { readWorkflowLayout } from '@/features/workspace-workflow/tools/workflow-layout'

/** Владеет выбором и UI-проекцией debugger; runtime и данные остаются в Core Runtime. */
export class EndgeIDERuntimeInspection_Module {
  private readonly _runtime = shallowRef<EndgeRuntimeSnapshot | null>(null)
  private readonly _revision = shallowRef(0)
  private readonly _selectedId = shallowRef<string | null>(null)
  private readonly _context = shallowRef<EndgeExecutionContext | null>(null)
  private readonly _workflowRoots = shallowRef<WorkflowDependency[]>([])
  private readonly _projection = computed(() => buildRuntimeInspectionTree(this._runtime.value ?? { generatedAt: 0, hosts: [], scopes: [], total: 0, byStatus: {}, deletedTotal: 0, deletedHosts: [] }, this._documentType))
  private _off: (() => void)[] = []
  public readonly tree = computed(() => this._projection.value.roots)
  public readonly selectedNode = computed(() => this._projection.value.nodes.get(this._selectedId.value ?? '') ?? null)
  public readonly selectedTarget = computed(() => this._projection.value.targets.get(this._selectedId.value ?? '') ?? null)
  public readonly workflow = shallowRef<WorkspaceWorkflow | null>(null)
  public readonly inspection = computed(() => {
    void this._revision.value
    return Endge.runtime.inspection
  })

  private readonly _renderer = new RuntimeInspectionRenderer(() => this.inspection.value)
  public readonly renderables = computed(() => {
    void this._revision.value
    const selected = this.selectedNode.value
    if (!selected) {
      return []
    }
    const hosts = new Map(this._runtime.value?.hosts.map(host => [host.id, host]) ?? [])
    const result: NonNullable<ReturnType<RuntimeInspectionRenderer['render']>>[] = []
    const visit = (node: RuntimePreviewTreeNode): void => {
      const target = this._projection.value.targets.get(node.id)
      const host = target?.kind === 'host' ? hosts.get(target.id) : null
      if (host && (host.capabilities.includes('renderable') || (node === selected && host.entityType === 'store'))) {
        const item = this._renderer.render(host)
        if (item) {
          result.push(item)
        }
        return
      }
      node.children.forEach(visit)
    }
    visit(selected)
    return result
  })

  public readonly selectedHost = computed(() => {
    const target = this.selectedTarget.value
    const id = target?.kind === 'host' ? target.id : this._runtime.value?.scopes.find(scope => scope.id === target?.id)?.ownerRuntimeId
    return this._runtime.value?.hosts.find(host => host.id === id) ?? null
  })

  public readonly selectedData = computed(() => {
    const host = this.selectedHost.value
    return host ? readRuntimeInspectionData(this.inspection.value.data, host.basePath) : this.inspection.value.data
  })

  public readonly selectedDescriptor = computed(() => {
    const target = this.selectedTarget.value
    return target?.kind === 'scope'
      ? this._runtime.value?.scopes.find(scope => scope.id === target.id)
      : this.selectedHost.value ?? this._runtime.value
  })

  public readonly activeWorkflowIds = computed(() => collectRuntimeWorkflowActivity(this._workflowRoots.value, [{
    tree: { value: this.tree.value },
    lifecycleState: node => this.lifecycleState('', node),
  }], this._context.value))

  public init(): void {
    if (this._off.length) {
      return
    }
    this._off = [
      Endge.runtime.subscribe(() => this._sync()),
      Endge.domain.subscribe(() => this._refreshWorkflow()),
      Endge.workspace.subscribe(() => this._refreshWorkflow()),
      Endge.context.subscribe(() => { this._context.value = Endge.context.getExecutionContext() }),
    ]
    this._sync()
    this._context.value = Endge.context.getExecutionContext()
  }

  public select(_entryKey: string, node: RuntimePreviewTreeNode): void {
    this._selectedId.value = node.id
  }

  public lifecycleState(_entryKey: string, node: RuntimePreviewTreeNode) {
    return this._projection.value.states.get(node.id) ?? 'inactive'
  }

  public prepareWorkflow(): void {
    if (!Endge.workspace.isLoaded) {
      return
    }
    this._workflowRoots.value = [buildWorkspaceWorkflowTree(Endge.workspace.current)]
    if (!this.workflow.value) {
      this.workflow.value = reactive(new WorkspaceWorkflow(readWorkflowLayout(Endge.workspace.current.meta ?? {}))) as WorkspaceWorkflow
    }
    this.workflow.value.replaceRoots(this._workflowRoots.value)
  }

  /** Смена клиента снимает выбор и временное полотно, не сохраняя их в удалённом Context. */
  public clearSelection(): void {
    this._selectedId.value = null
    this.workflow.value = null
    this._workflowRoots.value = []
    this._renderer.reset()
  }

  public reset(): void {
    this._off.forEach(off => off())
    this._off = []
    this.clearSelection()
    this._context.value = null
    this._runtime.value = null
  }

  private _sync(): void {
    this._runtime.value = Endge.runtime.snapshot()
    this._renderer.retainHosts(this._runtime.value.hosts)
    this._revision.value += 1
    if (this._selectedId.value && !this._projection.value.nodes.has(this._selectedId.value)) {
      this._selectedId.value = null
    }
  }

  private _refreshWorkflow(): void {
    this._renderer.reset()
    this._revision.value += 1
    if (this.workflow.value) {
      this.prepareWorkflow()
    }
  }

  private _documentType(host: RuntimeHostSnapshot): DomainDocumentType {
    if (host.entityType === 'filter') {
      return FilterType.DefaultFilter
    }
    if (host.entityType === 'query') {
      return Endge.domain.getQuery(host.entityIdentity)?.type ?? QueryType.REST
    }
    return host.entityType as DomainDocumentType
  }
}
