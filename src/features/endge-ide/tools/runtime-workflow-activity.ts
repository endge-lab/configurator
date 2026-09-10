import type { RuntimePreviewLifecycleState, RuntimePreviewTreeNode } from '../domain/types/runtime-preview.types'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'

/** Объединяет active экземпляры по документу; scope различается внутри своего документа. */
export function collectRuntimeWorkflowActivity(
  roots: readonly WorkflowDependency[],
  entries: readonly { tree: { value: RuntimePreviewTreeNode[] }, lifecycleState: (node: RuntimePreviewTreeNode) => RuntimePreviewLifecycleState }[],
): Set<string> {
  const active = new Set<string>()
  const key = (type: string | null, identity: string, owner: string) => JSON.stringify([
    type === 'vocab' ? 'vocabs' : type === 'i18n' ? 'i18n-bundles' : type,
    identity,
    type === 'scope' ? owner : '',
  ])
  for (const entry of entries) {
    const visit = (node: RuntimePreviewTreeNode, owner: string): void => {
      const currentOwner = node.kind === 'composition' || node.kind === 'project'
        ? key(node.entityType, node.identity, '')
        : owner
      if (entry.lifecycleState(node) === 'active') {
        active.add(key(node.runtimeKind === 'filter-view' ? 'filter-view' : node.entityType, node.identity, currentOwner))
      }
      node.children.forEach(child => visit(child, currentOwner))
    }
    entry.tree.value.forEach(node => visit(node, ''))
  }
  const ids = new Set<string>()
  const visit = (node: WorkflowDependency, owner: string): void => {
    const currentOwner = node.kind === 'composition' || node.kind === 'project'
      ? key(node.documentType, node.identity, '')
      : owner
    if (active.has(key(node.filterView ? 'filter-view' : node.documentType ?? node.kind, node.identity, currentOwner))) {
      ids.add(node.id)
    }
    node.children.forEach(child => visit(child, currentOwner))
  }
  roots.forEach(node => visit(node, ''))
  return ids
}
