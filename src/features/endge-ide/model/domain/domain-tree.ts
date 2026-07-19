/**
 * Логика построения дерева сущностей домена для виджета Domain_Widget.
 * Вынесено из Domain_Widget.vue для переиспользования и тестирования.
 */

import type { QUERY_COMPOSITION_PRESENTATION_KIND } from './query-composition-presentation'
import type { DomainDocumentType, EntityOrigin, ManagedBy, RComponentTable, RCompositionKind, ResolvedActionDescriptor } from '@endge/core'

import {
  ComponentType,
  DomainSectionType,
  Endge,
  FilterType,
  ParameterType,
} from '@endge/core'

export type CompositionPresentationKind = RCompositionKind | typeof QUERY_COMPOSITION_PRESENTATION_KIND

export type FsNodeType = 'file' | 'folder'

export interface FsNodeBase {
  name: string
  type: FsNodeType
  virtual?: boolean
  badges?: string[]
}

export interface FsFolderNode extends FsNodeBase {
  type: 'folder'
  id: string
  identity?: string
  sectionType: DomainSectionType
  /** Runtime-only origin group. Built-in and provided groups precede persisted children. */
  virtualOrigin?: 'builtin' | 'derived' | 'local'
  isRoot?: boolean
  managedBy?: ManagedBy
  managedById?: string | null
  folderId?: string | number
  children?: FsNode[]
}

export interface FsFileNode extends FsNodeBase {
  type: 'file'
  id: string
  identity?: string
  docType: DomainDocumentType
  sectionType: DomainSectionType
  managedBy?: ManagedBy
  managedById?: string | null
  isInDeletedFolder?: boolean
  children?: FsNode[]
  isTableColumn?: boolean
  parentComponentId?: string
  presentationKind?: CompositionPresentationKind
  origin?: EntityOrigin
  /** Persisted authoring document represented by this virtual projection. */
  sourceDocument?: {
    identity: string
    docType: DomainDocumentType
  }
}

export type FsNode = FsFolderNode | FsFileNode

export interface FlatFsItem {
  node: FsNode
  path: string
  depth: number
  rootId: string
}

export const SOFT_DELETED_IDENTITY = 'soft-deleted'

/** Признак удалённой сущности (папка «удалённые» по id или проставлен deletedAt). */
export function isDeleted(
  e: { folderId?: string | number | null, folder?: string | number | null, group?: string | number | null, deletedAt?: string | null },
  softDeletedFolderId?: string | number | null,
): boolean {
  const fid = e.folderId ?? e.folder ?? e.group ?? null
  return (softDeletedFolderId != null && fid === softDeletedFolderId) || (e.deletedAt != null && e.deletedAt !== '')
}

function isTemporaryEntity(entity: unknown): boolean {
  return (entity as { isTemporary?: boolean } | null | undefined)?.isTemporary === true
}

/** Исключаем удалённые из списков. */
export function withoutDeleted<T extends { folderId?: string | number | null, folder?: string | number | null, group?: string | number | null, deletedAt?: string | null }>(
  list: T[] | undefined,
  softDeletedFolderId?: string | number | null,
): T[] {
  if (!Array.isArray(list))
    return []
  return list.filter(e => !isDeleted(e, softDeletedFolderId) && !isTemporaryEntity(e))
}

export function getFolderParent(f: { parent?: string | number | null, parentId?: string | number }): string | number | null {
  const p = f.parent ?? (f as any).parentId
  return p == null || p === '' ? null : p
}

/** Минимальный контракт store для getSoftDeletedItems. */
export interface DomainStoreForTree {
  folders?: any[]
  components?: any[]
  componentSFCs?: any[]
  queries?: any[]
  dataViews?: any[]
  compositions?: any[]
  stores?: any[]
  mocks?: any[]
  actions?: any[]
  typesComplex?: any[]
  typesPrimitives?: any[]
  parameters?: any[]
  filters?: any[]
  converters?: any[]
  computations?: any[]
  integrations?: any[]
  tenants?: any[]
  pageTemplates?: any[]
  pages?: any[]
  vocabs?: any[]
  i18nBundles?: any[]
  authProfiles?: any[]
  projects?: any[]
}

/** Собирает только удалённые сущности в папку «Удалённые» (из всех секций). */
export function getSoftDeletedItems(
  store: DomainStoreForTree,
  softDeletedFolderId?: string | number | null,
  allFolders?: Array<{ id?: string | number, parent?: string | number | null, parentId?: string | number | null }>,
): Array<{
  id: string
  name: string
  folderId?: string | number | null
  type?: DomainDocumentType
  sectionType: DomainSectionType
  presentationKind?: CompositionPresentationKind
}> {
  const out: Array<{
    id: string
    name: string
    folderId?: string | number | null
    type?: DomainDocumentType
    sectionType: DomainSectionType
  }> = []

  const deletedFolderIds = collectDeletedFolderBranchIds(
    allFolders ?? store.folders ?? [],
    softDeletedFolderId,
  )
  const isDeletedOrInDeletedFolderBranch = (e: any) => {
    const fid = e?.folderId ?? e?.folder ?? e?.group ?? null
    return isDeleted(e, softDeletedFolderId) || (fid != null && deletedFolderIds.has(String(fid)))
  }

  const add = (list: any[] | undefined, sectionType: DomainSectionType) => {
    if (!Array.isArray(list))
      return
    for (const e of list) {
      if (isTemporaryEntity(e))
        continue
      if (!isDeletedOrInDeletedFolderBranch(e))
        continue
      out.push({
        id: e.id ?? e.name ?? '',
        name: e.name ?? e.id ?? '',
        folderId: e.folderId ?? e.folder ?? e.group,
        type: e.type,
        sectionType,
        ...(e?.type === 'composition' && { presentationKind: String(e.kind ?? 'library') as CompositionPresentationKind }),
      })
    }
  }
  add(store.components, DomainSectionType.Component)
  add(store.componentSFCs, DomainSectionType.Component)
  add(store.queries, DomainSectionType.Query)
  add(store.dataViews, DomainSectionType.DataView)
  add(store.compositions, DomainSectionType.Composition)
  add(store.stores, DomainSectionType.Store)
  add(store.mocks, DomainSectionType.Mock)
  add(store.actions, DomainSectionType.Action)
  add([...(store.typesPrimitives ?? []), ...(store.typesComplex ?? [])], DomainSectionType.Type)
  add(store.parameters, DomainSectionType.Parameters)
  add(store.filters, DomainSectionType.Filters)
  add(store.converters, DomainSectionType.Converter)
  add(store.computations, DomainSectionType.Computation)
  add(store.integrations, DomainSectionType.Integration)
  add(store.tenants, DomainSectionType.Tenant)
  add(store.pageTemplates, DomainSectionType.PageTemplate)
  add(store.pages, DomainSectionType.Page)
  add(store.vocabs, DomainSectionType.Vocabs)
  add(store.i18nBundles, DomainSectionType.I18nBundles)
  add(store.authProfiles, DomainSectionType.AuthProfile)
  add(store.projects, DomainSectionType.Project)
  return out
}

function collectDeletedFolderBranchIds(
  allFolders: Array<{ id?: string | number, parent?: string | number | null, parentId?: string | number | null }>,
  softDeletedFolderId?: string | number | null,
): Set<string> {
  const out = new Set<string>()
  if (softDeletedFolderId == null)
    return out

  const softId = String(softDeletedFolderId)
  out.add(softId)

  let changed = true
  while (changed) {
    changed = false
    for (const folder of allFolders) {
      const id = folder?.id
      if (id == null)
        continue
      const parent = getFolderParent(folder as any)
      if (parent == null)
        continue
      const idKey = String(id)
      if (!out.has(idKey) && out.has(String(parent))) {
        out.add(idKey)
        changed = true
      }
    }
  }

  return out
}

/** Подписи для виртуальных корней. */
export const ROOT_FOLDER_LABELS: Record<string, string> = {
  'root-environments': 'Окружения',
  'root-tenants': 'Тенанты',
  'root-policies': 'Политики',
  'root-styles': 'Стили',
  'root-page-templates': 'Шаблоны страниц',
  'root-pages': 'Страницы',
  'root-navigations': 'Навигации',
  'root-data-views': 'Представления',
  'root-compositions': 'Композиции',
  'root-stores': 'Хранилище',
  'root-vocabs': 'Словари',
  'root-mocks': 'Mock',
  'root-i18n-bundles': 'Словари переводов',
  'root-auth-profiles': 'Аутентификация',
  'root-projects': 'Проекты',
  'root-computations': 'Вычисления',
  'soft-deleted': 'Удалённые',
}

export interface DomainTreeRootBlock {
  id: string
  title: string
  rootIds: string[]
  className?: string
  showTitle?: boolean
}

export const DOMAIN_TREE_ROOT_BLOCKS: DomainTreeRootBlock[] = [
  {
    id: 'context',
    title: 'Контекст',
    rootIds: [
      'root-tenants',
      'root-projects',
      'root-environments',
    ],
  },
  {
    id: 'data',
    title: 'Данные',
    rootIds: [
      'root-stores',
      'root-vocabs',
      'root-mocks',
    ],
  },
  {
    id: 'domain',
    title: 'Сущности',
    rootIds: [
      'root-types',
      'root-queries',
      'root-data-views',
      'root-compositions',
      'root-components',
      'root-actions',
      'root-filters',
      'root-converters',
      'root-computations',
      'root-parameters',
    ],
  },
  {
    id: 'infrastructure',
    title: 'Инфраструктура',
    rootIds: [
      'root-i18n-bundles',
      'root-auth-profiles',
      'root-integrations',
      'root-policies',
    ],
  },
  {
    id: 'ui',
    title: 'Интерфейс',
    rootIds: [
      'root-page-templates',
      'root-pages',
      'root-navigations',
      'root-styles',
    ],
  },
  {
    id: 'deleted',
    title: 'Другое',
    rootIds: [
      'soft-deleted',
    ],
    className: 'mt-4',
    showTitle: true,
  },
]

export function getDomainTreeRootBlocks(keys: string[]): DomainTreeRootBlock[] {
  return DOMAIN_TREE_ROOT_BLOCKS
    .map(block => ({
      ...block,
      rootIds: block.rootIds.filter(rootId => keys.includes(rootId)),
    }))
    .filter(block => block.rootIds.length > 0)
}

/** Порядок корневых папок. */
export function getRootFolderOrder(keys: string[]): string[] {
  const ordered: string[] = []
  for (const block of getDomainTreeRootBlocks(keys))
    ordered.push(...block.rootIds)
  for (const k of keys) {
    if (!ordered.includes(k))
      ordered.push(k)
  }
  return ordered
}

export function normalizeDocType(
  sectionType: DomainSectionType,
  raw?: DomainDocumentType,
): DomainDocumentType | undefined {
  if (sectionType === DomainSectionType.Primitive || sectionType === DomainSectionType.Type)
    return 'type'
  if (sectionType === DomainSectionType.Parameters)
    return ParameterType.DefaultParameter
  if (sectionType === DomainSectionType.Filters)
    return FilterType.DefaultFilter
  if (sectionType === DomainSectionType.DataView)
    return 'data-view' as DomainDocumentType
  if (sectionType === DomainSectionType.Composition)
    return 'composition' as DomainDocumentType
  if (sectionType === DomainSectionType.Store)
    return 'store' as DomainDocumentType
  if (sectionType === DomainSectionType.Mock)
    return 'mock' as DomainDocumentType
  if (sectionType === DomainSectionType.Action)
    return 'action'
  if (sectionType === DomainSectionType.Converter)
    return 'converter'
  if (sectionType === DomainSectionType.Computation)
    return 'computation'
  if (sectionType === DomainSectionType.Integration)
    return 'integration'
  if (sectionType === DomainSectionType.Environment)
    return 'environment'
  if (sectionType === DomainSectionType.Tenant)
    return 'tenant'
  if (sectionType === DomainSectionType.Policy)
    return 'policy'
  if (sectionType === DomainSectionType.Style)
    return 'style'
  if (sectionType === DomainSectionType.PageTemplate)
    return 'page-template' as DomainDocumentType
  if (sectionType === DomainSectionType.Page)
    return 'page' as DomainDocumentType
  if (sectionType === DomainSectionType.Navigation)
    return 'navigation' as DomainDocumentType
  if (sectionType === DomainSectionType.Vocabs)
    return 'vocabs' as DomainDocumentType
  if (sectionType === DomainSectionType.I18nBundles)
    return 'i18n-bundles' as DomainDocumentType
  if (sectionType === DomainSectionType.AuthProfile)
    return 'auth-profile' as DomainDocumentType
  if (sectionType === DomainSectionType.Project)
    return 'project' as DomainDocumentType
  return raw
}

/** Дочерние узлы компонента-таблицы: активные колонки. */
export function buildTableColumnRefs(componentId: string): FsFileNode[] {
  const component = Endge.domain.getComponent(componentId) as RComponentTable | null
  if (!component || component.type !== ComponentType.Table)
    return []

  const cols = Array.isArray(component.columns) ? component.columns : []
  return cols
    .filter((col: any) => col && col.isActive)
    .map((col: any, index: number): FsFileNode => {
      const columnId = String(col.id ?? index)
      const name = (col.title as string | undefined) ?? columnId
      return {
        id: `${componentId}::column::${columnId}`,
        name,
        type: 'file',
        docType: ComponentType.Table as DomainDocumentType,
        sectionType: DomainSectionType.Component,
        isTableColumn: true,
        parentComponentId: componentId,
      }
    })
}

/** Параметры для построения дерева. */
export interface BuildDomainTreeParams {
  rootToSection: Record<string, { section: DomainSectionType, items: () => unknown[] }>
  rootOrder: string[]
  rootLabels: Record<string, string>
  allFolders: any[]
  /** Id папки «Удалённые» для определения isInDeletedFolder и isDeleted. */
  softDeletedFolderId?: string | number | null
  /** Composition documents presented by kind rather than their persisted folder. */
  contextualCompositions?: Array<{
    id?: string | number
    identity?: string
    name?: string
    displayName?: string
    kind?: RCompositionKind
    kindIdentity?: string | null
    folderId?: string | number | null
  }>
}

function getFolderTraversalKey(folder: { id?: string | number, identity?: string | number, name?: string }): string {
  if (folder.id != null && folder.id !== '')
    return String(folder.id)
  if (folder.identity != null && folder.identity !== '')
    return String(folder.identity)
  return String(folder.name ?? '')
}

function createFolderTreeNode(
  folder: { id: string | number, name?: string, identity?: string, managedBy?: ManagedBy, managedById?: string | null },
  sectionType: DomainSectionType,
  folderId: string | number,
  folderIdentity: string,
  folderName: string,
  isRoot: boolean,
  children: FsNode[],
): FsFolderNode {
  return {
    id: isRoot ? String(folder.identity ?? folder.id ?? folderId) : `folder:${folderId}`,
    identity: folderIdentity || String(folderId),
    name: folderName,
    type: 'folder',
    sectionType,
    isRoot: !!isRoot,
    managedBy: folder.managedBy ?? 'user',
    managedById: folder.managedBy === 'integration' ? folder.managedById ?? null : null,
    folderId: isRoot ? undefined : folderId,
    children,
  }
}

function buildFolderNode(
  folder: { id: string | number, name?: string, identity?: string, managedBy?: ManagedBy, managedById?: string | null },
  sectionType: DomainSectionType,
  allSectionItems: { id: string, name: string, folderId?: string | number | null, folder?: string | number | null, group?: string | number | null, type?: DomainDocumentType, managedBy?: ManagedBy, managedById?: string | null }[],
  allFolders: any[],
  isRoot = true,
  isVirtualRoot = false,
  softDeletedFolderId?: string | number | null,
  isInDeletedBranch = false,
  visitedFolderKeys: Set<string> = new Set(),
  traversalPath: string[] = [],
): FsFolderNode {
  const folderId = folder.id ?? folder.identity
  const folderName = folder.name ?? folder.identity ?? String(folderId)
  const folderIdentity = String((folder as any).identity ?? folder.id ?? '')
  const folderKey = getFolderTraversalKey(folder)
  const currentInDeletedBranch
    = isInDeletedBranch
      || folderIdentity === SOFT_DELETED_IDENTITY
      || (softDeletedFolderId != null && String(folderId) === String(softDeletedFolderId))

  if (visitedFolderKeys.has(folderKey)) {
    console.warn('[DomainTree] Skipping cyclic folder branch while building admin tree', {
      cycle: [...traversalPath, folderKey],
      folderId: String(folderId),
      folderIdentity,
      sectionType,
    })
    return createFolderTreeNode(folder, sectionType, folderId, folderIdentity, folderName, isRoot, [])
  }

  const nextVisitedFolderKeys = new Set(visitedFolderKeys)
  nextVisitedFolderKeys.add(folderKey)
  const nextTraversalPath = [...traversalPath, folderKey]

  const effectiveItems = allSectionItems

  const isSameId = (a: string | number | null | undefined, b: string | number | null | undefined) =>
    a != null && b != null ? String(a) === String(b) : a === b
  const childFolders = allFolders.filter((f: any) => isSameId(getFolderParent(f), folderId))
  const effectiveFolderId = (e: any) => e.folderId ?? e.folder ?? e.group ?? null
  const itemsInThisFolder
    = isRoot && isVirtualRoot
      ? effectiveItems
      : effectiveItems.filter(
          (e: any) => {
            const fid = effectiveFolderId(e)
            return isSameId(fid, folderId) || ((fid === null || fid === undefined) && isRoot)
          },
        )

  const children: FsNode[] = [
    ...childFolders.map((f: any) =>
      buildFolderNode(
        f,
        sectionType,
        effectiveItems,
        allFolders,
        false,
        false,
        softDeletedFolderId,
        currentInDeletedBranch,
        nextVisitedFolderKeys,
        nextTraversalPath,
      ),
    ),
    ...itemsInThisFolder.map((c): FsFileNode => {
      const itemSectionType = (c as { sectionType?: DomainSectionType }).sectionType ?? sectionType
      const isPrimitiveType
        = itemSectionType === DomainSectionType.Primitive
          || (itemSectionType === DomainSectionType.Type && (c as { isPrimitive?: boolean }).isPrimitive === true)
      const useIdentityForId = itemSectionType === DomainSectionType.Project
      const id = useIdentityForId ? String((c as any).identity ?? c.id ?? '') : String(c.id ?? (c as any).identity ?? c.name ?? '')
      const identity = String((c as any).identity ?? '')
      const name = (c as any).displayName ?? c.name ?? id
      const fileNode: FsFileNode = {
        id,
        ...(identity ? { identity } : {}),
        name,
        type: 'file',
        docType: isPrimitiveType ? ('primitive' as DomainDocumentType) : normalizeDocType(itemSectionType, c.type)!,
        sectionType: itemSectionType,
        managedBy: (c as { managedBy?: ManagedBy }).managedBy ?? 'user',
        managedById: (c as { managedById?: string | null }).managedById ?? null,
        isInDeletedFolder: currentInDeletedBranch,
        ...((c as { presentationKind?: unknown }).presentationKind != null
          && { presentationKind: String((c as { presentationKind?: unknown }).presentationKind) as CompositionPresentationKind }),
      }
      if (
        itemSectionType === DomainSectionType.Component
        && fileNode.docType === (ComponentType.Table as DomainDocumentType)
      ) {
        const tableChildren = buildTableColumnRefs(id)
        if (tableChildren.length) {
          fileNode.children = [...(fileNode.children ?? []), ...tableChildren]
        }
      }
      return fileNode
    }),
  ]

  return createFolderTreeNode(folder, sectionType, folderId, folderIdentity, folderName, isRoot, children)
}

/**
 * Строит дерево секций и сущностей домена.
 */
export function buildDomainTree(params: BuildDomainTreeParams): FsNode[] {
  const { rootToSection, rootOrder, rootLabels, allFolders, softDeletedFolderId } = params
  const folders = allFolders
  const rootFolders = folders.filter((f: any) => getFolderParent(f) == null)
  const sectionMapRecord = rootToSection as Record<string, { section: DomainSectionType, items: () => unknown[] }>

  const orderedRoots = rootOrder
    .map((sectionKey) => {
      const folder = rootFolders.find((f: any) => (f.identity ?? f.id) === sectionKey)
      if (folder)
        return { root: { ...folder, name: rootLabels[sectionKey] ?? folder.name }, sectionKey }
      if (sectionMapRecord[sectionKey]) {
        return { root: { id: sectionKey, identity: sectionKey, name: rootLabels[sectionKey] ?? sectionKey }, sectionKey }
      }
      return null
    })
    .filter(Boolean) as Array<{ root: any, sectionKey: string }>

  const tree = orderedRoots.map(({ root, sectionKey }) => {
    const sectionInfo = sectionMapRecord[sectionKey]
    const sectionType = sectionInfo?.section ?? DomainSectionType.Type
    const allItems = sectionInfo?.items?.() ?? []
    const items = (Array.isArray(allItems) ? allItems : []).filter(item => !isTemporaryEntity(item)) as {
      id: string
      name: string
      folderId?: string | number | null
      folder?: string | number | null
      group?: string | number | null
      type?: DomainDocumentType
    }[]
    const isVirtualRoot = !rootFolders.some((f: any) => (f.identity ?? f.id) === sectionKey)
    return buildFolderNode(root, sectionType, items, folders, true, isVirtualRoot, softDeletedFolderId)
  })

  attachContextualCompositions(tree, params.contextualCompositions ?? [])
  return tree
}

/** Adds effective non-persisted Actions and annotates persisted overrides. */
export function attachResolvedActionTree(
  tree: FsNode[],
  actions: readonly ResolvedActionDescriptor[],
): void {
  const root = tree.find(node => node.type === 'folder' && node.id === 'root-actions') as FsFolderNode | undefined
  if (!root) {
    return
  }

  const findPersisted = (nodes: FsNode[], identity: string): FsFileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file' && node.identity === identity) {
        return node
      }
      const nested = findPersisted(node.children ?? [], identity)
      if (nested) {
        return nested
      }
    }
    return null
  }
  for (const action of actions.filter(action => action.origin.kind === 'storage')) {
    const node = findPersisted(root.children ?? [], action.identity)
    if (!node) {
      continue
    }
    node.origin = action.origin
    node.badges = [
      ...(node.managedBy === 'system' ? ['system'] : []),
      ...(action.overridden ? ['overridden'] : []),
      ...(action.overridden && action.effectiveProviderOrigin?.kind ? [action.effectiveProviderOrigin.kind] : []),
    ]
  }

  const groups = new Map<string, FsFolderNode>()
  const componentOwners = new Map<string, FsFileNode>()
  const findComponentDocument = (
    nodes: readonly FsNode[],
    identity: string,
    docType: DomainDocumentType,
  ): FsFileNode | null => {
    for (const node of nodes) {
      if (
        node.type === 'file'
        && !node.virtual
        && node.identity === identity
        && node.docType === docType
      ) {
        return node
      }
      const nested = findComponentDocument(node.children ?? [], identity, docType)
      if (nested) {
        return nested
      }
    }
    return null
  }
  const resolveComponentOwnerName = (identity: string, docType: DomainDocumentType): string => {
    const treeDocument = findComponentDocument(tree, identity, docType)
    if (treeDocument?.name?.trim()) {
      return treeDocument.name
    }
    const component = docType === ComponentType.SFC
      ? Endge.domain.getComponentSFC(identity)
      : Endge.domain.getComponent(identity)
    return component?.displayName?.trim() || component?.name?.trim() || identity
  }
  const ensureFolder = (
    parent: FsFolderNode,
    id: string,
    name: string,
    virtualOrigin?: FsFolderNode['virtualOrigin'],
  ): FsFolderNode => {
    const key = `${parent.id}/${id}`
    const existing = groups.get(key)
    if (existing) {
      return existing
    }
    const folder: FsFolderNode = {
      id,
      identity: id,
      name,
      type: 'folder',
      sectionType: DomainSectionType.Action,
      virtual: true,
      virtualOrigin,
      children: [],
    }
    const children = parent.children ??= []
    if (virtualOrigin === 'builtin') {
      children.unshift(folder)
    }
    else if (virtualOrigin === 'derived') {
      const builtInIndex = children.findIndex(node =>
        node.type === 'folder' && node.virtualOrigin === 'builtin',
      )
      children.splice(builtInIndex >= 0 ? builtInIndex + 1 : 0, 0, folder)
    }
    else {
      children.push(folder)
    }
    groups.set(key, folder)
    return folder
  }

  const componentOwnerDocumentType = (action: ResolvedActionDescriptor): DomainDocumentType | null => {
    if (action.origin.kind === 'derived') {
      return action.origin.source.type as DomainDocumentType
    }
    const componentTarget = action.target?.find(selector => selector.type.startsWith('component.'))
    if (!componentTarget) {
      return null
    }
    if (componentTarget.type === 'component.table') {
      return ComponentType.Table
    }
    return ComponentType.SFC
  }

  const ensureComponentOwner = (
    parent: FsFolderNode,
    kind: 'derived' | 'builtin' | 'local',
    ownerIdentity: string,
    docType: DomainDocumentType,
  ): FsFileNode => {
    const id = `virtual:actions:${kind}:${ownerIdentity}`
    const key = `${parent.id}/${id}`
    const existing = componentOwners.get(key)
    if (existing) {
      return existing
    }
    const owner: FsFileNode = {
      id,
      identity: ownerIdentity,
      name: resolveComponentOwnerName(ownerIdentity, docType),
      type: 'file',
      docType,
      sectionType: DomainSectionType.Component,
      virtual: true,
      ...(kind === 'derived' && {
        sourceDocument: {
          identity: ownerIdentity,
          docType,
        },
      }),
      children: [],
    }
    ;(parent.children ??= []).push(owner)
    componentOwners.set(key, owner)
    return owner
  }

  for (const kind of ['builtin', 'derived', 'local'] as const) {
    for (const action of actions.filter(action => action.origin.kind === kind)) {
      const groupName = kind === 'derived' ? 'Provided' : kind === 'builtin' ? 'Built-in' : 'Local'
      const group = ensureFolder(root, `virtual:actions:${kind}`, groupName, kind)
      const componentGroup = kind === 'derived'
        ? ensureFolder(group, 'virtual:actions:derived:components', 'Компоненты')
        : group
      const ownerIdentity = action.origin.kind === 'derived'
        ? action.origin.source.identity
        : action.origin.kind === 'builtin' || action.origin.kind === 'local'
          ? action.origin.owner
          : 'storage'
      const componentDocType = componentOwnerDocumentType(action)
      let owner: FsFolderNode | FsFileNode
      if (componentDocType) {
        owner = ensureComponentOwner(componentGroup, kind, ownerIdentity, componentDocType)
      }
      else if (action.catalogPath?.length) {
        owner = action.catalogPath.reduce<FsFolderNode>((parent, segment, index) => {
          const normalized = String(segment ?? '').trim()
          return ensureFolder(parent, `virtual:actions:${kind}:catalog:${index}:${normalized}`, normalized)
        }, group)
      }
      else {
        owner = ensureFolder(group, `virtual:actions:${kind}:${ownerIdentity}`, ownerIdentity)
      }
      ;(owner.children ??= []).push({
        id: `virtual:${kind}:action:${action.identity}`,
        identity: action.identity,
        name: action.displayName,
        type: 'file',
        docType: 'action',
        sectionType: DomainSectionType.Action,
        virtual: true,
        origin: action.origin,
        badges: kind === 'derived'
          ? ['provided']
          : kind === 'builtin'
            ? ['system', 'built-in']
            : ['local'],
      })
    }
  }
}

const COMPOSITION_KIND_ROOT: Partial<Record<RCompositionKind, string>> = {
  query: 'root-queries',
  tenant: 'root-tenants',
  project: 'root-projects',
  environment: 'root-environments',
  workspace: 'root-compositions',
}

const COMPOSITION_KIND_SECTION: Partial<Record<RCompositionKind, DomainSectionType>> = {
  query: DomainSectionType.Query,
  tenant: DomainSectionType.Tenant,
  project: DomainSectionType.Project,
  environment: DomainSectionType.Environment,
}

function findOwnedNode(
  nodes: FsNode[],
  identity: string,
  sectionType?: DomainSectionType,
): FsFileNode | null {
  for (const node of nodes) {
    if (
      node.type === 'file'
      && (sectionType == null || node.sectionType === sectionType)
      && (node.identity === identity || node.id === identity)
    )
      return node
    const match = findOwnedNode(node.children ?? [], identity, sectionType)
    if (match)
      return match
  }
  return null
}

function findFolderNode(
  nodes: FsNode[],
  folderId: string | number,
): FsFolderNode | null {
  const expected = String(folderId)
  for (const node of nodes) {
    if (
      node.type === 'folder'
      && (
        String(node.folderId ?? '') === expected
        || String(node.identity ?? '') === expected
        || String(node.id ?? '') === expected
        || String(node.id ?? '') === `folder:${expected}`
      )
    )
      return node

    const match = findFolderNode(node.children ?? [], folderId)
    if (match)
      return match
  }
  return null
}

function attachContextualCompositions(
  tree: FsNode[],
  compositions: NonNullable<BuildDomainTreeParams['contextualCompositions']>,
): void {
  for (const composition of compositions) {
    const kind = composition.kind ?? 'library'
    if (kind === 'library')
      continue

    const rootId = COMPOSITION_KIND_ROOT[kind] ?? 'root-compositions'
    const root = tree.find(node => node.type === 'folder' && node.id === rootId) as FsFolderNode | undefined
    if (!root)
      continue

    const kindIdentity = String(composition.kindIdentity ?? '').trim()
    const owner = kindIdentity
      ? findOwnedNode(root.children ?? [], kindIdentity, COMPOSITION_KIND_SECTION[kind])
      : null
    const id = String(composition.id ?? composition.identity ?? '')
    const identity = String(composition.identity ?? '')
    const node: FsFileNode = {
      id,
      ...(identity ? { identity } : {}),
      name: composition.displayName ?? composition.name ?? identity ?? id,
      type: 'file',
      docType: 'composition',
      sectionType: DomainSectionType.Composition,
      presentationKind: kind,
    }

    const folder = !kindIdentity && composition.folderId != null
      ? findFolderNode([root], composition.folderId)
      : null
    const targetChildren = owner
      ? (owner.children ??= [])
      : folder
        ? (folder.children ??= [])
        : (root.children ??= [])
    targetChildren.push(node)
  }
}

/**
 * Разворачивает дерево в плоский список с учётом раскрытых папок.
 */
export function flattenTree(
  items: FsNode[],
  expandedPaths: Set<string>,
  parentPath = '',
  depth = 0,
  rootId = '',
): FlatFsItem[] {
  const result: FlatFsItem[] = []
  for (const node of items) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name
    const currentRootId = depth === 0 && node.type === 'folder' ? (node.id ?? rootId) : rootId
    result.push({ node, path, depth, rootId: currentRootId })

    if (node.type === 'folder' && node.children && expandedPaths.has(path)) {
      result.push(...flattenTree(node.children, expandedPaths, path, depth + 1, currentRootId))
    }
    else if (node.type === 'file') {
      const fn = node as FsFileNode
      if (fn.children?.length && expandedPaths.has(path)) {
        result.push(...flattenTree(fn.children, expandedPaths, path, depth + 1, currentRootId))
      }
    }
  }
  return result
}
