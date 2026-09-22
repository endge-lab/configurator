import type { CompiledDocumentDescriptor, CompiledProgramCatalog } from '@endge/core'
import type { FsNode } from '@/features/endge-ide/services/domain/domain-tree'
import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'
import { buildProgramDomainTree } from '@/features/endge-ide/services/domain/program-domain-tree'

const sections = { 'root-workspaces': DomainSectionType.Workspace, 'root-components': DomainSectionType.Component, 'root-stores': DomainSectionType.Store }
function document(id: string, entityType: string, extra: Partial<CompiledDocumentDescriptor> = {}): CompiledDocumentDescriptor {
  return { id, identity: id, entityType, displayName: id, folderId: null, workspaceFolderId: null, position: 0, artifactKeys: [], status: 'not-compiled', ...extra }
}
function all(nodes: FsNode[]): FsNode[] {
  return nodes.flatMap(node => [node, ...all(node.children ?? [])])
}
function catalog(): CompiledProgramCatalog {
  return {
    folders: {
      components: { id: 'components', identity: 'root-components', displayName: 'root-components', scope: 'collection', parentId: null, entityType: 'components', position: 0 },
      nested: { id: 'nested', identity: 'nested', displayName: 'Компоненты таблицы', scope: 'collection', parentId: 'components', entityType: 'components', position: 1 },
      model: { id: 'model', identity: 'root-workspace-files', displayName: 'Модель', scope: 'workspace', parentId: null, entityType: null, position: 2 },
      screens: { id: 'screens', identity: 'screens', displayName: 'Экраны', scope: 'workspace', parentId: 'model', entityType: null, position: 3, icon: 'Monitor', color: '#abcdef' },
    },
    documents: {
      'component-sfc:table': document('table', 'component-sfc', { folderId: 'nested', workspaceFolderId: 'screens' }),
      'store:store': document('store', 'store'),
      'update:update': document('update', 'update', { storeIdentity: 'store' }),
      'update:legacy': document('legacy', 'update'),
      'facet:env': document('env', 'facet', { icon: 'Cloud', color: '#aabbcc' }),
      'facet-document:prod': document('prod', 'facet-document', { facetIdentity: 'env' }),
    },
  }
}

describe('каталог Program в общем дереве Domain', () => {
  /** Независимые ссылки placement обязаны приводить к разным веткам одного документа. */
  it('places configurations below the single compiled workspace in both projections', () => {
    const input = catalog()
    input.workspace = { identity: 'aodb', displayName: 'AODB', startupCompositionIdentity: null }
    input.documents['configuration:settings'] = document('settings', 'configuration')
    for (const custom of [false, true]) {
      const tree = buildProgramDomainTree(input, sections, custom)
      const root = tree.find(node => node.id === 'root-workspaces')!
      expect(root.children).toHaveLength(1)
      expect(root.children![0]).toMatchObject({ name: 'AODB', workspaceIdentity: 'aodb', activeWorkspace: true })
      expect(root.children![0]!.children).toEqual(expect.arrayContaining([expect.objectContaining({ compiledDocumentKey: 'configuration:settings' })]))
    }
  })

  it('строит frontend и Workspace по разным ссылкам, сохраняя ключ вкладки и исходный каталог', () => {
    const input = catalog()
    const before = JSON.stringify(input)
    const frontend = buildProgramDomainTree(input, sections, false)
    const workspace = buildProgramDomainTree(input, sections, true)
    expect(all(frontend).find(node => node.name === 'Компоненты таблицы')?.children?.[0]).toMatchObject({ compiledDocumentKey: 'component-sfc:table' })
    expect(all(frontend).some(node => node.name === 'Экраны')).toBe(false)
    expect(all(workspace).find(node => node.name === 'Экраны')).toMatchObject({ icon: 'Monitor', color: '#abcdef', children: [{ compiledDocumentKey: 'component-sfc:table' }] })
    expect(workspace.some(node => node.name === 'Модель')).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
    for (const tree of [frontend, workspace]) {
      const keys = all(tree).flatMap(node => node.type === 'file' ? [node.compiledDocumentKey] : [])
      expect(keys.sort()).toEqual(['component-sfc:table', 'store:store', 'update:update', 'update:legacy', 'facet-document:prod'].sort())
    }
  })

  /** Фасеты остаются в Context, вложенные Update следуют за своим Store в обеих проекциях. */
  it('сохраняет группы фасетов и вложенные Update', () => {
    for (const custom of [false, true]) {
      const tree = buildProgramDomainTree(catalog(), sections, custom)
      expect(tree.find(node => node.id === 'root-facet:env')).toMatchObject({ facetColor: '#aabbcc', children: [{ compiledDocumentKey: 'facet-document:prod', facetIcon: 'Cloud' }] })
      expect(all(tree).find(node => node.type === 'file' && node.id === 'store')?.children).toMatchObject([{ compiledDocumentKey: 'update:update' }])
    }
  })

  /** Старый формат не теряет верхнюю пользовательскую папку и документы без новых метаданных. */
  it('поддерживает старые имена фасетов и Workspace без системного корня', () => {
    const input = catalog()
    input.folders.model!.identity = 'legacy-root'
    input.folders.model!.displayName = 'Старый корень'
    input.documents['facet:env']!.entityType = 'facets'
    input.documents['facet-document:prod']!.entityType = 'facetDocuments'
    const tree = buildProgramDomainTree(input, sections, true)
    expect(all(tree).find(node => node.name === 'Старый корень')?.children).toMatchObject([{ name: 'Экраны' }])
    expect(all(tree).find(node => node.type === 'file' && node.id === 'prod')).toMatchObject({ compiledDocumentKey: 'facet-document:prod' })
  })

  /** Общий helper размещает привязанную Composition под Query и сохраняет ссылку на artifact tab. */
  it('сохраняет владельца contextual Composition', () => {
    const input = catalog()
    input.documents['query:query'] = document('query', 'query')
    input.documents['composition:handler'] = document('handler', 'composition', { kind: 'query', kindIdentity: 'query' })
    const tree = buildProgramDomainTree(input, { ...sections, 'root-queries': DomainSectionType.Query, 'root-compositions': DomainSectionType.Composition }, false)
    expect(all(tree).find(node => node.type === 'file' && node.id === 'query')?.children).toMatchObject([{ compiledDocumentKey: 'composition:handler' }])
  })

  it('при пустом каталоге не показывает authoring Domain и искусственные папки', () => {
    expect(buildProgramDomainTree({ folders: {}, documents: {} }, sections, false)).toEqual([])
  })
})
