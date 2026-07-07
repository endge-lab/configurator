/**
 * Логика построения дерева сущностей домена для виджета Domain_Widget.
 * Вынесено из Domain_Widget.vue для переиспользования и тестирования.
 */

import type { DomainDocumentType, RComponentTable } from '@endge/core'

import {
  ComponentType,
  DomainSectionType,
  Endge,
  FilterType,
  ParameterType,
  QueryType,
} from '@endge/core'

export type FsNodeType = 'file' | 'folder'

export interface FsNodeBase {
  name: string
  type: FsNodeType
}

export interface FsFolderNode extends FsNodeBase {
  type: 'folder'
  id: string
  identity?: string
  sectionType: DomainSectionType
  isRoot?: boolean
  isSystem?: boolean
  folderId?: string | number
  children?: FsNode[]
}

export interface FsFileNode extends FsNodeBase {
  type: 'file'
  id: string
  docType: DomainDocumentType
  sectionType: DomainSectionType
  isSystem?: boolean
  isInDeletedFolder?: boolean
  children?: FsNode[]
  isViewChild?: boolean
  viewChildInherited?: boolean
  isTableColumn?: boolean
  parentComponentId?: string
}

export type FsNode = FsFolderNode | FsFileNode

export interface FlatFsItem {
  node: FsNode
  path: string
  depth: number
  rootId: string
}

/** Вид с полями ссылок (componentId, filterId, queryId). */
export interface ViewWithRefs {
  id: string
  name: string
  componentId?: string | null
  filterId?: string | null
  queryId?: string | null
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

/** Фильтр по проекту: при выбранном проекте показываем только сущности этого проекта или без проекта. */
export function filterByProject<T extends { project?: string | null }>(list: T[], current: string | null): T[] {
  if (current == null)
    return list
  return list.filter(e => e.project == null || e.project === current)
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

/** Без удалённых и без inherited (inherited показываются только внутри вида). */
export function withoutDeletedAndInherited(list: any[] | undefined, softDeletedFolderId?: string | number | null): any[] {
  if (!Array.isArray(list))
    return []
  return list.filter((e: any) => !isDeleted(e, softDeletedFolderId) && !e.inherited && !isTemporaryEntity(e))
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
  scenarios?: any[]
  actions?: any[]
  typesComplex?: any[]
  typesPrimitives?: any[]
  parameters?: any[]
  filters?: any[]
  converters?: any[]
  integrations?: any[]
  views?: any[]
  tenants?: any[]
  pageTemplates?: any[]
  pages?: any[]
  vocabs?: any[]
  i18nBundles?: any[]
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
  project?: string | null
}> {
  const out: Array<{
    id: string
    name: string
    folderId?: string | number | null
    type?: DomainDocumentType
    sectionType: DomainSectionType
    project?: string | null
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
        project: e.project ?? null,
      })
    }
  }
  add(store.components, DomainSectionType.Component)
  add(store.componentSFCs, DomainSectionType.Component)
  add(store.queries, DomainSectionType.Query)
  add(store.scenarios, DomainSectionType.Scenario)
  add(store.actions, DomainSectionType.Action)
  add([...(store.typesPrimitives ?? []), ...(store.typesComplex ?? [])], DomainSectionType.Type)
  add(store.parameters, DomainSectionType.Parameters)
  add(store.filters, DomainSectionType.Filters)
  add(store.converters, DomainSectionType.Converter)
  add(store.integrations, DomainSectionType.Integration)
  add(store.views, DomainSectionType.View)
  add(store.tenants, DomainSectionType.Tenant)
  add(store.pageTemplates, DomainSectionType.PageTemplate)
  add(store.pages, DomainSectionType.Page)
  add(store.vocabs, DomainSectionType.Vocabs)
  add(store.i18nBundles, DomainSectionType.I18nBundles)
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
  'root-settings': 'Настройки',
  'root-vocabs': 'Словари',
  'root-i18n-bundles': 'Словари переводов',
  'root-projects': 'Проекты',
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
    id: 'domain',
    title: 'Сущности',
    rootIds: [
      'root-types',
      'root-queries',
      'root-components',
      'root-scenarios',
      'root-actions',
      'root-filters',
      'root-views',
      'root-converters',
      'root-parameters',
    ],
  },
  {
    id: 'infrastructure',
    title: 'Инфраструктура',
    rootIds: [
      'root-vocabs',
      'root-i18n-bundles',
      'root-integrations',
      'root-policies',
      'root-settings',
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

const SYSTEM_TYPE_FOLDER_IDENTITIES = new Set([
  'types-primitives',
  'types-references',
])

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
  if (sectionType === DomainSectionType.Action)
    return 'action'
  if (sectionType === DomainSectionType.Converter)
    return 'converter'
  if (sectionType === DomainSectionType.Integration)
    return 'integration'
  if (sectionType === DomainSectionType.View)
    return 'view'
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
  if (sectionType === DomainSectionType.Settings)
    return 'settings' as DomainDocumentType
  if (sectionType === DomainSectionType.Vocabs)
    return 'vocabs' as DomainDocumentType
  if (sectionType === DomainSectionType.I18nBundles)
    return 'i18n-bundles' as DomainDocumentType
  if (sectionType === DomainSectionType.Project)
    return 'project' as DomainDocumentType
  return raw
}

/** Дочерние узлы вида: компонент, фильтр, запрос. */
export function buildViewChildRefs(view: ViewWithRefs): FsFileNode[] {
  const nodes: FsFileNode[] = []
  const domain = Endge.domain
  if (view.componentId) {
    const c = domain.getComponent(view.componentId)
    if (c) {
      const docType = (c as any).type === ComponentType.DSL ? ComponentType.DSL : ComponentType.Table
      nodes.push({
        id: String(c.id),
        name: (c as any).name ?? String(c.id),
        type: 'file',
        docType,
        sectionType: DomainSectionType.Component,
        isSystem: (c as { isSystem?: boolean, type?: string }).isSystem === true || (c as { type?: string }).type === 'system',
        isViewChild: true,
        viewChildInherited: (c as { inherited?: boolean }).inherited === true,
      })
    }
  }
  if (view.filterId) {
    const f = domain.getFilter(view.filterId)
    if (f) {
      nodes.push({
        id: String(f.id),
        name: f.displayName ?? f.name ?? String(f.id),
        type: 'file',
        docType: FilterType.DefaultFilter as DomainDocumentType,
        sectionType: DomainSectionType.Filters,
        isSystem: (f as { isSystem?: boolean, type?: string }).isSystem === true || (f as { type?: string }).type === 'system',
        isViewChild: true,
        viewChildInherited: (f as { inherited?: boolean }).inherited === true,
      })
    }
  }
  if (view.queryId) {
    const q = domain.getQuery(view.queryId)
    if (q) {
      nodes.push({
        id: String(q.id),
        name: (q as any).displayName ?? (q as any).name ?? String(q.id),
        type: 'file',
        docType: QueryType.REST as DomainDocumentType,
        sectionType: DomainSectionType.Query,
        isSystem: (q as { isSystem?: boolean, type?: string }).isSystem === true || (q as { type?: string }).type === 'system',
        isViewChild: true,
        viewChildInherited: (q as { inherited?: boolean }).inherited === true,
      })
    }
  }
  return nodes
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
        isViewChild: false,
        viewChildInherited: false,
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
}

function getFolderTraversalKey(folder: { id?: string | number, identity?: string | number, name?: string }): string {
  if (folder.id != null && folder.id !== '')
    return String(folder.id)
  if (folder.identity != null && folder.identity !== '')
    return String(folder.identity)
  return String(folder.name ?? '')
}

function createFolderTreeNode(
  folder: { id: string | number, name?: string, identity?: string, isSystem?: boolean },
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
    isSystem: folder.isSystem === true || SYSTEM_TYPE_FOLDER_IDENTITIES.has(folderIdentity),
    folderId: isRoot ? undefined : folderId,
    children,
  }
}

function buildFolderNode(
  folder: { id: string | number, name?: string, identity?: string, isSystem?: boolean },
  sectionType: DomainSectionType,
  allSectionItems: { id: string, name: string, folderId?: string | number | null, folder?: string | number | null, group?: string | number | null, type?: DomainDocumentType, isSystem?: boolean }[],
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

  const isSectionWithInherited
    = sectionType === DomainSectionType.Query
      || sectionType === DomainSectionType.Component
      || sectionType === DomainSectionType.Filters
  const effectiveItems = isSectionWithInherited
    ? allSectionItems.filter((e: any) => !e.inherited)
    : allSectionItems

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
      const useIdentityForId = itemSectionType === DomainSectionType.Settings || itemSectionType === DomainSectionType.Project
      const id = useIdentityForId ? String((c as any).identity ?? c.id ?? '') : String(c.id ?? (c as any).identity ?? c.name ?? '')
      const name = (c as any).displayName ?? c.name ?? id
      const fileNode: FsFileNode = {
        id,
        name,
        type: 'file',
        docType: isPrimitiveType ? ('primitive' as DomainDocumentType) : normalizeDocType(itemSectionType, c.type)!,
        sectionType: itemSectionType,
        isSystem:
          (c as { isSystem?: boolean, type?: string }).isSystem === true
          || (c as { type?: string }).type === 'system'
          || SYSTEM_TYPE_FOLDER_IDENTITIES.has(folderIdentity),
        isInDeletedFolder: currentInDeletedBranch,
      }
      if (itemSectionType === DomainSectionType.View) {
        fileNode.children = buildViewChildRefs(c as ViewWithRefs)
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
        return { root: folder, sectionKey }
      if (sectionMapRecord[sectionKey]) {
        return { root: { id: sectionKey, identity: sectionKey, name: rootLabels[sectionKey] ?? sectionKey }, sectionKey }
      }
      return null
    })
    .filter(Boolean) as Array<{ root: any, sectionKey: string }>

  return orderedRoots.map(({ root, sectionKey }) => {
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
