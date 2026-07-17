import type { EndgePreviewTarget, PreviewCompositionAddress, PreviewRuntimeTreeNode } from '@/features/endge-preview/domain/types/preview.types'
/* eslint-disable style/max-statements-per-line */
import type { CompositionProgramPayload, CompositionRuntimeDescriptor, DomainDocumentType } from '@endge/core'

import { ComponentType, Endge, FilterType, QueryType } from '@endge/core'

import { resolveDomainEntityPresentation } from '@/features/endge-configurator/model/presentation/domain-entity-presentation'

export function buildPreviewRuntimeTree(target: EndgePreviewTarget): PreviewRuntimeTreeNode[] {
  if (target.entityType === 'project') { return [buildProjectNode(target.identity)] }
  if (target.entityType === 'composition') { return [buildRootCompositionNode(target.identity)] }
  if (target.entityType === 'component-sfc') { return [buildComponentNode(target.identity)] }
  return [buildStoreNode(target.identity)]
}

function buildProjectNode(identity: string): PreviewRuntimeTreeNode {
  const node = makeNode({
    id: `project:${identity}`,
    kind: 'project',
    entityType: 'project',
    identity,
    ...domainNodeFields('project', identity),
  })
  const compositions = Endge.domain.getCompositions()
    .filter(item => item.kind === 'project' && item.kindIdentity === identity && item.active !== false && !item.deletedAt)
    .sort((left, right) => left.identity.localeCompare(right.identity))
  node.children = compositions.map(composition => buildCompositionNode(
    composition.identity,
    { rootIdentity: composition.identity, invocationPath: [] },
    node.id,
    new Set(),
    Endge.program.getCompositionArtifact(composition.identity)?.payload.activation?.mode ?? 'startup',
    null,
  ))
  return node
}

function buildRootCompositionNode(identity: string): PreviewRuntimeTreeNode {
  return buildCompositionNode(
    identity,
    { rootIdentity: identity, invocationPath: [] },
    null,
    new Set(),
    Endge.program.getCompositionArtifact(identity)?.payload.activation?.mode ?? 'startup',
    null,
  )
}

function buildComponentNode(identity: string): PreviewRuntimeTreeNode {
  return makeNode({
    id: `component-sfc:${identity}`,
    kind: 'component-sfc',
    entityType: 'component-sfc',
    identity,
    ...domainNodeFields(ComponentType.SFC, identity),
    renderable: true,
  })
}

function buildStoreNode(identity: string): PreviewRuntimeTreeNode {
  return makeNode({
    id: `store:${identity}`,
    kind: 'runtime',
    entityType: 'store',
    identity,
    ...domainNodeFields('store', identity),
    renderable: true,
  })
}

function buildCompositionNode(
  identity: string,
  address: PreviewCompositionAddress,
  parentId: string | null,
  ancestors: Set<string>,
  activationMode: 'startup' | 'manual',
  runtimeName: string | null,
): PreviewRuntimeTreeNode {
  const model = Endge.domain.getComposition(identity)
  const nodeId = compositionNodeId(address)
  const node = makeNode({
    id: nodeId,
    parentId,
    kind: 'composition',
    entityType: 'composition',
    identity,
    ...domainNodeFields('composition', identity, runtimeName, String(model?.kind ?? 'library')),
    activationMode,
    composition: address,
  })
  if (ancestors.has(identity)) {
    node.subtitle = 'cycle'
    return node
  }
  const artifact = Endge.program.getCompositionArtifact(identity)
  if (!artifact || artifact.status === 'error') {
    node.subtitle = 'artifact unavailable'
    return node
  }
  const nextAncestors = new Set(ancestors).add(identity)
  node.children = buildScopeContents(artifact.payload, 'scope_default', address, node.id, nextAncestors)
  for (const scope of artifact.payload.scopes.filter(item => item.parentPath === 'scope_default')) { node.children.push(buildScopeNode(artifact.payload, scope.path, address, node.id, nextAncestors)) }
  return node
}

function buildScopeNode(
  payload: CompositionProgramPayload,
  scopePath: string,
  address: PreviewCompositionAddress,
  parentId: string,
  ancestors: Set<string>,
): PreviewRuntimeTreeNode {
  const descriptor = payload.scopes.find(item => item.path === scopePath)!
  const id = `${compositionNodeId(address)}:scope:${scopePath}`
  const node = makeNode({
    id,
    parentId,
    kind: 'scope',
    title: descriptor.name,
    subtitle: null,
    entityType: 'scope',
    identity: scopePath,
    activationMode: descriptor.effectiveActivation.mode,
    composition: address,
    scopePath,
    presentation: {
      documentType: null,
      icon: 'Layers3',
      colorClass: 'text-slate-500',
      badgeIcon: null,
      runtimeName: descriptor.name,
    },
  })
  node.children = buildScopeContents(payload, scopePath, address, id, ancestors)
  for (const child of payload.scopes.filter(item => item.parentPath === scopePath)) { node.children.push(buildScopeNode(payload, child.path, address, id, ancestors)) }
  return node
}

function buildScopeContents(
  payload: CompositionProgramPayload,
  scopePath: string,
  address: PreviewCompositionAddress,
  parentId: string,
  ancestors: Set<string>,
): PreviewRuntimeTreeNode[] {
  const result: PreviewRuntimeTreeNode[] = []
  for (const resource of payload.resources.filter(item => item.scopePath === scopePath)) {
    result.push(makeNode({
      id: `${compositionNodeId(address)}:resource:${resource.path}`,
      parentId,
      kind: 'resource',
      entityType: resource.kind,
      identity: resource.identity,
      ...domainNodeFields('style', resource.identity, resource.name),
      composition: address,
      scopePath,
      resourcePath: resource.path,
    }))
  }
  for (const runtime of payload.runtimes.filter(item => item.scopePath === scopePath)) {
    if (runtime.kind === 'composition') {
      result.push(buildCompositionNode(
        runtime.identity,
        { rootIdentity: address.rootIdentity, invocationPath: [...address.invocationPath, runtime.path] },
        parentId,
        ancestors,
        runtime.effectiveActivation.mode,
        runtime.name,
      ))
      continue
    }
    const target = runtimeDocumentTarget(runtime)
    result.push(makeNode({
      id: `${compositionNodeId(address)}:runtime:${runtime.path}`,
      parentId,
      kind: 'runtime',
      entityType: String(target.documentType),
      identity: target.identity,
      ...domainNodeFields(target.documentType, target.identity, runtime.name),
      activationMode: runtime.effectiveActivation.mode,
      composition: address,
      runtimePath: runtime.path,
      scopePath,
      renderable: runtime.kind === 'component' || runtime.kind === 'filter-view',
    }))
  }
  return result
}

function compositionNodeId(address: PreviewCompositionAddress): string {
  const nested = address.invocationPath.length ? `/${address.invocationPath.join('/')}` : ''
  return `composition:${address.rootIdentity}${nested}`
}

function makeNode(input: Partial<PreviewRuntimeTreeNode> & Pick<PreviewRuntimeTreeNode, 'id' | 'kind' | 'title' | 'entityType' | 'identity'>): PreviewRuntimeTreeNode {
  return {
    parentId: null,
    subtitle: null,
    activationMode: null,
    composition: null,
    runtimePath: null,
    scopePath: null,
    resourcePath: null,
    presentation: null,
    renderable: false,
    children: [],
    ...input,
  }
}

function domainNodeFields(
  documentType: DomainDocumentType,
  identity: string,
  runtimeName: string | null = null,
  presentationKind?: string,
): Pick<PreviewRuntimeTreeNode, 'presentation' | 'subtitle' | 'title'> {
  const resolved = resolveDomainEntityPresentation(documentType, identity, presentationKind)
  return {
    title: resolved.title,
    subtitle: runtimeName,
    presentation: {
      documentType,
      icon: resolved.icon,
      colorClass: resolved.colorClass,
      badgeIcon: resolved.badgeIcon,
      runtimeName,
    },
  }
}

function runtimeDocumentTarget(runtime: CompositionRuntimeDescriptor): {
  documentType: DomainDocumentType
  identity: string
} {
  if (runtime.kind === 'component') {
    return { documentType: ComponentType.SFC, identity: runtime.componentIdentity ?? runtime.identity }
  }
  if (runtime.kind === 'query') {
    const query = Endge.domain.getQuery(runtime.identity)
    return { documentType: query?.type ?? QueryType.REST, identity: runtime.identity }
  }
  if (runtime.kind === 'filter') {
    const filter = Endge.domain.getFilter(runtime.identity)
    return { documentType: filter?.type ?? FilterType.DefaultFilter, identity: runtime.identity }
  }
  if (runtime.kind === 'filter-view' && runtime.componentIdentity) {
    return { documentType: ComponentType.SFC, identity: runtime.componentIdentity }
  }
  return { documentType: FilterType.DefaultFilter, identity: runtime.identity }
}
