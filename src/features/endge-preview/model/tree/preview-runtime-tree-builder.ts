import type { EndgePreviewTarget, PreviewCompositionAddress, PreviewRuntimeTreeNode } from '@/features/endge-preview/domain/types/preview.types'
/* eslint-disable style/max-statements-per-line */
import type { CompositionProgramPayload } from '@endge/core'

import { Endge } from '@endge/core'

export function buildPreviewRuntimeTree(target: EndgePreviewTarget): PreviewRuntimeTreeNode[] {
  if (target.entityType === 'project') { return [buildProjectNode(target.identity)] }
  if (target.entityType === 'composition') { return [buildRootCompositionNode(target.identity)] }
  if (target.entityType === 'component-sfc') { return [buildComponentNode(target.identity)] }
  return [buildStoreNode(target.identity)]
}

function buildProjectNode(identity: string): PreviewRuntimeTreeNode {
  const project = Endge.domain.getProject(identity)
  const node = makeNode({
    id: `project:${identity}`,
    kind: 'project',
    title: project?.displayName ?? project?.name ?? identity,
    subtitle: identity,
    entityType: 'project',
    identity,
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
  )
}

function buildComponentNode(identity: string): PreviewRuntimeTreeNode {
  const model = Endge.domain.getComponentSFC(identity)
  return makeNode({
    id: `component-sfc:${identity}`,
    kind: 'component-sfc',
    title: model?.displayName ?? model?.name ?? identity,
    subtitle: identity,
    entityType: 'component-sfc',
    identity,
    renderable: true,
  })
}

function buildStoreNode(identity: string): PreviewRuntimeTreeNode {
  const model = Endge.domain.getStore(identity)
  return makeNode({
    id: `store:${identity}`,
    kind: 'runtime',
    title: model?.displayName ?? model?.name ?? identity,
    subtitle: identity,
    entityType: 'store',
    identity,
    renderable: true,
  })
}

function buildCompositionNode(
  identity: string,
  address: PreviewCompositionAddress,
  parentId: string | null,
  ancestors: Set<string>,
  activationMode: 'startup' | 'manual',
): PreviewRuntimeTreeNode {
  const model = Endge.domain.getComposition(identity)
  const nodeId = compositionNodeId(address)
  const node = makeNode({
    id: nodeId,
    parentId,
    kind: 'composition',
    title: model?.displayName ?? model?.name ?? identity,
    subtitle: identity,
    entityType: 'composition',
    identity,
    activationMode,
    composition: address,
  })
  if (ancestors.has(identity)) {
    node.subtitle = `${identity} · cycle`
    return node
  }
  const artifact = Endge.program.getCompositionArtifact(identity)
  if (!artifact || artifact.status === 'error') {
    node.subtitle = `${identity} · artifact unavailable`
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
    subtitle: scopePath,
    entityType: 'scope',
    identity: scopePath,
    activationMode: descriptor.effectiveActivation.mode,
    composition: address,
    scopePath,
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
      title: resource.name,
      subtitle: resource.identity,
      entityType: resource.kind,
      identity: resource.identity,
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
      ))
      continue
    }
    const identity = runtime.componentIdentity ?? runtime.identity
    result.push(makeNode({
      id: `${compositionNodeId(address)}:runtime:${runtime.path}`,
      parentId,
      kind: 'runtime',
      title: runtime.name,
      subtitle: identity,
      entityType: runtime.kind === 'component' ? 'component-sfc' : runtime.kind,
      identity,
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
    renderable: false,
    children: [],
    ...input,
  }
}
