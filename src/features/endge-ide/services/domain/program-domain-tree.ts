import type { CompiledDocumentDescriptor, CompiledProgramCatalog, DomainDocumentType, RCompositionKind } from '@endge/core'
import type { FsFileNode, FsFolderNode, FsNode } from './domain-tree'
import { DOMAIN_DOCUMENT_DESCRIPTORS, DomainSectionType } from '@endge/core'
import { attachContextualCompositions, buildCustomWorkspaceProjection, getRootFolderOrder, ROOT_FOLDER_LABELS, WORKSPACE_ROOT_FOLDER_IDENTITY } from './domain-tree'

/** Проекция каталога без материализации Domain, чтения Source и запуска компилятора. */
export function buildProgramDomainTree(
  catalog: CompiledProgramCatalog,
  sections: Record<string, DomainSectionType>,
  custom: boolean,
  workspace = catalog.workspace,
): FsNode[] {
  if (!Object.keys(catalog.folders).length && !Object.keys(catalog.documents).length) {
    return []
  }
  const folders = Object.values(catalog.folders).sort((a, b) => a.position - b.position)
  const entries = Object.entries(catalog.documents)
    .map(([key, document]): [string, CompiledDocumentDescriptor] => [key, {
      ...document,
      entityType: document.entityType === 'facets' ? 'facet' : document.entityType === 'facetDocuments' ? 'facet-document' : document.entityType,
    }])
    .sort(([, a], [, b]) => a.position - b.position)
  const roots = new Map<string, FsFolderNode>()
  const folderNodes = new Map<string, FsFolderNode>()
  const rootForSection = new Map(Object.entries(sections).map(([root, section]) => [section, root]))
  function root(id: string, section: DomainSectionType, name = ROOT_FOLDER_LABELS[id] ?? id): FsFolderNode {
    let node = roots.get(id)
    if (!node) {
      node = { id, identity: id, name, type: 'folder', sectionType: section, isRoot: true, children: [] }
      roots.set(id, node)
    }
    return node
  }
  for (const [id, section] of Object.entries(sections)) {
    root(id, section)
  }
  for (const folder of folders.filter(value => value.scope === 'collection')) {
    const rootIdentity = ROOT_FOLDER_LABELS[folder.identity] ? folder.identity : folder.id
    const node = folder.parentId === null
      ? root(rootIdentity, sections[rootIdentity] ?? DomainSectionType.Type, ROOT_FOLDER_LABELS[rootIdentity] ?? folder.displayName)
      : { id: `folder:${folder.id}`, identity: folder.identity, name: folder.displayName, type: 'folder' as const, sectionType: DomainSectionType.Type, children: [] }
    folderNodes.set(folder.id, node)
  }
  for (const folder of folders.filter(value => value.scope === 'collection' && value.parentId !== null)) {
    const node = folderNodes.get(folder.id)!
    const parent = folderNodes.get(folder.parentId!)
    if (parent) {
      parent.children!.push(node)
    }
  }
  function file(key: string, document: CompiledDocumentDescriptor): FsFileNode {
    const descriptors = Object.values(DOMAIN_DOCUMENT_DESCRIPTORS)
    const descriptor = descriptors.find(value => value.type === document.documentType)
      ?? descriptors.find(value => value.type === document.entityType || value.capabilities.program === document.entityType)
    return {
      id: document.id,
      identity: document.identity,
      name: document.displayName,
      type: 'file',
      docType: descriptor?.type ?? document.entityType as DomainDocumentType,
      sectionType: descriptor?.section ?? DomainSectionType.Configuration,
      workspaceFolderId: document.workspaceFolderId,
      compiledDocumentKey: key,
    }
  }
  const files = new Map(entries.map(([key, document]) => [key, file(key, document)]))
  const facets = new Map(entries.filter(([, document]) => document.entityType === 'facet').map(([, document]) => [document.identity, document]))
  for (const [key, document] of entries) {
    const node = files.get(key)!
    if (document.entityType === 'facet') {
      const facetRoot = root(`root-facet:${encodeURIComponent(document.identity)}`, DomainSectionType.Configuration, document.displayName)
      Object.assign(facetRoot, { facetIdentity: document.identity, facetIcon: document.icon, facetColor: document.color })
      continue
    }
    if (document.entityType === 'facet-document' && document.facetIdentity) {
      const facet = facets.get(document.facetIdentity)
      const facetRoot = root(`root-facet:${encodeURIComponent(document.facetIdentity)}`, DomainSectionType.Configuration, facet?.displayName ?? document.facetIdentity)
      Object.assign(node, { facetIdentity: document.facetIdentity, facetIcon: facet?.icon, facetColor: facet?.color })
      facetRoot.children!.push(node)
      continue
    }
    if (document.entityType === 'update' && document.storeIdentity) {
      const store = entries.find(([, value]) => value.entityType === 'store' && value.identity === document.storeIdentity)
      if (store) {
        (files.get(store[0])!.children ??= []).push(node)
        continue
      }
    }
    if (document.entityType === 'composition' && document.kind && document.kind !== 'library') {
      continue
    }
    const rootId = document.entityType === 'stream'
      ? 'root-queries'
      : document.entityType === 'configuration'
        ? 'root-workspaces'
        : rootForSection.get(node.sectionType) ?? 'root-other-documents'
    const parent = document.folderId ? folderNodes.get(document.folderId) : undefined
    ;(parent ?? root(rootId, node.sectionType, ROOT_FOLDER_LABELS[rootId] ?? 'Прочие документы')).children!.push(node)
  }
  if (workspace) {
    const workspaceRoot = root('root-workspaces', DomainSectionType.Workspace)
    const configurations = workspaceRoot.children ?? []
    workspaceRoot.children = [{ id: `workspace:${workspace.identity}`, identity: workspace.identity, name: workspace.displayName, type: 'folder', sectionType: DomainSectionType.Workspace, workspaceIdentity: workspace.identity, activeWorkspace: true, virtual: true, children: configurations }]
  }
  const tree = getRootFolderOrder([...roots.keys()]).map(id => roots.get(id)!)
  attachContextualCompositions(tree, entries
    .filter(([, document]) => document.entityType === 'composition' && document.kind && document.kind !== 'library')
    .map(([, document]) => ({ ...document, kind: document.kind as RCompositionKind })))
  const compositions = new Map(entries.filter(([, document]) => document.entityType === 'composition').map(([key, document]) => [document.identity, key]))
  function linkCompositions(nodes: FsNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file' && node.docType === 'composition') {
        node.compiledDocumentKey = compositions.get(node.identity ?? '')
      }
      linkCompositions(node.children ?? [])
    }
  }
  linkCompositions(tree)
  if (!custom) {
    return tree
  }
  const contextRoots = new Set(['root-workspaces', ...[...roots.keys()].filter(id => id.startsWith('root-facet:'))])
  const hasModelRoot = folders.some(folder => folder.scope === 'workspace' && folder.identity === WORKSPACE_ROOT_FOLDER_IDENTITY)
  const workspaceFolders = hasModelRoot
    ? folders
    : folders.map(folder => folder.scope === 'workspace' && folder.parentId === null
        ? { ...folder, parentId: WORKSPACE_ROOT_FOLDER_IDENTITY }
        : folder)
  return buildCustomWorkspaceProjection(tree, workspaceFolders, contextRoots, new Set(roots.keys()))
}
