/**
 * Логика построения дерева сущностей домена для виджета Domain_Widget.
 * Вынесено из Domain_Widget.vue для переиспользования и тестирования.
 */

import type { QUERY_COMPOSITION_PRESENTATION_KIND } from './query-composition-presentation'
import type { DomainDocumentType, EntityOrigin, ManagedBy, RComponentTable, RCompositionKind, ResolvedActionDescriptor, TypeProgramCatalogEntry } from '@endge/core'

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
  /** Frontend-only Workspace projection; never belongs to Endge Domain. */
  workspaceIdentity?: string
  activeWorkspace?: boolean
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
  /** Frontend-only Event catalog metadata. */
  eventPort?: {
    payloadType: string
    origin: 'builtin' | 'own' | 'forwarded'
    hasAction: boolean
    sourceRange?: { start: number, end: number }
  }
}

export type FsNode = FsFolderNode | FsFileNode

export interface WorkspaceTreeProjectionInput {
  id: string | number
  identity: string
  displayName: string
  role: string
  active: boolean
}

export interface ConfigurationTreeProjectionInput {
  id: string | number
  identity: string
  displayName?: string | null
  deletedAt?: string | null
}

/** Projects only the active Workspace configurations as flat, folderless children. */
export function buildWorkspaceTreeNodes(
  workspaces: readonly WorkspaceTreeProjectionInput[],
  activeWorkspaceIdentity: string,
  configurations: readonly ConfigurationTreeProjectionInput[],
): FsNode[] {
  return workspaces.filter(workspace => workspace.active).map((workspace): FsNode => {
    const activeWorkspace = workspace.identity === activeWorkspaceIdentity
    const common = {
      id: `workspace:${workspace.id}`,
      identity: workspace.identity,
      name: workspace.displayName,
      virtual: true,
      workspaceIdentity: workspace.identity,
      activeWorkspace,
      badges: [workspace.role],
    }
    if (!activeWorkspace) {
      return { ...common, type: 'file', docType: 'project', sectionType: DomainSectionType.Project }
    }
    return {
      ...common,
      type: 'folder',
      sectionType: DomainSectionType.Configuration,
      children: configurations
        .filter(item => item.deletedAt == null)
        .sort((left, right) => (left.displayName || left.identity).localeCompare(right.displayName || right.identity) || left.identity.localeCompare(right.identity))
        .map(item => ({
          id: String(item.id),
          identity: item.identity,
          name: item.displayName || item.identity,
          type: 'file' as const,
          docType: 'configuration' as DomainDocumentType,
          sectionType: DomainSectionType.Configuration,
        })),
    }
  })
}

export interface FlatFsItem {
  node: FsNode
  path: string
  depth: number
  rootId: string
}

/** Признак удалённой сущности по серверному tombstone. */
export function isDeleted(
  e: { deletedAt?: string | null },
): boolean {
  return e.deletedAt != null && e.deletedAt !== ''
}

function isTemporaryEntity(entity: unknown): boolean {
  return (entity as { isTemporary?: boolean } | null | undefined)?.isTemporary === true
}

/** Исключаем удалённые из списков. */
export function withoutDeleted<T>(list: T[] | undefined): T[] {
  if (!Array.isArray(list))
    return []
  return list.filter(e => !isDeleted(e as { deletedAt?: string | null }) && !isTemporaryEntity(e))
}

export function getFolderParent(f: { parent?: string | number | null, parentId?: string | number }): string | number | null {
  const p = f.parent ?? (f as any).parentId
  return p == null || p === '' ? null : p
}

/** Полные русские подписи корневых разделов дерева. */
export const ROOT_FOLDER_LABELS: Record<string, string> = {
  'root-workspaces': 'Рабочие пространства',
  'root-types': 'Типы',
  'root-queries': 'Обмен данными',
  'root-data-views': 'Представления',
  'root-compositions': 'Композиции',
  'root-stores': 'Хранилища',
  'root-components': 'Компоненты',
  'root-actions': 'Действия',
  'root-events': 'События',
  'root-filters': 'Фильтры',
  'root-converters': 'Конвертеры',
  'root-computations': 'Вычисления',
  'root-parameters': 'Параметры',
  'root-integrations': 'Интеграции',
  'root-environments': 'Окружения',
  'root-tenants': 'Тенанты',
  'root-policies': 'Политики',
  'root-styles': 'Стили',
  'root-page-templates': 'Шаблоны страниц',
  'root-pages': 'Страницы',
  'root-navigations': 'Навигация',
  'root-vocabs': 'Словари',
  'root-mocks': 'Тестовые данные',
  'root-i18n-bundles': 'Словари переводов',
  'root-auth-profiles': 'Профили аутентификации',
  'root-projects': 'Проекты',
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
      'root-workspaces',
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
      'root-events',
      'root-filters',
      'root-converters',
      'root-computations',
    ],
  },
  {
    id: 'infrastructure',
    title: 'Инфраструктура',
    rootIds: [
      'root-i18n-bundles',
      'root-auth-profiles',
    ],
  },
  {
    id: 'ui',
    title: 'Интерфейс',
    rootIds: [
      'root-navigations',
      'root-styles',
    ],
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
  if (raw === 'stream' || raw === 'update')
    return raw
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
  if (sectionType === DomainSectionType.Configuration)
    return 'configuration'
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
  /** Store-owned Updates displayed only as children of their owner Store. */
  storeUpdates?: Array<{
    id?: string | number
    identity?: string
    name?: string
    displayName?: string
    storeIdentity?: string
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
  visitedFolderKeys: Set<string> = new Set(),
  traversalPath: string[] = [],
): FsFolderNode {
  const folderId = folder.id ?? folder.identity
  const folderName = folder.name ?? folder.identity ?? String(folderId)
  const folderIdentity = String((folder as any).identity ?? folder.id ?? '')
  const folderKey = getFolderTraversalKey(folder)
  if (visitedFolderKeys.has(folderKey)) {
    console.warn(`[DomainTree] Skipping cyclic folder branch: folder=${String(folderId)}, identity=${folderIdentity}, section=${sectionType}, depth=${traversalPath.length + 1}`)
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
  const { rootToSection, rootOrder, rootLabels, allFolders } = params
  const folders = allFolders
  const rootFolders = folders.filter((f: any) => getFolderParent(f) == null)
  const sectionMapRecord = rootToSection as Record<string, { section: DomainSectionType, items: () => unknown[] }>

  const orderedRoots = rootOrder
    .map((sectionKey) => {
      const folder = rootFolders.find((f: any) => (f.identity ?? f.id) === sectionKey)
      if (folder)
        return { root: { ...folder, name: rootLabels[sectionKey] ?? sectionKey }, sectionKey }
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
    return buildFolderNode(root, sectionType, items, folders, true, isVirtualRoot)
  })

  attachContextualCompositions(tree, params.contextualCompositions ?? [])
  attachStoreUpdates(tree, params.storeUpdates ?? [])
  return tree
}

function attachStoreUpdates(
  tree: FsNode[],
  updates: NonNullable<BuildDomainTreeParams['storeUpdates']>,
): void {
  const root = tree.find(node => node.type === 'folder' && node.id === 'root-stores')
  if (!root)
    return
  const findStore = (nodes: FsNode[], identity: string): FsFileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file' && node.docType === 'store' && node.identity === identity)
        return node
      const nested = findStore(node.children ?? [], identity)
      if (nested)
        return nested
    }
    return null
  }
  for (const update of updates) {
    const owner = findStore(root.children ?? [], String(update.storeIdentity ?? ''))
    if (!owner)
      continue
    const id = String(update.id ?? update.identity ?? '')
    const identity = String(update.identity ?? '')
    ;(owner.children ??= []).push({
      id,
      ...(identity ? { identity } : {}),
      name: update.displayName ?? update.name ?? identity ?? id,
      type: 'file',
      docType: 'update',
      sectionType: DomainSectionType.Store,
    })
  }
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
          : kind === 'local'
            ? ['local']
            : undefined,
      })
    }
  }
}

/** Adds code-owned built-in Types as the first virtual group under Types. */
export function attachResolvedTypeTree(
  tree: FsNode[],
  types: readonly TypeProgramCatalogEntry[],
): void {
  const root = tree.find(node => node.type === 'folder' && node.id === 'root-types') as FsFolderNode | undefined
  if (!root)
    return

  root.children = (root.children ?? []).filter(node =>
    node.identity !== 'types-primitives'
    && node.identity !== 'types-references',
  )

  const builtinTypes = types.filter(type => type.category === 'primitive' || type.category === 'reference')
  if (!builtinTypes.length)
    return

  const createCategory = (
    category: 'primitive' | 'reference',
    name: string,
  ): FsFolderNode => ({
    id: `virtual:types:builtin:${category}`,
    identity: `virtual:types:builtin:${category}`,
    name,
    type: 'folder',
    sectionType: DomainSectionType.Type,
    virtual: true,
    children: builtinTypes
      .filter(type => type.category === category)
      .map((type): FsFileNode => ({
        id: `virtual:builtin:type:${type.identity}`,
        identity: type.identity,
        name: type.displayName,
        type: 'file',
        docType: 'primitive',
        sectionType: DomainSectionType.Type,
        virtual: true,
        origin: { kind: 'builtin', owner: '@endge/core' },
        badges: ['builtin'],
      })),
  })

  root.children.unshift({
    id: 'virtual:types:builtin',
    identity: 'virtual:types:builtin',
    name: 'Built-in',
    type: 'folder',
    sectionType: DomainSectionType.Type,
    virtual: true,
    virtualOrigin: 'builtin',
    children: [
      createCategory('primitive', 'Примитивы'),
      createCategory('reference', 'Ссылки на сущности'),
    ],
  })
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
