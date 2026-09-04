import { DomainSectionType } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'

import { buildDomainTree, buildWorkspaceTreeNodes } from '@/features/endge-ide/services/domain/domain-tree'

describe('построение дерева домена', () => {
  it('раскрывает только активный Workspace с плоскими дочерними активными Configuration', () => {
    const tree = buildWorkspaceTreeNodes([
      { id: 1, identity: 'default', displayName: 'Default', role: 'owner', active: true },
      { id: 2, identity: 'remote', displayName: 'Remote', role: 'viewer', active: true },
    ], 'default', [
      { id: 12, identity: 'table', displayName: 'Таблица' },
      { id: 11, identity: 'editing', displayName: 'Редактирование' },
      { id: 13, identity: 'deleted', displayName: 'Удалено', deletedAt: '2026-08-20T00:00:00Z' },
    ])

    expect(tree[0]).toMatchObject({
      type: 'folder',
      identity: 'default',
      children: [
        { type: 'file', docType: 'configuration', identity: 'editing' },
        { type: 'file', docType: 'configuration', identity: 'table' },
      ],
    })
    expect(tree[0]?.badges).toBeUndefined()
    expect(tree[1]).toMatchObject({ type: 'file', identity: 'remote', activeWorkspace: false })
    expect(tree[1]?.badges).toBeUndefined()
    expect(tree[1]?.children).toBeUndefined()
  })

  it('размещает Mock сразу после словарей в корневом блоке Data', async () => {
    const { getDomainTreeRootBlocks } = await import('@/features/endge-ide/services/domain/domain-tree')
    const blocks = getDomainTreeRootBlocks(['root-tenants', 'root-stores', 'root-vocabs', 'root-mocks', 'root-auth-profiles'])

    expect(blocks.map(block => block.title)).toEqual(['Контекст', 'Данные', 'Инфраструктура'])
    expect(blocks[1]?.rootIds).toEqual(['root-stores', 'root-vocabs', 'root-mocks'])
  })

  it('использует настроенные подписи для сохраняемых корневых папок', () => {
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
    })

    expect(tree[0]?.name).toBe('Представления')
  })

  it('проецирует управление системой и интеграциями без резервных identity', () => {
    const tree = buildDomainTree({
      rootToSection: {
        'root-integrations': {
          section: DomainSectionType.Integration,
          items: () => [{
            id: 7,
            identity: 'example.operations',
            displayName: 'Operations',
            managedBy: 'integration',
            managedById: 'installation-1',
          }],
        },
      },
      rootOrder: ['root-integrations'],
      rootLabels: { 'root-integrations': 'Интеграции' },
      allFolders: [
        { id: 'root-integrations', identity: 'root-integrations', name: 'Integrations', parent: null, managedBy: 'system' },
      ],
    })

    expect(tree[0]).toMatchObject({ managedBy: 'system', managedById: null })
    expect(tree[0]?.children?.[0]).toMatchObject({
      managedBy: 'integration',
      managedById: 'installation-1',
    })
  })

  it('сохраняет каноничность query Composition при применении её query-представления', () => {
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
    })

    const file = tree[0]?.children?.[0]
    expect(file).toMatchObject({
      type: 'file',
      docType: 'composition',
      sectionType: DomainSectionType.Composition,
      presentationKind: 'query-composition',
    })
  })

  it('размещает query Composition без owner в её сохранённой папке запросов', () => {
    const tree = buildDomainTree({
      rootToSection: {
        'root-queries': {
          section: DomainSectionType.Query,
          items: () => [],
        },
      },
      rootOrder: ['root-queries'],
      rootLabels: { 'root-queries': 'Запросы' },
      allFolders: [
        { id: 1, identity: 'root-queries', name: 'Queries', parent: null },
        { id: 2, identity: 'groundhandling', name: 'Ground handling', parent: 1 },
      ],
      contextualCompositions: [{
        id: 10,
        identity: 'groundhandling-default',
        displayName: 'Запросы ТГО',
        kind: 'query',
        kindIdentity: null,
        folderId: 2,
      }],
    })

    const folder = tree[0]?.children?.find(node => node.type === 'folder' && node.identity === 'groundhandling')
    expect(folder?.children?.[0]).toMatchObject({
      id: '10',
      identity: 'groundhandling-default',
      docType: 'composition',
      sectionType: DomainSectionType.Composition,
      presentationKind: 'query',
    })
  })

  it('привязывает Composition проекта к её owner и игнорирует сохранённую папку', () => {
    const tree = buildDomainTree({
      rootToSection: {
        'root-projects': {
          section: DomainSectionType.Project,
          items: () => [{
            id: 7,
            identity: 'project-dev',
            displayName: 'Project Dev',
            folderId: 'root-projects',
          }],
        },
      },
      rootOrder: ['root-projects'],
      rootLabels: { 'root-projects': 'Проекты' },
      allFolders: [
        { id: 'root-projects', identity: 'root-projects', name: 'Projects', parent: null },
        { id: 'unrelated', identity: 'unrelated', name: 'Unrelated', parent: 'root-projects' },
      ],
      contextualCompositions: [{
        id: 21,
        identity: 'project-dev-startup',
        displayName: 'Project startup',
        kind: 'project',
        kindIdentity: 'project-dev',
        folderId: 'unrelated',
      }],
    })

    const project = tree[0]?.children?.find(node => node.type === 'file' && node.identity === 'project-dev')
    expect(project?.children).toEqual([
      expect.objectContaining({
        id: '21',
        identity: 'project-dev-startup',
        docType: 'composition',
        presentationKind: 'project',
      }),
    ])
  })

  it('останавливает обход циклических ветвей папок из некорректных данных', () => {
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
    })

    expect(tree).toHaveLength(1)
    const root = tree[0]!
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
