import type {
  DocumentDependencyDiagnostic,
  DocumentDependencyNode,
  DocumentDependencyTreeInput,
  DocumentDependencyTreeResult,
} from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import type {
  ComponentSFCCompileResult,
  DataViewProgramPayload,
  DataViewRef,
  DomainDocumentType,
  FilterProgramPayload,
  ProgramDependency,
  ProgramEntityType,
  QueryProgramPayload,
  StoreSourceArtifact,
  TypeSourceDefinition,
} from '@endge/core'

import {
  compileComponentSFC,
  ComponentType,
  Endge,
  FilterType,
  QueryType,
} from '@endge/core'

import { resolveDomainEntityPresentation } from '@/features/endge-ide/model/domain/domain-entity-presentation'
import { normalizeDomainWorkingSetEntityType } from '@/features/endge-ide/tools/resolve-domain-working-set'

interface DocumentRef {
  entityType: string
  id: string | number
  identity: string
}

interface DependencyEdge {
  from: DocumentRef
  to: DocumentRef
  role: string | null
  origin: 'program' | 'source' | 'model' | 'ownership'
}

interface DraftDependencies {
  dependencies: ProgramDependency[]
  diagnostics: DocumentDependencyDiagnostic[]
  compilable: boolean
}

const PROGRAM_ENTITY_TYPES = new Set<ProgramEntityType>([
  'type',
  'component-sfc',
  'computation',
  'action',
  'query',
  'data-view',
  'store',
  'filter',
  'composition',
  'style',
])

const SOURCE_DOCUMENT_TYPES = new Set([
  'type',
  'store',
  'query',
  'data-view',
  'filter',
  'computation',
  'style',
  'component-sfc',
])

const BUILTIN_TYPE_NAMES = new Set([
  'Any',
  'Array',
  'Boolean',
  'Date',
  'DateTime',
  'Function',
  'Map',
  'Never',
  'Null',
  'Number',
  'Object',
  'Record',
  'Set',
  'String',
  'Time',
  'Unknown',
  'Void',
  'any',
  'boolean',
  'never',
  'null',
  'number',
  'object',
  'string',
  'undefined',
  'unknown',
  'void',
])

/** Builds a graph tree for non-Composition documents from Program plus a live draft overlay. */
export function buildDocumentDependencyTree(
  input: DocumentDependencyTreeInput,
): DocumentDependencyTreeResult {
  return buildTree(input, false)
}

/** Adds a reverse `Used by` traversal to the regular downstream tree. */
export function buildDocumentDependencyHierarchy(
  input: DocumentDependencyTreeInput,
): DocumentDependencyTreeResult {
  return buildTree(input, true)
}

function buildTree(
  input: DocumentDependencyTreeInput,
  includeIncoming: boolean,
): DocumentDependencyTreeResult {
  const rootRef = makeRef(input.documentType, input.id ?? input.identity, input.identity)
  const draft = resolveDraftDependencies(input)
  const root = makeNode(rootRef, `document:${refKey(rootRef)}`, null)
  root.title = input.displayName?.trim() || root.title
  root.status = draft && !draft.compilable ? 'compile-error' : 'valid'
  root.diagnosticCount = countErrors(draft?.diagnostics ?? [])

  const overlay = draft?.compilable
    ? new Map([[refKey(rootRef), draft.dependencies]])
    : new Map<string, ProgramDependency[]>()
  const outgoingIndex = buildOutgoingIndex(overlay)
  const rootKey = refKey(rootRef)
  const downstream = buildOutgoingNodes(
    rootRef,
    `${root.id}/dependencies`,
    new Set([rootKey]),
    outgoingIndex,
  )

  if (includeIncoming) {
    const incomingIndex = buildIncomingIndex(outgoingIndex)
    const upstream = buildIncomingNodes(
      rootRef,
      `${root.id}/used-by`,
      new Set([rootKey]),
      incomingIndex,
    )
    root.children = [
      makeGroupNode(`${root.id}/group:used-by`, 'Используется в', 'ArrowUpFromLine', 'text-fuchsia-400', upstream),
      makeGroupNode(`${root.id}/group:dependencies`, 'Зависимости', 'ArrowDownToLine', 'text-sky-400', downstream),
    ]
  }
  else {
    root.children = downstream
  }

  return {
    status: draft && !draft.compilable ? 'compile-error' : 'valid',
    root,
    diagnostics: draft?.diagnostics ?? [],
  }
}

function buildOutgoingIndex(
  overlay: ReadonlyMap<string, readonly ProgramDependency[]>,
): Map<string, DependencyEdge[]> {
  const index = new Map<string, DependencyEdge[]>()

  for (const artifact of Endge.program.getArtifacts()) {
    const from = makeRef(artifact.ref.entityType, artifact.ref.id, artifact.ref.identity)
    const dependencies = overlay.get(refKey(from)) ?? artifact.dependencies
    appendProgramEdges(index, from, dependencies, overlay.has(refKey(from)) ? 'source' : 'program')
  }

  for (const [key, dependencies] of overlay) {
    if (index.has(key)) {
      continue
    }
    const [entityType, ...identityParts] = key.split(':')
    const identity = identityParts.join(':')
    appendProgramEdges(index, makeRef(entityType, identity, identity), dependencies, 'source')
  }

  for (const composition of Endge.domain.getCompositions()) {
    if (composition.kind === 'library' || !composition.kindIdentity) {
      continue
    }
    const owner = makeRef(composition.kind, composition.kindIdentity, composition.kindIdentity)
    const target = makeRef('composition', composition.id ?? composition.identity, composition.identity)
    appendEdge(index, {
      from: owner,
      to: target,
      role: 'owns-composition',
      origin: 'ownership',
    })
  }

  for (const vocab of Endge.domain.getVocabs()) {
    const from = makeRef('vocabs', vocab.id ?? vocab.identity, vocab.identity)
    if (overlay.has(refKey(from))) {
      continue
    }
    const identity = vocab.authMode === 'profile'
      ? String(vocab.authProfileIdentity ?? '').trim()
      : ''
    index.set(refKey(from), [])
    if (identity) {
      appendEdge(index, {
        from,
        to: makeRef('auth-profile', identity, identity),
        role: 'vocab-auth',
        origin: 'model',
      })
    }
  }

  return index
}

function appendProgramEdges(
  index: Map<string, DependencyEdge[]>,
  from: DocumentRef,
  dependencies: readonly ProgramDependency[],
  origin: DependencyEdge['origin'],
): void {
  index.set(refKey(from), [])
  for (const dependency of dependencies) {
    appendEdge(index, {
      from,
      to: makeRef(
        dependency.entityType,
        dependency.id,
        dependency.identity ?? String(dependency.id),
      ),
      role: dependency.role ?? null,
      origin,
    })
  }
}

function appendEdge(index: Map<string, DependencyEdge[]>, edge: DependencyEdge): void {
  const key = refKey(edge.from)
  const list = index.get(key) ?? []
  if (!list.some(item => refKey(item.to) === refKey(edge.to) && item.role === edge.role)) {
    list.push(edge)
  }
  index.set(key, list)
}

function buildIncomingIndex(
  outgoing: ReadonlyMap<string, readonly DependencyEdge[]>,
): Map<string, DependencyEdge[]> {
  const incoming = new Map<string, DependencyEdge[]>()
  for (const edges of outgoing.values()) {
    for (const edge of edges) {
      const key = refKey(edge.to)
      const list = incoming.get(key) ?? []
      list.push(edge)
      incoming.set(key, list)
    }
  }
  return incoming
}

function buildOutgoingNodes(
  ref: DocumentRef,
  occurrenceId: string,
  ancestors: Set<string>,
  index: ReadonlyMap<string, readonly DependencyEdge[]>,
): DocumentDependencyNode[] {
  return (index.get(refKey(ref)) ?? []).map((edge, position) => {
    const key = refKey(edge.to)
    const node = makeNode(edge.to, `${occurrenceId}/${position}:${key}`, edge.role)
    if (ancestors.has(key)) {
      node.status = 'cycle'
      return node
    }
    node.children = buildOutgoingNodes(
      edge.to,
      node.id,
      new Set(ancestors).add(key),
      index,
    )
    return node
  })
}

function buildIncomingNodes(
  ref: DocumentRef,
  occurrenceId: string,
  ancestors: Set<string>,
  index: ReadonlyMap<string, readonly DependencyEdge[]>,
): DocumentDependencyNode[] {
  return (index.get(refKey(ref)) ?? []).map((edge, position) => {
    const key = refKey(edge.from)
    const node = makeNode(edge.from, `${occurrenceId}/${position}:${key}`, edge.role)
    if (ancestors.has(key)) {
      node.status = 'cycle'
      return node
    }
    node.children = buildIncomingNodes(
      edge.from,
      node.id,
      new Set(ancestors).add(key),
      index,
    )
    return node
  })
}

function makeNode(ref: DocumentRef, id: string, relationRole: string | null): DocumentDependencyNode {
  const documentType = resolveDocumentType(ref.entityType, ref.identity)
  const presentationType = documentType ?? fallbackPresentationType(ref.entityType)
  const visual = resolveDomainEntityPresentation(presentationType, ref.identity)
  const exists = documentExists(documentType, ref.identity)
  return {
    id,
    kind: ref.entityType === 'composition' ? 'composition' : 'document',
    identity: ref.identity,
    alias: null,
    title: visual.title,
    documentType: exists ? documentType : null,
    icon: visual.icon,
    colorClass: visual.colorClass,
    badgeIcon: visual.badgeIcon,
    activationMode: null,
    status: exists ? 'valid' : 'missing',
    diagnosticCount: 0,
    relationRole,
    children: [],
  }
}

function makeGroupNode(
  id: string,
  title: string,
  icon: string,
  colorClass: string,
  children: DocumentDependencyNode[],
): DocumentDependencyNode {
  return {
    id,
    kind: 'group',
    identity: id,
    alias: null,
    title,
    documentType: null,
    icon,
    colorClass,
    badgeIcon: null,
    activationMode: null,
    status: 'valid',
    diagnosticCount: 0,
    children,
  }
}

function resolveDraftDependencies(input: DocumentDependencyTreeInput): DraftDependencies | null {
  const documentType = normalizeDomainWorkingSetEntityType(String(input.documentType))
  if (documentType === 'vocabs' && input.draft && typeof input.draft === 'object') {
    const draft = input.draft as Record<string, unknown>
    const identity = draft.authMode === 'profile'
      ? String(draft.authProfileIdentity ?? '').trim()
      : ''
    return {
      dependencies: identity ? [makeDependency('auth-profile', identity, 'vocab-auth')] : [],
      diagnostics: [],
      compilable: true,
    }
  }
  if (!input.source || !SOURCE_DOCUMENT_TYPES.has(documentType)) {
    return null
  }

  if (documentType === 'component-sfc') {
    const result = compileComponentSFC(input.source, {
      identity: input.identity,
      resolveComponentTag: tag => Endge.program.resolveComponentTag(tag),
      hasComponentIdentity: identity => Endge.domain.getComponentSFC(identity) != null,
    })
    return dependenciesFromSFC(result, input.source)
  }

  const result = Endge.source.compile(documentType, input.source)
  const diagnostics = (result.diagnostics ?? []) as DocumentDependencyDiagnostic[]
  if (!result.artifact) {
    return { dependencies: [], diagnostics, compilable: false }
  }

  return {
    dependencies: extractArtifactDependencies(documentType, result.artifact, input.draft),
    diagnostics,
    compilable: true,
  }
}

function extractArtifactDependencies(
  entityType: string,
  payload: any,
  draft: any,
): ProgramDependency[] {
  const dependencies: ProgramDependency[] = []

  if (entityType === 'type') {
    collectTypeDefinitionReferences(payload.definition, dependencies)
  }
  else if (entityType === 'store') {
    for (const field of (payload as StoreSourceArtifact).data ?? []) {
      if (field.kind === 'value' && field.initial.kind === 'mock') {
        dependencies.push(makeDependency('mock-data', field.initial.identity, `store-initial:${field.key}`))
      }
      else if (field.kind === 'derived') {
        collectDataViewDependencies(field.dataViews, dependencies, `store-derived:${field.key}`)
      }
    }
  }
  else if (entityType === 'filter') {
    for (const field of (payload as FilterProgramPayload).fields ?? []) {
      if (field.vocab) {
        dependencies.push(makeDependency('vocabs', field.vocab.identity, 'vocab'))
      }
      collectContractType(field.type, dependencies)
    }
  }
  else if (entityType === 'query') {
    const query = payload as QueryProgramPayload
    for (const prop of query.props ?? []) {
      collectContractType(prop.type, dependencies)
      collectTypeExpressionReferences(prop.typeExpression, dependencies)
      if (prop.vocab) {
        dependencies.push(makeDependency('vocabs', prop.vocab.identity, 'vocab'))
      }
      if (prop.defaultSource?.kind === 'filter') {
        dependencies.push(makeDependency('filter', prop.defaultSource.identity, 'query-prop-filter'))
      }
    }
    for (const output of query.outputs ?? []) {
      collectDataViewDependencies(output.dataViews, dependencies, `query-output:${output.key}`)
    }
    const auth = query.auth
    if (auth && typeof auth === 'object' && !Array.isArray(auth) && !('type' in auth)) {
      const authRecord = auth as Record<string, unknown>
      const profile = String(authRecord.profile ?? authRecord.authProfileIdentity ?? '').trim()
      if (profile) {
        dependencies.push(makeDependency('auth-profile', profile, 'query-auth'))
      }
    }
  }
  else if (entityType === 'data-view') {
    const document = (payload as DataViewProgramPayload).sourceDocument
    for (const step of document?.steps ?? []) {
      if (step.type === 'from') {
        collectDataViewDependencies(step.dataViews ?? [], dependencies, 'data-view-source')
      }
    }
  }
  else if (entityType === 'computation') {
    for (const node of payload.nodes ?? []) {
      if (node.kind === 'computation') {
        dependencies.push(makeDependency('computation', node.identity, `computation-call:${node.name}`))
      }
    }
    collectContractType(draft?.inputType, dependencies)
    collectContractType(draft?.outputType, dependencies)
  }
  else if (entityType === 'style') {
    dependencies.push(...(payload.dependencies ?? []))
  }

  return dedupeDependencies(dependencies)
}

function dependenciesFromSFC(result: ComponentSFCCompileResult, source: string): DraftDependencies {
  const dependencies: ProgramDependency[] = [
    ...result.dependencies.components.map(item => makeDependency('component-sfc', item.id, item.role ?? 'child-component')),
    ...result.dependencies.computations.map(item => makeDependency('computation', item.id, item.role)),
    ...result.dependencies.actions.map(identity => makeDependency('action', identity, 'port-default-action')),
  ]
  const localTypes = collectLocalTypeDeclarations(source)
  for (const input of result.contract.inputs) {
    collectContractType(input.type, dependencies, localTypes)
  }
  for (const event of result.contract.events) {
    collectContractType(event.payloadType, dependencies, localTypes)
  }
  const diagnostics = result.diagnostics as DocumentDependencyDiagnostic[]
  return {
    dependencies: dedupeDependencies(dependencies),
    diagnostics,
    compilable: result.ast != null,
  }
}

function collectTypeDefinitionReferences(
  definition: TypeSourceDefinition | null | undefined,
  target: ProgramDependency[],
): void {
  if (!definition) {
    return
  }
  if (definition.kind === 'object') {
    for (const field of definition.fields) {
      collectTypeExpressionReferences(field.type, target)
    }
  }
  else if (definition.kind === 'union') {
    for (const variant of definition.variants) {
      collectTypeExpressionReferences(variant, target)
    }
  }
  else if (definition.kind === 'array') {
    collectTypeExpressionReferences(definition.items, target)
  }
}

function collectTypeExpressionReferences(expression: any, target: ProgramDependency[]): void {
  if (!expression) {
    return
  }
  if (expression.kind === 'reference') {
    target.push(makeDependency('type', expression.identity, 'type-reference'))
    return
  }
  if (expression.kind === 'record') {
    collectTypeExpressionReferences(expression.values, target)
    return
  }
  collectTypeDefinitionReferences(expression, target)
}

function collectDataViewDependencies(
  refs: readonly DataViewRef[],
  target: ProgramDependency[],
  role: string,
): void {
  for (const ref of refs) {
    if (ref.kind === 'external') {
      target.push(makeDependency('data-view', ref.identity, role))
    }
  }
}

function collectContractType(
  value: unknown,
  target: ProgramDependency[],
  excluded: ReadonlySet<string> = new Set(),
): void {
  const source = String(value ?? '').trim()
  if (!source) {
    return
  }
  for (const token of source.match(/[A-Z_$][\w$.-]*/gi) ?? []) {
    if (BUILTIN_TYPE_NAMES.has(token) || excluded.has(token) || !/^[A-Z]/.test(token)) {
      continue
    }
    target.push(makeDependency('type', token, 'type-reference'))
  }
}

function collectLocalTypeDeclarations(source: string): Set<string> {
  const identities = new Set<string>()
  for (const match of source.matchAll(/\b(?:interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    if (match[1]) {
      identities.add(match[1])
    }
  }
  return identities
}

function makeDependency(
  entityType: string,
  id: string | number,
  role?: string,
): ProgramDependency {
  return { entityType, id, identity: String(id), role }
}

function dedupeDependencies(items: ProgramDependency[]): ProgramDependency[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.entityType}:${item.identity ?? item.id}:${item.role ?? ''}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function makeRef(entityType: string, id: string | number, identity: string): DocumentRef {
  return {
    entityType: normalizeDomainWorkingSetEntityType(String(entityType)),
    id,
    identity: String(identity || id).trim(),
  }
}

function refKey(ref: DocumentRef): string {
  return `${normalizeDomainWorkingSetEntityType(ref.entityType)}:${ref.identity || String(ref.id)}`
}

function resolveDocumentType(entityType: string, identity: string): DomainDocumentType | null {
  const normalized = normalizeDomainWorkingSetEntityType(entityType)
  if (normalized === 'query') {
    return Endge.domain.getQuery(identity)?.type ?? QueryType.REST
  }
  if (normalized === 'filter') {
    return FilterType.DefaultFilter
  }
  if (normalized === 'mock') {
    return 'mock'
  }
  if (normalized === 'type') {
    return Endge.domain.getType(identity)?.isPrimitive ? null : 'type'
  }
  if (normalized === 'component-sfc') {
    return ComponentType.SFC
  }
  if (normalized === 'workspace') {
    return null
  }
  return normalized as DomainDocumentType
}

function fallbackPresentationType(entityType: string): DomainDocumentType {
  const normalized = normalizeDomainWorkingSetEntityType(entityType)
  if (normalized === 'query') {
    return QueryType.REST
  }
  if (normalized === 'filter') {
    return FilterType.DefaultFilter
  }
  if (normalized === 'type') {
    return 'type'
  }
  return normalized as DomainDocumentType
}

function documentExists(documentType: DomainDocumentType | null, identity: string): boolean {
  if (!documentType) {
    return false
  }
  const key = String(documentType)
  if (key.startsWith('query-')) {
    return Endge.domain.getQuery(identity) != null
  }
  if (key === String(FilterType.DefaultFilter)) {
    return Endge.domain.getFilter(identity) != null
  }
  if (key === String(ComponentType.SFC)) {
    return Endge.domain.getComponentSFC(identity) != null
  }
  const programType = normalizeDomainWorkingSetEntityType(key)
  if (PROGRAM_ENTITY_TYPES.has(programType as ProgramEntityType)) {
    return Endge.program.getArtifact(programType as ProgramEntityType, identity) != null
      || resolveDomainDocument(programType, identity) != null
  }
  return resolveDomainDocument(programType, identity) != null
}

function resolveDomainDocument(entityType: string, identity: string): unknown {
  switch (entityType) {
    case 'type':
      return Endge.domain.getType(identity)
    case 'component-sfc':
      return Endge.domain.getComponentSFC(identity)
    case 'computation':
      return Endge.domain.getComputation(identity)
    case 'action':
      return Endge.domain.getAction(identity)
    case 'query':
      return Endge.domain.getQuery(identity)
    case 'data-view':
      return Endge.domain.getDataView(identity)
    case 'store':
      return Endge.domain.getStore(identity)
    case 'filter':
      return Endge.domain.getFilter(identity)
    case 'composition':
      return Endge.domain.getComposition(identity)
    case 'style':
      return Endge.domain.getStyle(identity)
    case 'mock':
      return Endge.domain.getMock(identity)
    case 'vocabs':
      return Endge.domain.getVocab(identity)
    case 'auth-profile':
      return Endge.domain.getAuthProfile(identity)
    case 'project':
      return Endge.domain.getProject(identity)
    case 'tenant':
      return Endge.domain.getTenant(identity)
    case 'environment':
      return Endge.domain.getEnvironment(identity)
    default:
      return null
  }
}

function countErrors(diagnostics: readonly DocumentDependencyDiagnostic[]): number {
  return diagnostics.filter(item => item.severity === 'error').length
}
