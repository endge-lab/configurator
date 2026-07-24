/* eslint-disable style/max-statements-per-line */
import type {
  RuntimePreviewCompositionAddress,
  RuntimePreviewOccurrence,
  RuntimePreviewTarget,
} from '@/features/endge-ide/domain/types/runtime-preview.types'
import type {
  ComponentSFCProgramPayload,
  CompositionProgramPayload,
  CompositionRuntimeDescriptor,
  ProgramArtifact,
  RuntimeArtifactReader,
} from '@endge/core'

import { Endge } from '@endge/core'

interface TraversalContext {
  projectIdentity: string
  target: RuntimePreviewTarget
  artifacts: RuntimeArtifactReader
  occurrences: RuntimePreviewOccurrence[]
}

/** Finds persisted usages without mounting Runtime or evaluating authored source. */
export function findRuntimePreviewOccurrences(
  target: RuntimePreviewTarget,
  projectIdentity: string,
  artifacts: RuntimeArtifactReader = Endge.program,
): RuntimePreviewOccurrence[] {
  if (target.entityType !== 'composition' && target.entityType !== 'component-sfc') { return [] }
  const normalizedProject = String(projectIdentity ?? '').trim()
  if (!normalizedProject || !Endge.domain.getProject(normalizedProject)) { return [] }

  const context: TraversalContext = {
    projectIdentity: normalizedProject,
    target,
    artifacts,
    occurrences: [],
  }
  const roots = Endge.domain.getCompositions()
    .filter(item =>
      item.kind === 'project'
      && item.kindIdentity === normalizedProject
      && item.active !== false
      && !item.deletedAt,
    )
    .sort((left, right) => left.identity.localeCompare(right.identity))

  for (const root of roots) {
    visitComposition(context, root.identity, {
      rootIdentity: root.identity,
      invocationPath: [],
    }, [entityTitle('composition', root.identity)], new Set())
  }
  return context.occurrences
}

function visitComposition(
  context: TraversalContext,
  identity: string,
  address: RuntimePreviewCompositionAddress,
  path: string[],
  ancestors: Set<string>,
): void {
  if (ancestors.has(identity)) { return }
  const artifact = context.artifacts.getArtifact<CompositionProgramPayload>('composition', identity)
  if (!artifact || artifact.status === 'error') { return }

  const branchMayExecuteQueries = compositionMayExecuteQueries(
    identity,
    context.artifacts,
    new Set(),
  )
  if (context.target.entityType === 'composition' && identity === context.target.identity) {
    context.occurrences.push(makeOccurrence(context, {
      kind: 'composition',
      address,
      runtimePath: null,
      path,
      renderComponentIdentity: null,
      mayExecuteQueries: branchMayExecuteQueries,
    }))
  }

  const nextAncestors = new Set(ancestors).add(identity)
  for (const runtime of artifact.payload.runtimes) {
    const runtimePath = [...path, runtime.name]
    if (runtime.kind === 'composition') {
      visitComposition(
        context,
        runtime.identity,
        {
          rootIdentity: address.rootIdentity,
          invocationPath: [...address.invocationPath, runtime.path],
        },
        runtimePath,
        nextAncestors,
      )
      continue
    }
    if (context.target.entityType !== 'component-sfc') { continue }
    const hostComponentIdentity = runtimeComponentIdentity(runtime)
    if (!hostComponentIdentity) { continue }

    const componentPath = findComponentPath(
      hostComponentIdentity,
      context.target.identity,
      context.artifacts,
      new Set(),
    )
    if (!componentPath) { continue }
    context.occurrences.push(makeOccurrence(context, {
      kind: 'component-runtime',
      address,
      runtimePath: runtime.path,
      path: [...runtimePath, ...componentPath.slice(1).map(componentIdentity => entityTitle('component-sfc', componentIdentity))],
      renderComponentIdentity: componentPath.length > 1 ? context.target.identity : null,
      mayExecuteQueries: branchMayExecuteQueries,
    }))
  }
}

function makeOccurrence(
  context: TraversalContext,
  input: {
    kind: RuntimePreviewOccurrence['kind']
    address: RuntimePreviewCompositionAddress
    runtimePath: string | null
    path: string[]
    renderComponentIdentity: string | null
    mayExecuteQueries: boolean
  },
): RuntimePreviewOccurrence {
  const nodeId = input.runtimePath
    ? `${compositionNodeId(input.address)}:runtime:${input.runtimePath}`
    : compositionNodeId(input.address)
  const componentSuffix = input.renderComponentIdentity
    ? `:component:${input.renderComponentIdentity}`
    : ''
  return {
    id: `${nodeId}${componentSuffix}`,
    kind: input.kind,
    projectIdentity: context.projectIdentity,
    nodeId,
    composition: input.address,
    runtimePath: input.runtimePath,
    path: input.path,
    renderComponentIdentity: input.renderComponentIdentity,
    mayExecuteQueries: input.mayExecuteQueries,
  }
}

function findComponentPath(
  currentIdentity: string,
  targetIdentity: string,
  artifacts: RuntimeArtifactReader,
  ancestors: Set<string>,
): string[] | null {
  if (currentIdentity === targetIdentity) { return [currentIdentity] }
  if (ancestors.has(currentIdentity)) { return null }
  const artifact = artifacts.getArtifact<ComponentSFCProgramPayload>('component-sfc', currentIdentity)
  if (!artifact || artifact.status === 'error') { return null }

  const nextAncestors = new Set(ancestors).add(currentIdentity)
  for (const childIdentity of componentDependencyIdentities(artifact)) {
    const nested = findComponentPath(childIdentity, targetIdentity, artifacts, nextAncestors)
    if (nested) { return [currentIdentity, ...nested] }
  }
  return null
}

function componentDependencyIdentities(
  artifact: ProgramArtifact<ComponentSFCProgramPayload>,
): string[] {
  const result: string[] = []
  for (const dependency of artifact.payload.dependencies.components) {
    const model = Endge.domain.getComponentSFC(dependency.id)
    const identity = model?.identity ?? String(dependency.id)
    if (!result.includes(identity)) { result.push(identity) }
  }
  return result
}

function compositionMayExecuteQueries(
  identity: string,
  artifacts: RuntimeArtifactReader,
  ancestors: Set<string>,
): boolean {
  if (ancestors.has(identity)) { return false }
  const artifact = artifacts.getArtifact<CompositionProgramPayload>('composition', identity)
  if (!artifact || artifact.status === 'error') { return false }
  if (artifact.payload.graph.mounts.length > 0) { return true }
  const nextAncestors = new Set(ancestors).add(identity)
  return artifact.payload.runtimes
    .filter(runtime => runtime.kind === 'composition')
    .some(runtime => compositionMayExecuteQueries(runtime.identity, artifacts, nextAncestors))
}

function runtimeComponentIdentity(runtime: CompositionRuntimeDescriptor): string | null {
  if (runtime.kind === 'component') { return runtime.componentIdentity ?? runtime.identity }
  if (runtime.kind === 'filter-view') { return runtime.componentIdentity ?? null }
  return null
}

function entityTitle(entityType: 'composition' | 'component-sfc', identity: string): string {
  const model = entityType === 'composition'
    ? Endge.domain.getComposition(identity)
    : Endge.domain.getComponentSFC(identity)
  return model?.displayName || model?.name || identity
}

function compositionNodeId(address: RuntimePreviewCompositionAddress): string {
  const nested = address.invocationPath.length ? `/${address.invocationPath.join('/')}` : ''
  return `composition:${address.rootIdentity}${nested}`
}
