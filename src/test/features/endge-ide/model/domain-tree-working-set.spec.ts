import type { FsNode } from '@/features/endge-ide/model/domain/domain-tree'

import { describe, expect, it } from 'vitest'

import {
  groupDomainWorkingSetItems,
  projectDomainWorkingSetItems,
} from '@/features/endge-ide/model/domain/domain-tree-working-set'
import { resolveDomainWorkingSet } from '@/features/endge-ide/tools/resolve-domain-working-set'

describe('domain working-set projection', () => {
  it('groups matched entities under their original root folders without nested folders', () => {
    const tree: FsNode[] = [
      {
        type: 'folder',
        id: 'root-compositions',
        name: 'Compositions',
        sectionType: 'composition' as any,
        isRoot: true,
        children: [
          {
            type: 'folder',
            id: 'folder-a',
            name: 'Folder A',
            sectionType: 'composition' as any,
            children: [
              {
                type: 'file',
                id: '1',
                identity: 'root-composition',
                name: 'Root Composition',
                docType: 'composition',
                sectionType: 'composition' as any,
              },
              {
                type: 'file',
                id: '2',
                identity: 'other-composition',
                name: 'Other Composition',
                docType: 'composition',
                sectionType: 'composition' as any,
              },
            ],
          },
        ],
      },
      {
        type: 'folder',
        id: 'root-data-views',
        name: 'Data Views',
        sectionType: 'data-view' as any,
        isRoot: true,
        children: [
          {
            type: 'file',
            id: '3',
            identity: 'schedule-view',
            name: 'Schedule View',
            docType: 'data-view',
            sectionType: 'data-view' as any,
          },
        ],
      },
    ]
    const result = resolveDomainWorkingSet([
      { entityType: 'composition', id: '1', identity: 'root-composition' },
    ], {
      dependenciesOf: source => source.entityType === 'composition'
        ? [{ entityType: 'data-view', id: 'schedule-view', identity: 'schedule-view' }]
        : [],
    })

    const projected = projectDomainWorkingSetItems(
      tree,
      result,
      new Set(['Compositions', 'Data Views']),
      { folderMode: 'root-folders', preserveGroups: false },
    )

    expect(projected.map(item => `${item.node.type}:${item.node.name}`)).toEqual([
      'folder:Compositions',
      'file:Root Composition',
      'folder:Data Views',
      'file:Schedule View',
    ])
    expect(projected.map(item => [item.depth, item.rootId])).toEqual([
      [0, 'root-compositions'],
      [1, 'root-compositions'],
      [0, 'root-data-views'],
      [1, 'root-data-views'],
    ])
    expect(projected.some(item => item.node.name === 'Folder A')).toBe(false)
    expect(projected
      .filter(item => item.node.type === 'file')
      .every(item => item.node.children == null)).toBe(true)

    const collapsed = projectDomainWorkingSetItems(
      tree,
      result,
      new Set(),
      { folderMode: 'root-folders', preserveGroups: false },
    )
    expect(collapsed.map(item => item.node.name)).toEqual([
      'Compositions',
      'Data Views',
    ])

    const withoutGroups = groupDomainWorkingSetItems(
      projected,
      [
        { id: 'composition-group', title: 'Compositions', rootIds: ['root-compositions'] },
        { id: 'view-group', title: 'Views', rootIds: ['root-data-views'] },
      ],
      ['root-compositions', 'root-data-views'],
      { folderMode: 'root-folders', preserveGroups: false },
    )
    expect(withoutGroups).toHaveLength(1)
    expect(withoutGroups[0]?.showTitle).toBe(false)
    expect(withoutGroups[0]?.roots.map(root => root.rootId)).toEqual([
      'root-compositions',
      'root-data-views',
    ])

    const flat = projectDomainWorkingSetItems(
      tree,
      result,
      new Set(),
      { folderMode: 'flat', preserveGroups: true },
    )
    expect(flat.map(item => [item.node.name, item.depth, item.rootId])).toEqual([
      ['Root Composition', 0, 'root-compositions'],
      ['Schedule View', 0, 'root-data-views'],
    ])

    const groups = groupDomainWorkingSetItems(
      flat,
      [
        { id: 'composition-group', title: 'Compositions', rootIds: ['root-compositions'] },
        { id: 'view-group', title: 'Views', rootIds: ['root-data-views'] },
      ],
      ['root-compositions', 'root-data-views'],
      { folderMode: 'flat', preserveGroups: true },
    )

    expect(groups.map(group => group.id)).toEqual(['composition-group', 'view-group'])
    expect(groups.map(group => group.roots[0]?.items[0]?.node.name)).toEqual([
      'Root Composition',
      'Schedule View',
    ])
  })
})
