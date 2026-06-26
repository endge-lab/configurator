import { describe, expect, it, vi } from 'vitest'
import { DomainSectionType } from '@endge/core'

import { buildDomainTree } from '@/features/endge-admin/model/domain/domain-tree'

describe('buildDomainTree', () => {
  it('stops traversing cyclic folder branches from malformed folder data', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const tree = buildDomainTree({
      rootToSection: {
        'root-types': {
          section: DomainSectionType.Type,
          items: () => [],
        },
      },
      rootOrder: ['root-types'],
      rootLabels: {
        'root-types': 'Types',
      },
      allFolders: [
        { id: 'root-types', identity: 'root-types', name: 'Types', parent: null },
        { id: 'folder-a', name: 'Folder A', parent: 'root-types' },
        { id: 'folder-b', name: 'Folder B', parent: 'folder-a' },
        { id: 'folder-a', name: 'Folder A duplicate', parent: 'folder-b' },
      ],
      softDeletedFolderId: null,
    })

    expect(tree).toHaveLength(1)
    const root = tree[0]
    expect(root.type).toBe('folder')
    expect(root.children).toHaveLength(1)

    const folderA = root.children?.[0]
    expect(folderA?.type).toBe('folder')
    expect(folderA?.children).toHaveLength(1)

    const folderB = folderA?.children?.[0]
    expect(folderB?.type).toBe('folder')
    expect(folderB?.children).toHaveLength(1)

    const cyclicFolder = folderB?.children?.[0]
    expect(cyclicFolder?.type).toBe('folder')
    expect(cyclicFolder?.children).toEqual([])

    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })
})
