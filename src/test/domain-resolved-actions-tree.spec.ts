import type { FsFolderNode, FsNode } from '@/features/endge-ide/model/domain/domain-tree'

import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { attachResolvedActionTree } from '@/features/endge-ide/model/domain/domain-tree'

describe('domain resolved Actions tree', () => {
  it('keeps persisted Actions in place and groups virtual origins', () => {
    const tree: FsNode[] = [{
      id: 'root-actions',
      identity: 'root-actions',
      name: 'Actions',
      type: 'folder',
      sectionType: DomainSectionType.Action,
      children: [{
        id: '12',
        identity: 'orders.refresh',
        name: 'Refresh',
        type: 'file',
        docType: 'action',
        sectionType: DomainSectionType.Action,
      }],
    }]

    attachResolvedActionTree(tree, [
      descriptor('orders.refresh', { kind: 'storage' }, true),
      descriptor('table.column.pinLeft', { kind: 'builtin', owner: 'Table' }),
      descriptor('app.debug', { kind: 'local', owner: 'app' }),
      descriptor('orders-table.refresh', {
        kind: 'derived',
        source: { type: 'component-sfc', identity: 'orders-table' },
      }),
    ])

    const root = tree[0] as FsFolderNode
    expect(root.children?.find(node => node.identity === 'orders.refresh')?.badges).toContain('overridden')
    expect(root.children?.map(node => node.name)).toEqual([
      'Built-in',
      'Refresh',
      'Components',
      'Local',
    ])
    const builtIn = root.children?.[0] as FsFolderNode
    expect(builtIn.virtualOrigin).toBe('builtin')
    const tableOwner = builtIn.children?.find(node => node.identity === 'Table')
    expect(tableOwner).toMatchObject({
      type: 'file',
      docType: 'component-table',
      sectionType: DomainSectionType.Component,
      virtual: true,
    })
    const virtualActions = flatten(root).filter(node => node.type === 'file' && node.virtual && node.docType === 'action')
    expect(virtualActions).toHaveLength(3)
    expect(virtualActions.find(node => node.identity === 'table.column.pinLeft')?.badges).toEqual(['system', 'built-in'])
    expect(virtualActions.find(node => node.identity === 'orders-table.refresh')?.badges).toEqual(['provided'])
  })
})

function descriptor(identity: string, origin: any, overridden = false): any {
  return {
    identity,
    displayName: identity,
    description: null,
    active: true,
    origin,
    target: identity.startsWith('table.') ? [{ type: 'component.table' }] : null,
    input: null,
    output: null,
    defaultImplementation: { kind: 'provider', providerKey: identity },
    overridden,
    effectiveProviderKey: identity,
    effectiveProviderOrigin: overridden ? { kind: 'local', owner: 'test' } : origin,
    bindingScope: overridden ? 'application' : 'default',
  }
}

function flatten(root: FsFolderNode): FsNode[] {
  return (root.children ?? []).flatMap(node => [node, ...(node.children ? flatten(node as FsFolderNode) : [])])
}
