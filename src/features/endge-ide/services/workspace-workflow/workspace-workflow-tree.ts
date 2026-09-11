import type { DomainDocumentType, EndgeWorkspaceDefinition } from '@endge/core'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
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

/** Проекция текущего Workspace; ничего не запускает и не меняет доменные документы. */
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
  const graph = (document: WorkflowDocument & { source: string }): WorkflowDependency => {
    const result = buildCompositionDependencyTree({
      identity: document.identity,
      displayName: document.displayName,
      source: document.source,
    })
    const root = result.root
    if (!root) {
      return { ...leaf(document, 'composition'), status: 'compile-error', diagnosticCount: result.diagnostics.length }
    }
    const prefix = address('composition', document)
    const remapId = (id: string) => id.startsWith(root.id) ? `${prefix}${id.slice(root.id.length)}` : `${prefix}/${id}`
    const remap = (node: WorkflowDependency): WorkflowDependency => ({
      ...node,
      id: remapId(node.id),
      ...(node.filterView ? { filterView: { ...node.filterView, sourceId: node.filterView.sourceId ? remapId(node.filterView.sourceId) : null } } : {}),
      children: node.children.map(remap),
    })
    return {
      ...remap(root),
      ...getDomainDocumentPresentation('composition'),
      kind: 'composition',
      documentType: 'composition',
      inactive: document.active === false,
      diagnosticCount: result.diagnostics.filter(item => item.severity === 'error').length,
    }
  }
  const facetDocuments = Endge.domain.getFacets()
    .filter(facet => facet.deletedAt == null && facet.active !== false)
    .sort((left, right) => left.position - right.position || left.identity.localeCompare(right.identity))
    .flatMap(facet => visible(Endge.domain.getFacetDocuments(facet.identity)).map(document => ({
      id: address(`facet:${facet.identity}`, document),
      identity: document.identity,
      kind: `facet-document:${facet.identity}`,
      title: document.displayName || document.name || document.identity,
      documentType: null,
      icon: facet.icon,
      colorClass: 'text-primary',
      alias: facet.displayName || facet.identity,
      activationMode: null,
      status: 'valid' as const,
      diagnosticCount: 0,
      inactive: document.active === false,
      children: [],
    })))
  const compositions = visible(Endge.domain.getCompositions()).map(composition => graph(composition))
  const startup = compositions.find(root => root.identity === workspace.startupCompositionIdentity) ?? null
  const referenced = new Set<string>()
  const visit = (nodes: WorkflowDependency[]) => {
    for (const node of nodes) {
      if (node.documentType === 'composition') {
        referenced.add(node.identity)
      }
      visit(node.children)
    }
  }
  for (const root of compositions) {
    visit(root.children)
  }
  // Циклические graphs тоже должны оставаться доступными для диагностики.
  const standalone = compositions.filter(root => root !== startup && !referenced.has(root.identity))
  const represented = new Set<string>()
  const mark = (node: WorkflowDependency): void => {
    if (node.documentType === 'composition') {
      represented.add(node.identity)
    }
    node.children.forEach(mark)
  }
  ;[...(startup ? [startup] : []), ...standalone].forEach(mark)
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
      ...facetDocuments,
      ...(startup ? [startup] : []),
      ...standalone,
    ],
  }
}
