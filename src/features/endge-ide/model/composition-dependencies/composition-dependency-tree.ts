import type {
  DocumentDependencyDiagnostic,
  DocumentDependencyNode,
  DocumentDependencyTreeResult,
} from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import type {
  CompositionProgramPayload,
  CompositionRuntimeDescriptor,
  CompositionSourceDocument,
  DomainDocumentType,
  RComposition,
} from '@endge/core'

import { ComponentType, Endge, FilterType, QueryType } from '@endge/core'

import { countDocumentDependencies } from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import { resolveDomainEntityPresentation } from '@/features/endge-ide/model/domain/domain-entity-presentation'

export type CompositionDependencyNode = DocumentDependencyNode
export type CompositionDependencyTreeResult = DocumentDependencyTreeResult
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

  const ownerType = composition.kind as Extract<
    DomainDocumentType,
    'project' | 'tenant' | 'environment' | 'workspace'
  >
  const exists = ownerType === 'project'
    ? Boolean(Endge.domain.getProject(identity))
    : ownerType === 'tenant'
      ? Boolean(Endge.domain.getTenant(identity))
      : ownerType === 'environment'
        ? Boolean(Endge.domain.getEnvironment(identity))
        : Endge.workspace.current.identity === identity
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
  const result = payload.data.map(data =>
    makeDocumentNode({
      id: `${occurrenceId}/data:${data.name}`,
      kind: 'data',
      identity: data.identity,
      alias: data.name,
      documentType: data.kind === 'store' ? 'store' : 'vocabs',
      exists:
        data.kind === 'store'
          ? Boolean(Endge.domain.getStore(data.identity))
          : Boolean(Endge.domain.getVocab(data.identity)),
    }),
  )

  result.push(
    ...buildScopeContents(payload, 'scope_default', occurrenceId, ancestors),
  )
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
    icon: 'Layers3',
    colorClass: 'text-slate-500',
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
  const result = payload.resources
    .filter(item => item.scopePath === scopePath)
    .map(resource =>
      makeDocumentNode({
        id: `${occurrenceId}/resource:${resource.path}`,
        kind: 'resource',
        identity: resource.identity,
        alias: resource.name,
        documentType: 'style',
        exists: Boolean(Endge.domain.getStyle(resource.identity)),
      }),
    )

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
  return makeDocumentNode({
    id: `${occurrenceId}/runtime:${runtime.path}`,
    kind: 'runtime',
    identity: target.identity,
    alias: runtime.name,
    documentType: target.documentType,
    exists: target.exists,
    activationMode: runtime.effectiveActivation.mode,
  })
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
  kind: Exclude<CompositionDependencyNodeKind, 'scope'>
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
