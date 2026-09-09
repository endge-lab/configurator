import type { DocumentDependencyNode, DocumentDependencyTreeResult } from '../services/document-dependencies/document-dependency-types'
import type { WorkflowDependency, WorkflowNodeData } from '@/features/project-workflow/domain/ProjectWorkflow'
import type { WorkflowSelection } from '@/features/project-workflow/tools/workflow-graph'

/** Только presentation mapping: разрешение providers и обход принадлежат Workflow. */
export function buildWorkflowDependencyTree(
  selection: WorkflowSelection[],
  labels: { selection: string, usages: string, dependencies: string },
): DocumentDependencyTreeResult | null {
  if (!selection.length) {
    return null
  }
  const document = (node: WorkflowNodeData, children: DocumentDependencyNode[] = []): DocumentDependencyNode => ({
    id: node.id,
    kind: node.kind === 'scope' ? 'scope' : 'document',
    identity: node.identity,
    alias: node.alias,
    title: node.title,
    documentType: node.documentType,
    icon: node.icon,
    colorClass: node.colorClass,
    badgeIcon: node.badgeIcon ?? null,
    activationMode: node.activationMode,
    status: node.status,
    diagnosticCount: node.diagnosticCount,
    children,
  })
  const branch = (node: WorkflowDependency): DocumentDependencyNode => document(node, node.children.map(branch))
  const group = (id: string, title: string, icon: string, children: DocumentDependencyNode[]): DocumentDependencyNode => ({
    id,
    title,
    icon,
    children,
    kind: 'group',
    identity: '',
    alias: null,
    documentType: null,
    colorClass: 'text-muted-foreground',
    badgeIcon: null,
    activationMode: null,
    status: 'valid',
    diagnosticCount: 0,
  })
  const roots = selection.map(({ node, usages, dependencies }) => document(node, [
    group(`${node.id}/usages`, labels.usages, 'ArrowUpFromLine', usages.map(branch)),
    group(`${node.id}/dependencies`, labels.dependencies, 'ArrowDownToLine', dependencies.map(branch)),
  ]))
  return {
    root: roots.length === 1 ? roots[0]! : group(`selection:${roots.map(node => node.id).join('|')}`, labels.selection, 'Network', roots),
    status: 'valid',
    diagnostics: [],
  }
}
