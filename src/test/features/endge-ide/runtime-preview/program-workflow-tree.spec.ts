import type { CompositionProgramPayload, DomainDocumentType, EndgeRuntimeSnapshot } from '@endge/core'
import { Endge, FilterType, QueryType } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRuntimeInspectionTree } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-tree'
import { buildProgramWorkflowTree } from '@/features/endge-ide/services/workspace-workflow/program-workflow-tree'
import { collectRuntimeWorkflowActivity } from '@/features/endge-ide/tools/runtime-workflow-activity'

vi.mock('@endge/core', async original => ({
  ...await original<typeof import('@endge/core')>(),
  Endge: {
    get workspace() { return {} },
    get program() { return {} },
    get domain() { return {} },
    get source() { return {} },
  },
}))

afterEach(() => vi.restoreAllMocks())

describe('compiled workspace workflow', () => {
  it('builds nested runtime occurrences from IR without Source or Domain', () => {
    vi.spyOn(Endge, 'workspace', 'get').mockReturnValue({ current: { identity: 'aodb', displayName: 'AODB', startupCompositionIdentity: 'app' } } as never)
    const payload = {
      activation: { mode: 'startup' },
      data: [{ kind: 'store', identity: 'rows', name: 'rows', path: 'rows', scopePath: 'scope_default' }],
      resources: [],
      scopes: [{ name: 'nested', path: 'nested', parentPath: 'scope_default', effectiveActivation: { mode: 'startup' } }],
      runtimes: [
        { kind: 'component', identity: 'table', name: 'table', path: 'nested.table', scopePath: 'nested', effectiveActivation: { mode: 'startup' } },
        { kind: 'composition', identity: 'app', name: 'cycle', path: 'cycle', scopePath: 'scope_default', effectiveActivation: { mode: 'manual' } },
      ],
    } as unknown as CompositionProgramPayload
    vi.spyOn(Endge, 'program', 'get').mockReturnValue({
      catalog: { documents: { app: { id: 'app', identity: 'app', entityType: 'composition', displayName: 'Application' }, table: { id: 'table', identity: 'table', entityType: 'component-sfc', displayName: 'Table' } } },
      getCompositionArtifact: () => ({ payload, diagnostics: [] }),
    } as never)
    const domain = vi.spyOn(Endge, 'domain', 'get').mockImplementation(() => {
      throw new Error('Domain must not be read')
    })
    const source = vi.spyOn(Endge, 'source', 'get').mockImplementation(() => {
      throw new Error('Source must not be parsed')
    })
    const root = buildProgramWorkflowTree()
    expect(root).toMatchObject({ title: 'AODB', documentType: 'workspace' })
    expect(root.children).toHaveLength(1)
    const app = root.children[0]!
    expect(app.children.find(node => node.identity === 'app')).toMatchObject({ status: 'cycle', activationMode: 'manual' })
    expect(app.children.find(node => node.identity === 'rows')).toMatchObject({ documentType: 'store', dataSource: { identity: 'rows' } })
    expect(app.children.find(node => node.identity === 'nested')?.children).toEqual([expect.objectContaining({ title: 'Table', documentType: 'component-sfc', activationMode: 'startup' })])
    expect(source).not.toHaveBeenCalled()
    expect(domain).not.toHaveBeenCalled()
  })
})

describe('compiled workflow runtime activity', () => {
  it('matches compiled kinds and FilterView source identities to active hosts, independently of the parent', () => {
    vi.spyOn(Endge, 'workspace', 'get').mockReturnValue({ current: { identity: 'aodb', displayName: 'AODB', startupCompositionIdentity: 'sandbox' } } as never)
    const payload = {
      data: [],
      resources: [],
      scopes: [],
      runtimes: [
        { kind: 'filter', identity: 'schedule', name: 'searchModel', path: 'searchModel' },
        { kind: 'filter-view', identity: 'searchModel', name: 'searchView', path: 'searchView', fields: ['search'] },
        { kind: 'component', identity: 'table', name: 'table', path: 'table' },
        { kind: 'query', identity: 'rows', name: 'query', path: 'query' },
      ].map(item => ({ ...item, scopePath: 'scope_default', effectiveActivation: { mode: 'startup' } })),
    } as unknown as CompositionProgramPayload
    vi.spyOn(Endge, 'program', 'get').mockReturnValue({
      catalog: { documents: {
        filter: { entityType: 'filter', identity: 'schedule', displayName: 'Расписание', documentType: FilterType.DefaultFilter },
        component: { entityType: 'component-sfc', identity: 'table', displayName: 'Таблица' },
        query: { entityType: 'query', identity: 'rows', documentType: QueryType.REST },
      } },
      getCompositionArtifact: () => ({ payload, diagnostics: [] }),
    } as never)
    const root = buildProgramWorkflowTree()
    const composition = root.children[0]!
    const [filter, view, component, query] = composition.children
    expect(view).toMatchObject({ identity: 'schedule', documentType: FilterType.DefaultFilter, filterView: { sourceId: filter!.id, fields: [{ key: 'search' }] } })
    expect(component).toMatchObject({ documentType: 'component-sfc', title: 'Таблица' })
    const runtime = {
      scopes: [],
      hosts: [
        { id: 'sandbox', entityType: 'composition', entityIdentity: 'sandbox', parentId: null },
        { id: 'filter', entityType: 'filter', entityIdentity: 'schedule', parentId: 'sandbox' },
        { id: 'view', entityType: 'filter', entityIdentity: 'schedule', parentId: 'sandbox', runtimeType: 'filter-view-runtime-host' },
        { id: 'component', entityType: 'component-sfc', entityIdentity: 'table', parentId: 'sandbox' },
        { id: 'query', entityType: 'query', entityIdentity: 'rows', parentId: 'sandbox' },
      ].map(host => ({ ...host, status: 'running', capabilities: [] })),
    } as unknown as EndgeRuntimeSnapshot
    const activity = () => {
      const tree = buildRuntimeInspectionTree(runtime, host => host.entityType === 'filter' ? FilterType.DefaultFilter : host.entityType === 'query' ? QueryType.REST : host.entityType as DomainDocumentType)
      return collectRuntimeWorkflowActivity([root], [{ tree: { value: tree.roots }, lifecycleState: node => tree.states.get(node.id)! }])
    }
    expect(activity()).toEqual(new Set([composition.id, filter!.id, view!.id, component!.id, query!.id]))
    runtime.hosts.find(host => host.id === 'view')!.status = 'paused'
    runtime.hosts.find(host => host.id === 'component')!.status = 'stopped'
    expect(activity()).toEqual(new Set([composition.id, filter!.id, query!.id]))
  })
})
