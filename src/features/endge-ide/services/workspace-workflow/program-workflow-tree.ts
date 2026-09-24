import type { CompositionProgramPayload, DomainDocumentType } from '@endge/core'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { Endge, FilterType, QueryType } from '@endge/core'
import { DOCUMENT_AUXILIARY_PRESENTATION } from '@/features/document-presentation/config/document-presentation'
import { getDomainDocumentPresentation } from '@/features/document-presentation/tools/resolve-document-presentation'

// Readonly graph compiled Program; no Source, parser, Domain materialization or hosts.
export function buildProgramWorkflowTree(): WorkflowDependency {
  const workspace = Endge.workspace.current
  const documents = Object.values(Endge.program.catalog.documents)
  const rootId = `workspace:${encodeURIComponent(workspace.identity)}`
  const represented = new Set<string>()
  function node(type: string, identity: string, id: string, alias: string | null = null): WorkflowDependency {
    const entityType = type === 'component' ? 'component-sfc' : type
    const document = documents.find(item => item.entityType === entityType && item.identity === identity)
    const documentType = (document?.documentType ?? (entityType === 'filter'
      ? FilterType.DefaultFilter
      : entityType === 'query'
        ? Endge.program.getQueryArtifact(identity)?.payload.type ?? QueryType.REST
        : entityType)) as DomainDocumentType
    return { id, kind: type, identity, alias, title: document?.displayName ?? identity, documentType, ...getDomainDocumentPresentation(documentType), activationMode: null, status: 'valid', diagnosticCount: 0, children: [] }
  }
  function composition(identity: string, id: string, ancestors = new Set<string>()): WorkflowDependency {
    const root = node('composition', identity, id)
    represented.add(identity)
    if (ancestors.has(identity)) {
      root.status = 'cycle'
      return root
    }
    const artifact = Endge.program.getCompositionArtifact(identity)
    if (!artifact) {
      root.status = 'missing'
      return root
    }
    root.diagnosticCount = artifact.diagnostics.filter(item => item.severity === 'error').length
    const payload = artifact.payload as CompositionProgramPayload
    root.activationMode = payload.activation?.mode ?? 'startup'
    const visited = new Set(ancestors).add(identity)
    const runtimeNodes = new Map<string, WorkflowDependency>()
    function contents(scopePath: string, parent: string): WorkflowDependency[] {
      const result: WorkflowDependency[] = payload.data.filter(item => (item.scopePath ?? 'scope_default') === scopePath).map(item => ({ ...node(item.kind === 'store' ? 'store' : 'vocabs', item.identity, `${parent}/data:${item.path ?? item.name}`, item.name), kind: 'data', dataSource: item }))
      for (const resource of payload.resources.filter(item => item.scopePath === scopePath)) {
        if ('identity' in resource) {
          result.push({ ...node(resource.kind === 'i18n' ? 'i18n-bundles' : 'style', resource.identity, `${parent}/resource:${resource.path}`, resource.name), kind: 'resource', resourceSource: resource })
        }
      }
      for (const runtime of payload.runtimes.filter(item => item.scopePath === scopePath)) {
        const runtimeId = `${parent}/runtime:${runtime.path}`
        const source = runtime.kind === 'filter-view'
          ? payload.runtimes.find(item => item.kind === 'filter' && item.name === runtime.identity)
          : undefined
        const child = runtime.kind === 'composition'
          ? composition(runtime.identity, runtimeId, visited)
          : node(source ? 'filter' : runtime.kind, source?.identity ?? runtime.identity, runtimeId, runtime.name)
        if (runtime.kind === 'filter-view') {
          Object.assign(child, DOCUMENT_AUXILIARY_PRESENTATION.filterView)
          child.filterView = { sourceId: null, fields: (runtime.fields ?? []).map(key => ({ key })) }
          if (!source) {
            child.status = 'missing'
          }
        }
        runtimeNodes.set(runtime.name, child)
        child.alias = runtime.name
        child.activationMode = runtime.effectiveActivation.mode
        child.dataBindings = runtime.dataBindings
        result.push(child)
      }
      for (const scope of payload.scopes.filter(item => item.parentPath === scopePath)) {
        const scopeId = `${parent}/scope:${scope.path}`
        result.push({ ...node('scope', scope.path, scopeId, scope.name), ...DOCUMENT_AUXILIARY_PRESENTATION.scope, documentType: null, title: scope.name, activationMode: scope.effectiveActivation.mode, children: contents(scope.path, scopeId) })
      }
      return result
    }
    root.children = contents('scope_default', id)
    for (const runtime of payload.runtimes) {
      const view = runtimeNodes.get(runtime.name)?.filterView
      if (view) {
        view.sourceId = runtimeNodes.get(runtime.identity)?.id ?? null
      }
    }
    return root
  }
  const children: WorkflowDependency[] = documents.filter(item => item.entityType === 'configuration').map(item => ({ ...node('configuration', item.identity, `${rootId}/configuration:${item.id}`), kind: 'resource' }))
  for (const facet of documents.filter(item => ['facet', 'facets'].includes(item.entityType))) {
    children.push(...documents.filter(item => ['facet-document', 'facetDocuments'].includes(item.entityType) && item.facetIdentity === facet.identity).map(item => ({ ...node(item.entityType, item.identity, `${rootId}/facet:${facet.identity}/${item.id}`), kind: `facet-document:${facet.identity}`, documentType: null, alias: facet.displayName, icon: facet.icon ?? 'Layers3', iconColor: facet.color })))
  }
  if (workspace.startupCompositionIdentity) {
    children.push(composition(workspace.startupCompositionIdentity, `${rootId}/composition:${workspace.startupCompositionIdentity}`))
  }
  for (const document of documents.filter(item => item.entityType === 'composition')) {
    if (!represented.has(document.identity)) {
      children.push(composition(document.identity, `${rootId}/composition:${document.identity}`))
    }
  }
  return { ...node('workspace', workspace.identity, rootId), ...DOCUMENT_AUXILIARY_PRESENTATION.workspace, title: workspace.displayName, children }
}
