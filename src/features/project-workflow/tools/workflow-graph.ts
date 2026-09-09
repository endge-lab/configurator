import type { WorkflowDependency, WorkflowNodeData } from '../domain/ProjectWorkflow'

export interface WorkflowRelation {
  source: string
  target: string
  kind: 'includes' | 'uses'
  borrowed?: boolean
  alias?: string | null
}

export interface WorkflowGraph {
  nodes: Map<string, WorkflowNodeData>
  children: Map<string, string[]>
  resources: Map<string, string[]>
  resourceOwners: Map<string, string>
  relations: WorkflowRelation[]
  roots: string[]
}

type Providers = Map<string, Set<string>>

/** Строит визуальные экземпляры и связи использования, не создавая runtime и не меняя Source. */
export function buildWorkflowGraph(roots: WorkflowDependency[]): WorkflowGraph {
  const graph: WorkflowGraph = {
    nodes: new Map(),
    children: new Map(),
    resources: new Map(),
    resourceOwners: new Map(),
    relations: [],
    roots: [],
  }
  const add = (node: WorkflowDependency): void => {
    const { children, ...data } = node
    graph.nodes.set(node.id, data)
    graph.children.set(node.id, [])
  }
  const include = (parent: string, child: string): void => {
    graph.children.get(parent)!.push(child)
    graph.relations.push({ source: parent, target: child, kind: 'includes' })
  }
  const use = (owner: string, source: WorkflowDependency, target: string): void => {
    graph.relations.push({ source: owner, target, kind: 'uses', borrowed: target !== source.id, alias: source.alias })
  }
  const visitComposition = (
    composition: WorkflowDependency,
    ancestorProviders: Providers[],
    parentAliases: Map<string, string>,
    inheritedResources: Map<string, string>,
    inheritedVocabAliases: Map<string, string>,
  ): void => {
    const providers: Providers = new Map()
    const aliases = new Map<string, string>()
    const resolvedStores = new Map<string, string>()
    const storeNodes: WorkflowDependency[] = []
    const collectStores = (owner: WorkflowDependency): void => {
      for (const child of owner.children) {
        if (child.documentType === 'store' && child.kind === 'data') {
          storeNodes.push(child)
        }
        else if (child.kind === 'scope') {
          collectStores(child)
        }
      }
    }
    collectStores(composition)
    for (const source of storeNodes) {
      const descriptor = source.dataSource
      const key = JSON.stringify([source.identity, descriptor?.slot ?? null])
      const explicit = composition.dataBindings?.[descriptor?.path ?? source.alias ?? '']
        ?? composition.dataBindings?.[source.alias ?? '']
      let target: string | undefined
      let issue: WorkflowNodeData['bindingIssue']
      if (explicit != null) {
        target = parentAliases.get(explicit)
        if (!target || graph.nodes.get(target)?.identity !== source.identity) {
          target = undefined
          issue = 'explicit-provider'
        }
      }
      else if (descriptor?.resolution !== 'isolated') {
        const candidates = ancestorProviders.find(frame => frame.has(key))?.get(key)
        if (candidates?.size === 1) {
          target = [...candidates][0]
        }
        else if (candidates && candidates.size > 1) {
          issue = 'ambiguous-provider'
        }
        else if (descriptor?.resolution === 'injected') {
          issue = 'missing-provider'
        }
      }
      if (source.status !== 'valid') {
        target = undefined
      }
      if (!target) {
        target = source.id
        add(source)
        if (issue) {
          graph.nodes.set(target, { ...graph.nodes.get(target)!, status: 'compile-error', bindingIssue: issue })
        }
      }
      resolvedStores.set(source.id, target)
      aliases.set(descriptor?.path ?? source.alias ?? source.id, target)
      const instances = providers.get(key) ?? new Set<string>()
      instances.add(target)
      providers.set(key, instances)
    }

    const visitOwner = (owner: WorkflowDependency, inherited: Map<string, string>, inheritedVocabs: Map<string, string>): void => {
      add(owner)
      const resources = new Map(inherited)
      const vocabAliases = new Map(inheritedVocabs)
      for (const child of owner.children) {
        if (child.kind !== 'data' && child.kind !== 'resource') {
          continue
        }
        if (child.documentType === 'store') {
          const target = resolvedStores.get(child.id)!
          if (target === child.id) {
            graph.children.get(owner.id)!.push(target)
          }
          use(owner.id, child, target)
          continue
        }
        const key = JSON.stringify([child.documentType, child.identity])
        const inheritedId = resources.get(key)
        const target = child.status === 'valid' && inheritedId && graph.nodes.get(inheritedId)?.status === 'valid'
          ? inheritedId
          : child.id
        if (target === child.id) {
          add(child)
          const own = graph.resources.get(owner.id) ?? []
          own.push(target)
          graph.resources.set(owner.id, own)
          graph.resourceOwners.set(target, owner.id)
        }
        resources.set(key, target)
        if (child.documentType === 'vocabs' && child.alias) {
          vocabAliases.set(child.alias, target)
        }
        use(owner.id, child, target)
      }
      for (const alias of owner.dataDependencies ?? []) {
        const target = aliases.get(alias) ?? vocabAliases.get(alias)
        if (target) {
          graph.relations.push({ source: owner.id, target, kind: 'uses', borrowed: true, alias })
        }
      }
      for (const reference of owner.vocabReferences ?? []) {
        const target = reference.alias
          ? vocabAliases.get(reference.alias)
          : resources.get(JSON.stringify(['vocabs', reference.identity]))
        if (target) {
          graph.relations.push({ source: owner.id, target, kind: 'uses', borrowed: true, alias: reference.alias ?? reference.identity })
        }
      }
      for (const child of owner.children) {
        if (child.kind === 'data' || child.kind === 'resource') {
          continue
        }
        if (child.kind === 'composition') {
          visitComposition(child, [providers, ...ancestorProviders], aliases, resources, vocabAliases)
        }
        else {
          visitOwner(child, resources, vocabAliases)
        }
        if (child.documentType === 'stream') {
          // Stream остаётся runtime occurrence: меняется только его место в UI,
          // без дедупликации по identity и потери собственных зависимостей.
          const own = graph.resources.get(owner.id) ?? []
          own.push(child.id)
          graph.resources.set(owner.id, own)
          graph.resourceOwners.set(child.id, owner.id)
          graph.relations.push({ source: owner.id, target: child.id, kind: 'includes' })
        }
        else {
          include(owner.id, child.id)
        }
      }
    }
    visitOwner(composition, inheritedResources, inheritedVocabAliases)
  }
  for (const root of roots) {
    visitComposition(root, [], new Map(), new Map(), new Map())
    graph.roots.push(root.id)
  }
  return graph
}

export interface WorkflowSelection {
  node: WorkflowNodeData
  dependencies: WorkflowDependency[]
  usages: WorkflowDependency[]
}

/** Один направленный обход; общий ресурс не связывает соседних потребителей. */
function traverseWorkflow(graph: WorkflowGraph, id: string, direction: 'dependencies' | 'usages') {
  const visits = new Map<string, { depth: number, parent: string | null }>()
  if (!graph.nodes.has(id)) {
    return visits
  }
  visits.set(id, { depth: 0, parent: null })
  const queue = [id]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!
    const depth = visits.get(current)!.depth
    for (const relation of graph.relations) {
      const next = direction === 'dependencies'
        ? (relation.source === current ? relation.target : null)
        : (relation.target === current ? relation.source : null)
      if (!next || visits.has(next)) {
        continue
      }
      visits.set(next, { depth: depth + 1, parent: current })
      queue.push(next)
    }
  }
  return visits
}

/** Полотно и дерево панели используют одинаковые границы направленного обхода. */
export function getWorkflowFocus(graph: WorkflowGraph, selected: ReadonlySet<string>): Map<string, number> {
  const levels = new Map<string, number>()
  for (const id of selected) {
    for (const direction of ['dependencies', 'usages'] as const) {
      for (const [nodeId, { depth }] of traverseWorkflow(graph, id, direction)) {
        const level = depth === 0 ? 1 : depth === 1 ? 0.9 : 0.6
        levels.set(nodeId, Math.max(levels.get(nodeId) ?? 0, level))
      }
    }
  }
  return levels
}

/** Каждое occurrence попадает в дерево один раз на направление, включая циклические графы. */
export function getWorkflowSelection(graph: WorkflowGraph, selected: ReadonlySet<string>): WorkflowSelection[] {
  const tree = (id: string, direction: 'dependencies' | 'usages'): WorkflowDependency[] => {
    const nodes = new Map<string, WorkflowDependency>()
    for (const [nodeId, { parent }] of traverseWorkflow(graph, id, direction)) {
      const node: WorkflowDependency = { ...graph.nodes.get(nodeId)!, children: [] }
      nodes.set(nodeId, node)
      if (parent) {
        nodes.get(parent)!.children.push(node)
      }
    }
    return nodes.get(id)?.children ?? []
  }
  return [...selected].filter(id => graph.nodes.has(id)).map(id => ({
    node: graph.nodes.get(id)!,
    dependencies: tree(id, 'dependencies'),
    usages: tree(id, 'usages'),
  }))
}
