import type { RuntimePreviewLifecycleState, RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { WorkflowDependency } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { FilterType } from '@endge/core'
import { describe, expect, it } from 'vitest'
import { collectRuntimeWorkflowActivity } from '@/features/endge-ide/tools/runtime-workflow-activity'

function diagram(id: string, documentType: WorkflowDependency['documentType'], identity: string, children: WorkflowDependency[] = []): WorkflowDependency {
  return { id, documentType, identity, children, kind: documentType ?? 'scope', alias: null, title: id, icon: '', colorClass: '', activationMode: null, status: 'valid', diagnosticCount: 0 }
}

function runtime(entityType: string, identity: string, children: RuntimePreviewTreeNode[] = []): RuntimePreviewTreeNode {
  return { id: `${entityType}:${identity}`, entityType, identity, children, kind: entityType === 'composition' ? 'composition' : entityType === 'scope' ? 'scope' : 'runtime', parentId: null, title: identity, subtitle: null, activationMode: null, composition: null, runtimePath: null, scopePath: null, resourcePath: null, presentation: null, renderable: false }
}

function entry(node: RuntimePreviewTreeNode, state: RuntimePreviewLifecycleState) {
  return { tree: { value: [node] }, lifecycleState: () => state }
}

describe('активность Workspace Workflow', () => {
  /** Последний active экземпляр определяет подсветку независимо от остальных запусков. */
  it('объединяет дубликаты и снимает подсветку только после остановки последнего активного экземпляра', () => {
    const roots = [diagram('workspace/composition', 'composition', 'page')]
    const node = runtime('composition', 'page')
    expect([...collectRuntimeWorkflowActivity(roots, [entry(node, 'paused'), entry(node, 'active'), entry(node, 'active')])]).toEqual(['workspace/composition'])
    expect(collectRuntimeWorkflowActivity(roots, [entry(node, 'paused'), entry(node, 'stopped'), entry(node, 'inactive')]).size).toBe(0)
  })

  /** Одинаковые scope paths разных документов не обозначают один owner. */
  it('различает именованные scopes в разных композициях', () => {
    const roots = [diagram('a', 'composition', 'a', [diagram('a/scope', null, 'details')]), diagram('b', 'composition', 'b', [diagram('b/scope', null, 'details')])]
    expect([...collectRuntimeWorkflowActivity(roots, [entry(runtime('composition', 'a', [runtime('scope', 'details')]), 'active')])]).toEqual(['a', 'a/scope'])
  })

  /** Runtime aliases и типы ресурсов приводятся к документным identities проекции. */
  it('сопоставляет Vocab и i18n и отличает FilterView от Filter', () => {
    const view = { ...diagram('view', FilterType.DefaultFilter, 'filter'), filterView: { sourceId: 'filter', fields: [] } }
    const roots = [diagram('vocab', 'vocabs', 'airports'), diagram('i18n', 'i18n-bundles', 'labels'), diagram('filter', FilterType.DefaultFilter, 'filter'), view]
    const entries = [entry(runtime('vocab', 'airports'), 'active'), entry(runtime('i18n', 'labels'), 'active'), entry(runtime('default-filter', 'filter'), 'active')]
    expect([...collectRuntimeWorkflowActivity(roots, entries)]).toEqual(['vocab', 'i18n', 'filter'])
    expect([...collectRuntimeWorkflowActivity(roots, [entry({ ...runtime('default-filter', 'filter'), runtimeKind: 'filter-view' }, 'active')])]).toEqual(['view'])
  })
})
