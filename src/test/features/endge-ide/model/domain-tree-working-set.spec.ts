import type { FsNode } from '@/features/endge-ide/model/domain/domain-tree'

import { describe, expect, it } from 'vitest'

import { projectDomainWorkingSetFiles } from '@/features/endge-ide/model/domain/domain-tree-working-set'
import { resolveDomainWorkingSet } from '@/features/endge-ide/tools/resolve-domain-working-set'

describe('projectDomainWorkingSetFiles', () => {
  it('returns only matched entities without their folders or nesting', () => {
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

    const projected = projectDomainWorkingSetFiles(tree, result)

    expect(projected.map(item => item.node.name)).toEqual([
      'Root Composition',
      'Schedule View',
    ])
    expect(projected.every(item => item.depth === 0 && item.rootId === 'working-set')).toBe(true)
    expect(projected.every(item => item.node.type === 'file' && item.node.children == null)).toBe(true)
  })
})
