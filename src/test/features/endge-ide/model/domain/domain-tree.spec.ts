import { describe, expect, it, vi } from 'vitest'
import { DomainSectionType } from '@endge/core'

import { buildDomainTree } from '@/features/endge-ide/model/domain/domain-tree'

describe('buildDomainTree', () => {
  it('places Mock directly after dictionaries in the Data root block', async () => {
    const { getDomainTreeRootBlocks } = await import('@/features/endge-ide/model/domain/domain-tree')
    const blocks = getDomainTreeRootBlocks(['root-tenants', 'root-stores', 'root-vocabs', 'root-mocks', 'root-integrations'])

    expect(blocks.map(block => block.title)).toEqual(['Контекст', 'Данные', 'Инфраструктура'])
    expect(blocks[1]?.rootIds).toEqual(['root-stores', 'root-vocabs', 'root-mocks'])
  })

  it('uses configured labels for persisted root folders', () => {
    const tree = buildDomainTree({
      rootToSection: {
        'root-data-views': {
          section: DomainSectionType.DataView,
          items: () => [],
        },
      },
      rootOrder: ['root-data-views'],
      rootLabels: {
        'root-data-views': 'Представления',
      },
      allFolders: [
        { id: 'root-data-views', identity: 'root-data-views', name: 'Data Views', parent: null },
      ],
      softDeletedFolderId: null,
    })

    expect(tree[0]?.name).toBe('Представления')
  })

  it('keeps query Composition canonical while applying its query presentation', () => {
    const tree = buildDomainTree({
      rootToSection: {
        'root-queries': {
          section: DomainSectionType.Query,
          items: () => [{
            id: 10,
            identity: 'groundhandling-default',
            displayName: 'Запросы ТГО',
            type: 'composition',
            folderId: 'root-queries',
            sectionType: DomainSectionType.Composition,
            presentationKind: 'query-composition',
          }],
        },
      },
      rootOrder: ['root-queries'],
      rootLabels: { 'root-queries': 'Запросы' },
      allFolders: [
        { id: 'root-queries', identity: 'root-queries', name: 'Queries', parent: null },
      ],
      softDeletedFolderId: null,
    })

    const file = tree[0]?.children?.[0]
    expect(file).toMatchObject({
      type: 'file',
      docType: 'composition',
      sectionType: DomainSectionType.Composition,
      presentationKind: 'query-composition',
    })
  })

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
