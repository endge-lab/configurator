import type {
  CompositionProgramPayload,
  CompositionRuntimeDescriptor,
  CompositionSourceDocument,
  DomainDocumentType,
  FilterProgramPayload,
  QueryProgramPayload,
  RComposition,
} from '@endge/core'
import type {
  DocumentDependencyDiagnostic,
  DocumentDependencyNode,
  DocumentDependencyNodeKind,
  DocumentDependencyTreeResult,
} from '@/features/endge-ide/services/document-dependencies/document-dependency-types'

import { compileComponentSFC, ComponentType, Endge, FilterType, QueryType } from '@endge/core'

import { DOCUMENT_AUXILIARY_PRESENTATION } from '@/features/document-presentation/config/document-presentation'
import { countDocumentDependencies } from '@/features/endge-ide/services/document-dependencies/document-dependency-types'
import { resolveDomainEntityPresentation } from '@/features/endge-ide/services/domain/domain-entity-presentation'

export interface CompositionDependencyNode extends DocumentDependencyNode {
  dataSource?: CompositionProgramPayload['data'][number]
  resourceSource?: CompositionProgramPayload['resources'][number]
  dataBindings?: Record<string, string>
  filterView?: { sourceId: string | null, fields: { key: string, label?: string }[] }
  dataDependencies?: string[]
  vocabReferences?: { alias?: string, identity?: string }[]
  children: CompositionDependencyNode[]
}
export interface CompositionDependencyTreeResult extends DocumentDependencyTreeResult {
  root: CompositionDependencyNode | null
}
export type CompositionDependencyDiagnostic = DocumentDependencyDiagnostic

export interface CompositionDependencyTreeInput {
  identity: string
  displayName?: string | null
  source: string
}

interface CompositionUsageEdge {
  parentIdentity: string
  runtimeName: string
  runtimePath: string
  targetIdentity: string
  diagnosticCount: number
}

interface CachedCompositionUsageEdges {
  source: string
  edges: CompositionUsageEdge[]
}

const compositionUsageCache = new Map<string, CachedCompositionUsageEdges>()

/** Строит occurrence tree из текущего draft source без Program build и runtime side effects. */
export function buildCompositionDependencyTree(
  input: CompositionDependencyTreeInput,
): CompositionDependencyTreeResult {
  const compilation = Endge.source.compile('composition', input.source)
  const diagnostics = (compilation.diagnostics
    ?? []) as CompositionDependencyDiagnostic[]
  const payload = compilation.artifact as CompositionProgramPayload | null
  if (!payload) {
    return { status: 'compile-error', root: null, diagnostics }
  }

  const identity
    = String(input.identity || 'draft-composition').trim() || 'draft-composition'
  const visual = resolveDomainEntityPresentation('composition', identity)
  const root: CompositionDependencyNode = {
    id: `composition:${identity}`,
    kind: 'composition',
    identity,
    alias: null,
    title: String(input.displayName || visual.title || identity),
    documentType: null,
    icon: visual.icon,
    colorClass: visual.colorClass,
    badgeIcon: visual.badgeIcon,
    activationMode: payload.activation?.mode ?? 'startup',
    status: 'valid',
    diagnosticCount: 0,
    children: [],
  }
  root.children = buildCompositionContents(
    payload,
    root.id,
    new Set([identity]),
  )
  return { status: 'valid', root, diagnostics }
}

/** Добавляет к текущему downstream tree полный обратный обход мест использования. */
export function buildCompositionDependencyHierarchy(
  input: CompositionDependencyTreeInput,
): CompositionDependencyTreeResult {
  const result = buildCompositionDependencyTree(input)
  if (!result.root) {
    return result
  }

  const downstream = result.root.children
  const usageIndex = buildCompositionUsageIndex(input)
  const currentIdentity = normalizeIdentity(input.identity) || result.root.identity
  const upstream = buildCompositionUsageNodes(
    currentIdentity,
    `${result.root.id}/used-by`,
    new Set([currentIdentity]),
    usageIndex,
  )

  result.root.children = [
    makeGroupNode({
      id: `${result.root.id}/group:used-by`,
      identity: 'used-by',
      title: 'Используется в',
      icon: 'ArrowUpFromLine',
      colorClass: 'text-fuchsia-400',
      children: upstream,
    }),
    makeGroupNode({
      id: `${result.root.id}/group:dependencies`,
      identity: 'dependencies',
      title: 'Зависимости',
      icon: 'ArrowDownToLine',
      colorClass: 'text-sky-400',
      children: downstream,
    }),
  ]
  return result
}

export function countCompositionDependencies(
  root: CompositionDependencyNode | null,
): number {
  return countDocumentDependencies(root)
}

function buildCompositionUsageIndex(
  input: CompositionDependencyTreeInput,
): ReadonlyMap<string, readonly CompositionUsageEdge[]> {
  const incoming = new Map<string, CompositionUsageEdge[]>()
  const currentIdentity = normalizeIdentity(input.identity)

  for (const composition of Endge.domain.getCompositions()) {
    const source = composition.identity === currentIdentity
      ? input.source
      : composition.source
    const edges = getCachedCompositionUsageEdges(composition, source)
    for (const edge of edges) {
      const existing = incoming.get(edge.targetIdentity) ?? []
      existing.push(edge)
      incoming.set(edge.targetIdentity, existing)
    }
  }
  return incoming
}

function getCachedCompositionUsageEdges(
  composition: RComposition,
  source: string,
): CompositionUsageEdge[] {
  const cached = compositionUsageCache.get(composition.identity)
  if (cached?.source === source) {
    return cached.edges
  }

  const compilation = Endge.source.compile('composition', source)
  const document = (compilation.artifact
    ?? compilation.document) as CompositionSourceDocument | null
  const diagnosticCount = countCompilationErrors(compilation.diagnostics)
  const edges = (document?.runtimes ?? [])
    .filter(runtime => runtime.kind === 'composition')
    .map(runtime => ({
      parentIdentity: composition.identity,
      runtimeName: runtime.name,
      runtimePath: runtime.path,
      diagnosticCount,
      targetIdentity: runtime.identity,
    }))

  compositionUsageCache.set(composition.identity, { source, edges })
  return edges
}

function buildCompositionUsageNodes(
  targetIdentity: string,
  occurrenceId: string,
  ancestors: Set<string>,
  usageIndex: ReadonlyMap<string, readonly CompositionUsageEdge[]>,
): CompositionDependencyNode[] {
  const nodes = (usageIndex.get(targetIdentity) ?? []).map((edge) => {
    const parent = Endge.domain.getComposition(edge.parentIdentity)
    const node = makeDocumentNode({
      id: `${occurrenceId}/composition:${edge.parentIdentity}/runtime:${edge.runtimePath}`,
      kind: 'composition',
      identity: edge.parentIdentity,
      alias: edge.runtimeName,
      documentType: 'composition',
      exists: Boolean(parent),
      presentationKind: String(parent?.kind ?? 'library'),
    })
    if (!parent) {
      return node
    }
    if (ancestors.has(parent.identity)) {
      node.status = 'cycle'
      return node
    }
    if (edge.diagnosticCount > 0) {
      node.status = 'compile-error'
      node.diagnosticCount = edge.diagnosticCount
    }

    node.children = buildCompositionUsageNodes(
      parent.identity,
      node.id,
      new Set(ancestors).add(parent.identity),
      usageIndex,
    )
    return node
  })

  const target = Endge.domain.getComposition(targetIdentity)
  const owner = target ? makeCompositionOwnerNode(target, occurrenceId) : null
  if (owner) {
    nodes.push(owner)
  }
  return nodes
}

function makeCompositionOwnerNode(
  composition: RComposition,
  occurrenceId: string,
): CompositionDependencyNode | null {
  const identity = normalizeIdentity(composition.kindIdentity)
  if (!identity || composition.kind === 'library') {
    return null
  }

  if (composition.kind === 'query') {
    const query = Endge.domain.getQuery(identity)
    return makeDocumentNode({
      id: `${occurrenceId}/owner:query:${identity}`,
      kind: 'runtime',
      identity,
      alias: 'owner',
      documentType: query?.type ?? QueryType.REST,
      exists: Boolean(query),
    })
  }

  const ownerType: Extract<DomainDocumentType, 'workspace'> = 'workspace'
  const exists = Endge.workspace.current.identity === identity
  const node = makeDocumentNode({
    id: `${occurrenceId}/owner:${ownerType}:${identity}`,
    kind: 'runtime',
    identity,
    alias: 'owner',
    documentType: ownerType,
    exists,
  })
  if (ownerType === 'workspace' && exists) {
    node.title = Endge.workspace.current.displayName || identity
  }
  return node
}

function makeGroupNode(input: {
  id: string
  identity: string
  title: string
  icon: string
  colorClass: string
  children: CompositionDependencyNode[]
}): CompositionDependencyNode {
  return {
    id: input.id,
    kind: 'group',
    identity: input.identity,
    alias: null,
    title: input.title,
    documentType: null,
    icon: input.icon,
    colorClass: input.colorClass,
    badgeIcon: null,
    activationMode: null,
    status: 'valid',
    diagnosticCount: 0,
    children: input.children,
  }
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? '').trim()
}

function buildCompositionContents(
  payload: CompositionProgramPayload,
  occurrenceId: string,
  ancestors: Set<string>,
): CompositionDependencyNode[] {
  const result = buildScopeContents(payload, 'scope_default', occurrenceId, ancestors)
  for (const scope of payload.scopes.filter(
    item => item.parentPath === 'scope_default',
  )) {
    result.push(buildScopeNode(payload, scope.path, occurrenceId, ancestors))
  }
  return result
}

function buildScopeNode(
  payload: CompositionProgramPayload,
  scopePath: string,
  occurrenceId: string,
  ancestors: Set<string>,
): CompositionDependencyNode {
  const descriptor = payload.scopes.find(item => item.path === scopePath)!
  const id = `${occurrenceId}/scope:${scopePath}`
  const node: CompositionDependencyNode = {
    id,
    kind: 'scope',
    identity: scopePath,
    alias: descriptor.name,
    title: descriptor.name,
    documentType: null,
    ...DOCUMENT_AUXILIARY_PRESENTATION.scope,
    badgeIcon: null,
    activationMode: descriptor.effectiveActivation.mode,
    status: 'valid',
    diagnosticCount: 0,
    children: buildScopeContents(payload, scopePath, occurrenceId, ancestors),
  }
  for (const child of payload.scopes.filter(
    item => item.parentPath === scopePath,
  )) {
    node.children.push(
      buildScopeNode(payload, child.path, occurrenceId, ancestors),
    )
  }
  return node
}

function buildScopeContents(
  payload: CompositionProgramPayload,
  scopePath: string,
  occurrenceId: string,
  ancestors: Set<string>,
): CompositionDependencyNode[] {
  const result: CompositionDependencyNode[] = payload.data
    .filter(data => (data.scopePath ?? 'scope_default') === scopePath)
    .map(data => ({
      ...makeDocumentNode({
        id: `${occurrenceId}/data:${data.path ?? data.name}`,
        kind: 'data',
        identity: data.identity,
        alias: data.name,
        documentType: data.kind === 'store' ? 'store' : 'vocabs',
        exists: data.kind === 'store'
          ? Boolean(Endge.domain.getStore(data.identity))
          : Boolean(Endge.domain.getVocab(data.identity)),
      }),
      dataSource: data,
    }))
  result.push(...payload.resources
    .filter((item): item is Extract<typeof item, { identity: string }> =>
      item.scopePath === scopePath && 'identity' in item)
    .map(resource => ({
      ...makeDocumentNode({
        id: `${occurrenceId}/resource:${resource.path}`,
        kind: 'resource',
        identity: resource.identity,
        alias: resource.name,
        documentType: resource.kind === 'i18n' ? 'i18n-bundles' : 'style',
        exists: resource.kind === 'i18n'
          ? Boolean(Endge.domain.getI18nBundle(resource.identity))
          : Boolean(Endge.domain.getStyle(resource.identity)),
      }),
      resourceSource: resource,
    })))

  for (const runtime of payload.runtimes.filter(
    item => item.scopePath === scopePath,
  )) {
    result.push(
      runtime.kind === 'composition'
        ? buildNestedComposition(runtime, occurrenceId, ancestors)
        : buildRuntimeNode(payload, runtime, occurrenceId),
    )
  }
  return result
}

function buildNestedComposition(
  runtime: CompositionRuntimeDescriptor,
  parentOccurrenceId: string,
  ancestors: Set<string>,
): CompositionDependencyNode {
  const id = `${parentOccurrenceId}/runtime:${runtime.path}`
  const model = Endge.domain.getComposition(runtime.identity)
  const node = makeDocumentNode({
    id,
    kind: 'composition',
    identity: runtime.identity,
    alias: runtime.name,
    documentType: 'composition',
    exists: Boolean(model),
    activationMode: runtime.effectiveActivation.mode,
    presentationKind: String(model?.kind ?? 'library'),
  })
  node.dataBindings = runtime.dataBindings
  if (!model) {
    return node
  }
  if (ancestors.has(runtime.identity)) {
    node.status = 'cycle'
    return node
  }

  const compilation = Endge.source.compile('composition', model.source)
  const payload = compilation.artifact as CompositionProgramPayload | null
  if (!payload) {
    node.status = 'compile-error'
    node.diagnosticCount = countCompilationErrors(compilation.diagnostics)
    return node
  }

  node.children = buildCompositionContents(
    payload,
    id,
    new Set(ancestors).add(runtime.identity),
  )
  return node
}

function countCompilationErrors(diagnostics: unknown[] | undefined): number {
  return (diagnostics ?? []).filter((item) => {
    return (
      item !== null
      && typeof item === 'object'
      && 'severity' in item
      && item.severity === 'error'
    )
  }).length
}

function buildRuntimeNode(
  payload: CompositionProgramPayload,
  runtime: CompositionRuntimeDescriptor,
  occurrenceId: string,
): CompositionDependencyNode {
  const target = runtimeDocumentTarget(payload, runtime)
  const node = makeDocumentNode({
    id: `${occurrenceId}/runtime:${runtime.path}`,
    kind: 'runtime',
    identity: target.identity,
    alias: runtime.name,
    documentType: target.documentType,
    exists: target.exists,
    activationMode: runtime.effectiveActivation.mode,
  })
  if (runtime.kind === 'filter-view') {
    const source = payload.runtimes.find(item => item.name === runtime.identity && item.kind === 'filter')
    const filter = source && Endge.domain.getFilter(source.identity)
    const compilation = filter ? Endge.source.compile('filter', filter.source) : null
    const artifact = compilation?.artifact as FilterProgramPayload | null
    const fields = artifact?.fields.filter(field => !runtime.fields?.length || runtime.fields.includes(field.key)) ?? []
    const labelsBinding = runtime.props.labels
    const labels = labelsBinding?.kind === 'literal' && labelsBinding.value && typeof labelsBinding.value === 'object'
      ? labelsBinding.value as Record<string, unknown>
      : {}
    node.filterView = {
      sourceId: source ? `${occurrenceId}/runtime:${source.path}` : null,
      fields: fields.map((field) => {
        const label = labels[field.key]
        return { key: field.key, ...(typeof label === 'string' ? { label } : {}) }
      }),
    }
    Object.assign(node, DOCUMENT_AUXILIARY_PRESENTATION.filterView, { badgeIcon: null })
    if (!filter) {
      node.status = 'missing'
    }
    else if (!artifact || runtime.fields?.some(key => !artifact.fields.some(field => field.key === key))) {
      node.status = 'compile-error'
    }
  }
  node.dataDependencies = [...new Set([
    ...Object.values(runtime.props).flatMap(binding => binding.kind === 'data' || binding.kind === 'data-view' ? [binding.data] : []),
    ...runtime.storeTo.map(publication => publication.data),
    ...(runtime.dispatchTo ?? []),
  ])]
  if (target.documentType === ComponentType.SFC) {
    const component = Endge.domain.getComponentSFC(target.identity)
    if (component) {
      const result = compileComponentSFC(component.source, { identity: component.identity })
      node.vocabReferences = [...new Set(result.runtimeDependencies.vocabs?.map(item => item.alias) ?? [])].map(alias => ({ alias }))
    }
  }
  else if (runtime.kind === 'filter' || runtime.kind === 'filter-view') {
    const filter = Endge.domain.getFilter(target.identity)
    if (filter) {
      const payload = Endge.source.compile('filter', filter.source).artifact as FilterProgramPayload | null
      node.vocabReferences = [...new Set(payload?.fields.filter(field => !node.filterView || node.filterView.fields.some(selected => selected.key === field.key)).flatMap(field => field.vocab ? [field.vocab.identity] : []) ?? [])].map(identity => ({ identity }))
    }
  }
  else if (runtime.kind === 'query') {
    const query = Endge.domain.getQuery(target.identity)
    if (query) {
      const payload = Endge.source.compile('query', query.source).artifact as QueryProgramPayload | null
      node.vocabReferences = [...new Set(payload?.props.flatMap(prop => prop.vocab ? [prop.vocab.identity] : []) ?? [])].map(identity => ({ identity }))
    }
  }
  return node
}

function runtimeDocumentTarget(
  payload: CompositionProgramPayload,
  runtime: CompositionRuntimeDescriptor,
): { documentType: DomainDocumentType, identity: string, exists: boolean } {
  if (runtime.kind === 'component') {
    const identity = runtime.componentIdentity ?? runtime.identity
    return {
      documentType: ComponentType.SFC,
      identity,
      exists: Boolean(Endge.domain.getComponentSFC(identity)),
    }
  }
  if (runtime.kind === 'query') {
    const query = Endge.domain.getQuery(runtime.identity)
    return {
      documentType: query?.type ?? QueryType.REST,
      identity: runtime.identity,
      exists: Boolean(query),
    }
  }
  if (runtime.kind === 'stream') {
    return {
      documentType: 'stream',
      identity: runtime.identity,
      exists: Boolean(Endge.domain.getStream(runtime.identity)),
    }
  }
  if (runtime.kind === 'filter') {
    const filter = Endge.domain.getFilter(runtime.identity)
    return {
      documentType: filter?.type ?? FilterType.DefaultFilter,
      identity: runtime.identity,
      exists: Boolean(filter),
    }
  }
  if (runtime.kind === 'filter-view' && runtime.componentIdentity) {
    return {
      documentType: ComponentType.SFC,
      identity: runtime.componentIdentity,
      exists: Boolean(Endge.domain.getComponentSFC(runtime.componentIdentity)),
    }
  }

  const source = payload.runtimes.find(
    item => item.name === runtime.identity && item.kind === 'filter',
  )
  const identity = source?.identity ?? runtime.identity
  const filter = Endge.domain.getFilter(identity)
  return {
    documentType: filter?.type ?? FilterType.DefaultFilter,
    identity,
    exists: Boolean(filter),
  }
}

function makeDocumentNode(input: {
  id: string
  kind: Exclude<DocumentDependencyNodeKind, 'scope'>
  identity: string
  alias: string | null
  documentType: DomainDocumentType
  exists: boolean
  activationMode?: 'startup' | 'manual' | null
  presentationKind?: string
}): CompositionDependencyNode {
  const visual = resolveDomainEntityPresentation(
    input.documentType,
    input.identity,
    input.presentationKind,
  )
  return {
    id: input.id,
    kind: input.kind,
    identity: input.identity,
    alias: input.alias,
    title: visual.title,
    documentType: input.documentType,
    icon: visual.icon,
    colorClass: visual.colorClass,
    badgeIcon: visual.badgeIcon,
    activationMode: input.activationMode ?? null,
    status: input.exists ? 'valid' : 'missing',
    diagnosticCount: 0,
    children: [],
  }
}
