import type { DomainDocumentType, EndgeRuntimeSnapshot, RuntimeControlTarget, RuntimeHostSnapshot } from '@endge/core'
import type { RuntimePreviewLifecycleState, RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'
import { getDomainDocumentPresentation } from '@/features/document-presentation/tools/resolve-document-presentation'

export interface RuntimeInspectionTree {
  roots: RuntimePreviewTreeNode[]
  nodes: Map<string, RuntimePreviewTreeNode>
  targets: Map<string, RuntimeControlTarget>
  states: Map<string, RuntimePreviewLifecycleState>
}

/** Строит UI только из наблюдаемых экземпляров; владение host и membership scope не смешиваются. */
export function buildRuntimeInspectionTree(
  runtime: EndgeRuntimeSnapshot,
  documentType: (host: RuntimeHostSnapshot) => DomainDocumentType = host => host.entityType as DomainDocumentType,
): RuntimeInspectionTree {
  const nodes = new Map<string, RuntimePreviewTreeNode>()
  const targets = new Map<string, RuntimeControlTarget>()
  const states = new Map<string, RuntimePreviewLifecycleState>()
  const scopes = new Map(runtime.scopes.map(scope => [scope.id, scope]))
  const membership = new Map<string, string>()
  const ownScope = new Map<string, string>()
  for (const scope of runtime.scopes) {
    for (const id of scope.memberRuntimeIds) {
      membership.set(id, scope.id)
    }
    if (scope.ownerRuntimeId && scope.path === 'scope_default') {
      ownScope.set(scope.ownerRuntimeId, scope.id)
    }
  }
  const make = (input: Pick<RuntimePreviewTreeNode, 'id' | 'kind' | 'title' | 'identity' | 'entityType'>): RuntimePreviewTreeNode => ({
    parentId: null,
    subtitle: null,
    activationMode: null,
    composition: null,
    runtimePath: null,
    scopePath: null,
    resourcePath: null,
    renderable: false,
    presentation: null,
    children: [],
    ...input,
  })
  for (const host of runtime.hosts) {
    const id = `host:${host.id}`
    const type = documentType(host)
    const scope = scopes.get(membership.get(host.id) ?? '')
    const node = make({ id, kind: host.entityType === 'project' || host.entityType === 'composition' || host.entityType === 'simulation' || host.entityType === 'component-sfc' ? host.entityType : 'runtime', title: host.title, identity: host.entityIdentity, entityType: type })
    node.subtitle = host.id
    node.runtimePath = host.basePath
    node.renderable = host.capabilities.includes('renderable')
    node.runtimeKind = host.runtimeType === 'filter-view-runtime-host' ? 'filter-view' : undefined
    node.parentId = scope && scope.ownerRuntimeId !== host.id ? `scope:${scope.id}` : host.parentId ? `host:${host.parentId}` : null
    node.presentation = { ...getDomainDocumentPresentation(type), documentType: type, badgeIcon: getDomainDocumentPresentation(type).badgeIcon ?? null, runtimeName: null }
    nodes.set(id, node)
    targets.set(id, { kind: 'host', id: host.id, createdAt: host.createdAt })
    const graphScope = scopes.get(ownScope.get(host.id) ?? '')
    states.set(id, inspectionLifecycleState(graphScope?.state ?? host.status))
  }
  for (const scope of runtime.scopes) {
    const id = `scope:${scope.id}`
    const node = make({ id, kind: 'scope', title: scope.path || scope.id, identity: scope.path, entityType: 'scope' })
    const parent = scopes.get(scope.parentScopeId ?? '')
    node.parentId = parent && parent.ownerRuntimeId === scope.ownerRuntimeId
      ? `scope:${parent.id}`
      : scope.ownerRuntimeId ? `host:${scope.ownerRuntimeId}` : parent ? `scope:${parent.id}` : null
    node.scopePath = scope.path
    node.subtitle = scope.id
    node.presentation = { icon: 'Layers', colorClass: 'text-muted-foreground', badgeIcon: null, documentType: null, runtimeName: null }
    nodes.set(id, node)
    targets.set(id, { kind: 'scope', id: scope.id, generation: scope.generation })
    states.set(id, inspectionLifecycleState(scope.state))
  }
  // Объединённые host/scope edges могут образовать цикл даже при валидности каждой иерархии отдельно.
  const visited = new Set<string>()
  for (const node of nodes.values()) {
    const branch = new Set<string>()
    let current: RuntimePreviewTreeNode | undefined = node
    while (current && !visited.has(current.id)) {
      branch.add(current.id)
      if (current.parentId && branch.has(current.parentId)) {
        current.parentId = null
      }
      current = current.parentId ? nodes.get(current.parentId) : undefined
    }
    for (const id of branch) {
      visited.add(id)
    }
  }
  const roots: RuntimePreviewTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) {
      parent.children.push(node)
    }
    else {
      node.parentId = null
      roots.push(node)
    }
  }
  return { roots, nodes, targets, states }
}

/** Нормализует только фактическое состояние, без локальных lifecycle вызовов. */
export function inspectionLifecycleState(status: string): RuntimePreviewLifecycleState {
  if (status === 'active' || status === 'running') {
    return 'active'
  }
  if (status === 'paused' || status === 'pausing' || status === 'error' || status === 'activating') {
    return status
  }
  if (status === 'destroyed' || status === 'disposed' || status === 'unmounted') {
    return 'disposed'
  }
  if (status === 'stopped' || status === 'stopping' || status === 'deactivating') {
    return 'stopped'
  }
  if (status === 'resuming') {
    return 'activating'
  }
  return 'inactive'
}
