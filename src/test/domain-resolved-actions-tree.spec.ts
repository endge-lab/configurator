import type { FsFolderNode, FsNode } from '@/features/endge-ide/model/domain/domain-tree'

import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { attachResolvedActionTree } from '@/features/endge-ide/model/domain/domain-tree'

describe('domain resolved Actions tree', () => {
  it('keeps persisted Actions in place and groups virtual origins', () => {
    const tree: FsNode[] = [
      {
        id: 'root-components',
        identity: 'root-components',
        name: 'Компоненты',
        type: 'folder',
        sectionType: DomainSectionType.Component,
        children: [{
          id: '21',
          identity: 'orders-table',
          name: 'Таблица заказов',
          type: 'file',
          docType: 'component-sfc',
          sectionType: DomainSectionType.Component,
        }],
      },
      {
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
      },
    ]

    attachResolvedActionTree(tree, [
      descriptor('orders.refresh', { kind: 'storage' }, true),
      descriptor('table.column.pinLeft', { kind: 'builtin', owner: 'Table' }),
      {
        ...descriptor('built-in-console-log', { kind: 'builtin', owner: '@endge/core' }),
        catalogPath: ['Debug'],
      },
      descriptor('app.debug', { kind: 'local', owner: 'app' }),
      descriptor('orders-table.refresh', {
        kind: 'derived',
        source: { type: 'component-sfc', identity: 'orders-table' },
      }),
    ])

    const root = tree.find(node => node.type === 'folder' && node.id === 'root-actions') as FsFolderNode
    expect(root.children?.find(node => node.identity === 'orders.refresh')?.badges).toContain('overridden')
    expect(root.children?.map(node => node.name)).toEqual([
      'Built-in',
      'Provided',
      'Refresh',
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
    const debugFolder = builtIn.children?.find(node => node.name === 'Debug') as FsFolderNode
    expect(debugFolder.children?.[0]).toMatchObject({
      type: 'file',
      identity: 'built-in-console-log',
      docType: 'action',
    })
    const provided = root.children?.[1] as FsFolderNode
    expect(provided.virtualOrigin).toBe('derived')
    const components = provided.children?.[0] as FsFolderNode
    expect(components.name).toBe('Компоненты')
    expect(components.children?.[0]).toMatchObject({
      type: 'file',
      identity: 'orders-table',
      name: 'Таблица заказов',
      docType: 'component-sfc',
      virtual: true,
      sourceDocument: {
        identity: 'orders-table',
        docType: 'component-sfc',
      },
    })
    expect(tableOwner).not.toHaveProperty('sourceDocument')
    const virtualActions = flatten(root).filter(node => node.type === 'file' && node.virtual && node.docType === 'action')
    expect(virtualActions).toHaveLength(4)
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
