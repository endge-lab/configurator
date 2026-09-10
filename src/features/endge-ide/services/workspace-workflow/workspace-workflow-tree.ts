import type { DomainDocumentType, EndgeWorkspaceDefinition } from '@endge/core'
import type { WorkflowDependency } from '@/features/project-workflow/domain/ProjectWorkflow'
import { Endge } from '@endge/core'
import { DOCUMENT_AUXILIARY_PRESENTATION } from '@/features/document-presentation/config/document-presentation'
import { getDomainDocumentPresentation } from '@/features/document-presentation/tools/resolve-document-presentation'
import { buildCompositionDependencyTree } from '@/features/endge-ide/services/composition-dependencies/composition-dependency-tree'

interface WorkflowDocument {
  id?: string | number
  identity: string
  name?: string
  displayName?: string
  active?: boolean | null
  deletedAt?: string | null
  isTemporary?: boolean
}

/** Проекция текущего Workspace; ничего не запускает и не меняет документы проектов. */
export function buildWorkspaceWorkflowTree(workspace: EndgeWorkspaceDefinition): WorkflowDependency {
  const rootId = `workspace:${encodeURIComponent(workspace.identity)}`
  const address = (type: string, document: WorkflowDocument) =>
    `${rootId}/${type}:${encodeURIComponent(String(document.id ?? document.identity))}`
  const visible = <T extends WorkflowDocument>(documents: T[]) => documents.filter(document =>
    document.deletedAt == null && document.isTemporary !== true)
  const leaf = (document: WorkflowDocument, type: DomainDocumentType, kind = String(type)): WorkflowDependency => ({
    id: address(type, document),
    identity: document.identity,
    kind,
    title: document.displayName || document.name || document.identity,
    documentType: type,
    ...getDomainDocumentPresentation(type),
    alias: null,
    activationMode: null,
    status: 'valid',
    diagnosticCount: 0,
    inactive: document.active === false,
    children: [],
  })
  const graph = (document: WorkflowDocument & { source: string }, type: 'project' | 'composition'): WorkflowDependency => {
    const result = buildCompositionDependencyTree({
      documentType: type,
      identity: document.identity,
      displayName: document.displayName,
      source: document.source,
    })
    const root = result.root
    if (!root) {
      return { ...leaf(document, type), status: 'compile-error', diagnosticCount: result.diagnostics.length }
    }
    const prefix = address(type, document)
    const remapId = (id: string) => id.startsWith(root.id) ? `${prefix}${id.slice(root.id.length)}` : `${prefix}/${id}`
    const remap = (node: WorkflowDependency): WorkflowDependency => ({
      ...node,
      id: remapId(node.id),
      ...(node.filterView ? { filterView: { ...node.filterView, sourceId: node.filterView.sourceId ? remapId(node.filterView.sourceId) : null } } : {}),
      children: node.children.map(remap),
    })
    return {
      ...remap(root),
      ...getDomainDocumentPresentation(type),
      kind: type,
      documentType: type,
      inactive: document.active === false,
      diagnosticCount: result.diagnostics.filter(item => item.severity === 'error').length,
    }
  }
  const projects = visible(Endge.domain.getProjects()).map(project => graph(project, 'project'))
  const compositions = visible(Endge.domain.getCompositions()).map(composition => graph(composition, 'composition'))
  const referenced = new Set<string>()
  const visit = (nodes: WorkflowDependency[]) => {
    for (const node of nodes) {
      if (node.documentType === 'composition') {
        referenced.add(node.identity)
      }
      visit(node.children)
    }
  }
  for (const root of [...projects, ...compositions]) {
    visit(root.children)
  }
  // Циклические graphs тоже должны оставаться доступными для диагностики.
  const standalone = compositions.filter(root => !referenced.has(root.identity))
  const represented = new Set<string>()
  const mark = (node: WorkflowDependency): void => {
    if (node.documentType === 'composition') {
      represented.add(node.identity)
    }
    node.children.forEach(mark)
  }
  ;[...projects, ...standalone].forEach(mark)
  for (const root of compositions) {
    if (!represented.has(root.identity)) {
      standalone.push(root)
      mark(root)
    }
  }
  return {
    id: rootId,
    kind: 'workspace',
    identity: workspace.identity,
    title: workspace.displayName || workspace.identity,
    documentType: 'workspace',
    ...DOCUMENT_AUXILIARY_PRESENTATION.workspace,
    alias: null,
    activationMode: null,
    status: 'valid',
    diagnosticCount: 0,
    children: [
      ...visible(Endge.domain.getConfigurations()).map(configuration => leaf(configuration, 'configuration', 'resource')),
      ...visible(Endge.domain.getTenants()).map(tenant => leaf(tenant, 'tenant')),
      ...projects,
      ...standalone,
      ...visible(Endge.domain.getEnvironments()).map(environment => leaf(environment, 'environment')),
    ],
  }
}
