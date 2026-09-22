import type { EndgeRuntimeSnapshot, RuntimeHostSnapshot, RuntimeScopeSnapshot } from '@endge/core'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { FilterType } from '@endge/core'
import { describe, expect, it } from 'vitest'
import { buildRuntimeInspectionTree } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-tree'
import { readRuntimeInspectionData } from '@/features/endge-ide/tools/read-runtime-inspection-data'
import { collectRuntimeWorkflowActivity } from '@/features/endge-ide/tools/runtime-workflow-activity'

function host(id: string, entityType: RuntimeHostSnapshot['entityType'] = 'composition', parentId: string | null = null): RuntimeHostSnapshot {
  return { id, parentId, entityType, entityIdentity: 'shared', title: id, basePath: `runtime.${id}`, runtimeType: `${entityType}-runtime-host`, status: 'active', createdAt: 1, updatedAt: 2, removedAt: null, capabilities: [], context: {}, resources: [], channels: [], meta: {} }
}
function scope(id: string, ownerRuntimeId: string | null, parentScopeId: string | null, memberRuntimeIds: string[] = []): RuntimeScopeSnapshot {
  return { id, ownerRuntimeId, parentScopeId, path: 'scope_default', memberRuntimeIds, generation: 2, state: 'active', boundaryId: '', stale: false, updateGateOpen: true, childScopeIds: [], resources: { total: 0, paused: false, resources: [] }, lastError: null }
}
function snapshot(hosts: RuntimeHostSnapshot[], scopes: RuntimeScopeSnapshot[] = []): EndgeRuntimeSnapshot {
  return { generatedAt: 1, total: hosts.length, hosts, scopes, deletedTotal: 0, deletedHosts: [], byStatus: {} }
}

describe('дерево наблюдаемого Runtime', () => {
  /** Два экземпляра общего документа сохраняют собственный scope и независимые control targets. */
  it('соединяет hosts и scopes по ownership и membership, сохраняя поколения', () => {
    const runtime = snapshot([host('a'), host('b'), host('store', 'store', 'a')], [scope('app', null, null, ['a', 'b']), scope('a-default', 'a', 'app', ['store']), scope('b-default', 'b', 'app')])
    runtime.scopes[1]!.state = 'paused'
    const tree = buildRuntimeInspectionTree(runtime)
    expect(tree.roots.map(node => node.id)).toEqual(['scope:app'])
    expect(tree.nodes.get('host:store')?.parentId).toBe('scope:a-default')
    expect(tree.nodes.get('scope:a-default')?.parentId).toBe('host:a')
    expect(tree.states.get('host:a')).toBe('paused')
    expect(tree.states.get('host:b')).toBe('active')
    expect(tree.targets.get('host:a')).toEqual({ kind: 'host', id: 'a', createdAt: 1 })
    expect(tree.targets.get('scope:a-default')).toEqual({ kind: 'scope', id: 'a-default', generation: 2 })
    expect(tree.nodes.size).toBe(6)
  })

  /** UI защищает рекурсивный renderer даже от смешанного цикла двух отдельных иерархий. */
  it('сохраняет orphan nodes и разрывает смешанный host-scope цикл без потери узлов', () => {
    const runtime = snapshot([host('a', 'composition', 'missing'), host('b')], [scope('one', 'a', null, ['b']), scope('two', 'b', null, ['a'])])
    const tree = buildRuntimeInspectionTree(runtime)
    const seen = new Set<string>()
    const visit = (nodes: typeof tree.roots) => {
      for (const node of nodes) {
        expect(seen.has(node.id)).toBe(false)
        seen.add(node.id)
        visit(node.children)
      }
    }
    visit(tree.roots)
    expect(seen.size).toBe(4)
    expect(buildRuntimeInspectionTree(snapshot([host('orphan', 'store', 'missing')])).roots).toHaveLength(1)
  })

  /** FilterView имеет отдельную активность, хотя Core связывает его с документом Filter. */
  it('различает FilterView и Filter и объединяет несколько active экземпляров в Составе', () => {
    const view = { ...host('view', 'filter'), runtimeType: 'filter-view-runtime-host' }
    const tree = buildRuntimeInspectionTree(snapshot([host('a'), { ...host('b'), status: 'paused' }, view]), item => item.entityType === 'filter' ? FilterType.DefaultFilter : 'composition')
    const document = (id: string, documentType: WorkflowDependency['documentType']): WorkflowDependency => ({ id, documentType, identity: 'shared', kind: 'composition', title: id, alias: null, icon: '', colorClass: '', activationMode: null, status: 'valid', diagnosticCount: 0, children: [] })
    const roots = [document('composition', 'composition'), document('filter', FilterType.DefaultFilter), { ...document('view', FilterType.DefaultFilter), filterView: { sourceId: null, fields: [] } }]
    const active = collectRuntimeWorkflowActivity(roots, [{ tree: { value: tree.roots }, lifecycleState: node => tree.states.get(node.id)! }])
    expect([...active]).toEqual(['composition', 'view'])
  })

  /** Канонические пути используют тот же parser, но читают переданный snapshot без singleton Raph. */
  it('читает encoded ids, индексы и фильтры в данных и не раскрывает prototype properties', () => {
    const data = { runtime: { 'a%2Eb': { rows: [{ id: 1, value: 7 }, { id: 2, value: 9 }] } } }
    expect(readRuntimeInspectionData(data, 'runtime.a%2Eb.rows[1].value')).toBe(9)
    expect(readRuntimeInspectionData(data, 'runtime.a%2Eb.rows[id=1].value')).toBe(7)
    expect(readRuntimeInspectionData(data, 'runtime.a%2Eb.rows[*]')).toBeUndefined()
    expect(readRuntimeInspectionData(data, '__proto__.constructor')).toBeUndefined()
  })
})
