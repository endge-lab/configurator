<script setup lang="ts">
import type { DragPayloadItem } from '@/features/endge-ide/model/domain/domain-drag-drop'
import type { DomainDragTreeItem } from '@/features/endge-ide/model/domain/domain-drag-state'
import type { FlatFsItem, FsFileNode, FsFolderNode, FsNode } from '@/features/endge-ide/model/domain/domain-tree'
import type { DomainDocumentType, RCompositionKind } from '@endge/core'

import { ComponentType, DomainSectionType, Endge, QueryType } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import {
  ArrowLeftRight,
  Building2,
  BookOpen,
  Braces,
  Briefcase,
  ChevronsDown,
  ChevronsUp,
  ChevronDown,
  ChevronRight,
  Columns,
  Copy,
  Database,
  Download,
  FileCode2,
  FileWarning,
  Filter,
  Folder,
  FolderPlus,
  FormInput,
  GitBranch,
  KeyRound,
  Layout,
  Languages,
  Loader2,
  Network,
  Palette,
  Pencil,
  Plug,
  Plus,
  Puzzle,
  RotateCcw,
  Route,
  Save,
  Send,
  ServerCog,
  Shield,
  SquareFunction,
  Table2,
  Trash2,
  Type,
  Zap,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getDomainDocumentPresentation,
  getDomainSectionPresentation,
} from '@/features/endge-configurator/model/presentation/domain-document-presentation'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import {
  canHardDelete,
  canRestore,
  canSoftDelete,
  createSubfolder as createDomainSubfolder,
  deleteEntity,
  DROP_TARGET_SOFT_DELETED,
  executeDrop,
  getDropFolderId,
  isFolderInSoftDeletedBranch,
  restoreEntity,
  restoreFolder,
  softDeleteFolder,
} from '@/features/endge-ide/model/domain/domain-drag-drop'
import { clearDomainDrag, setDomainDrag } from '@/features/endge-ide/model/domain/domain-drag-state'
import {
  buildDomainTree,
  getDomainTreeRootBlocks,

  flattenTree,
  getRootFolderOrder,
  getSoftDeletedItems,
  ROOT_FOLDER_LABELS,
  withoutDeleted,
} from '@/features/endge-ide/model/domain/domain-tree'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

const tabs = EndgeIDE.tabs

type MenuAction
  = | { type: 'remove-folder', node: FsFolderNode }
    | { type: 'restore-folder', node: FsFolderNode }
    | { type: 'rename-folder', node: FsFolderNode }
    | { type: 'create-folder', node: FsFolderNode }
    | { type: 'create-doc', node: FsFolderNode }
    | { type: 'create-project-composition', node: FsFileNode }
    | { type: 'remove-doc', node: FsFileNode, permanent?: boolean }
    | { type: 'restore-doc', node: FsFileNode }
    | { type: 'duplicate-doc', node: FsFileNode }
    | { type: 'download-selected' }
    | { type: 'clear-soft-deleted' }

const domainStore = useDomainStore()

/** Id папки «Удалённые» для дерева и пометки сущностей. */
const softDeletedFolderId = computed(() => Endge.domain.getFolderByIdentity('soft-deleted')?.id ?? null)

// ---------- expanded state (persisted) ----------
const expandedKeys = useSafeLocalStorage<Record<string, boolean>>(
  'endge-editor-domain-treeview-expanded',
  {},
)

const expandedFolders = computed<Set<string>>({
  get(): Set<string> {
    const s = new Set<string>()
    for (const [k, v] of Object.entries(expandedKeys.value)) {
      if (v)
        s.add(k)
    }
    return s
  },
  set(next: Set<string>) {
    const obj: Record<string, boolean> = {}
    for (const p of next) obj[p] = true
    expandedKeys.value = obj
  },
})

function toggleFolder(path: string): void {
  const s = new Set(expandedFolders.value)
  if (s.has(path))
    s.delete(path)
  else s.add(path)
  expandedFolders.value = s
}

function folderIsExpanded(path: string): boolean {
  return expandedFolders.value.has(path)
}

// ---------- dialogs ----------
const renameDialog = ref<{
  open: boolean
  folderId: string
  newName: string
}>({
  open: false,
  folderId: '',
  newName: '',
})

// ---------- context menu (single instance) ----------
const contextMenuRef = ref<HTMLElement | null>(null)
const contextMenu = ref<{
  open: boolean
  x: number
  y: number
  node: FsNode | null
  path: string | null
}>({
  open: false,
  x: 0,
  y: 0,
  node: null,
  path: null,
})

function openContextMenu(e: MouseEvent, node: FsNode, path: string): void {
  const folderNode = node.type === 'folder' ? (node as FsFolderNode) : null
  if (folderNode && isSystemTypeFolder(folderNode) && !folderNode.isRoot)
    return
  if (getMenuActions(node, path).length === 0)
    return
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    node,
    path,
  }
}

function closeContextMenu(): void {
  contextMenu.value.open = false
  contextMenu.value.node = null
  contextMenu.value.path = null
}

// close context menu on global scroll/resize for “nice”
function onWindowChange(): void {
  if (contextMenu.value.open)
    closeContextMenu()
}
function onContextMenuClickOutside(e: MouseEvent): void {
  if (contextMenuRef.value?.contains(e.target as Node))
    return
  closeContextMenu()
}

function onContextMenuKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape')
    closeContextMenu()
}

watch(() => contextMenu.value.open, (open) => {
  if (!open) {
    document.removeEventListener('mousedown', onContextMenuClickOutside)
    document.removeEventListener('keydown', onContextMenuKeydown)
    window.removeEventListener('resize', onWindowChange)
    window.removeEventListener('scroll', onWindowChange, true)
    return
  }
  document.addEventListener('mousedown', onContextMenuClickOutside)
  document.addEventListener('keydown', onContextMenuKeydown)
  window.addEventListener('resize', onWindowChange, { passive: true })
  window.addEventListener('scroll', onWindowChange, { passive: true, capture: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onContextMenuClickOutside)
  document.removeEventListener('keydown', onContextMenuKeydown)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})

// ---------- DnD ----------
const dragSources = ref<FsFileNode[]>([])
const dragOverPath = ref<string | null>(null)

function onDragStart(e: DragEvent, item: FlatFsItem): void {
  if (!e.dataTransfer || item.node.type !== 'file')
    return
  const itemKey = getSelectionKey(item)
  const sourceItems = selectedFileIds.value.has(itemKey)
    ? flatFs.value.filter(it => it.node.type === 'file' && selectedFileIds.value.has(getSelectionKey(it)))
    : [item]
  const sources = sourceItems.map(it => it.node as FsFileNode)
  if (
    item.rootId === DROP_TARGET_SOFT_DELETED
    || sources.some(n => n.isInDeletedFolder === true)
  ) {
    dragSources.value = []
    clearDomainDrag()
    e.dataTransfer.effectAllowed = 'none'
    toast.error('Нельзя перетаскивать сущности из «Удалённые»')
    return
  }
  dragSources.value = sources
  e.dataTransfer.effectAllowed = 'copyMove'
  const payload: DragPayloadItem[] = sourceItems.map(it => ({
    id: (it.node as FsFileNode).id,
    identity: (it.node as FsFileNode).identity,
    sectionType: (it.node as FsFileNode).sectionType,
    docType: (it.node as FsFileNode).docType,
    rootId: it.rootId,
  }))
  const json = JSON.stringify(payload)
  e.dataTransfer.setData('text/plain', json)
  e.dataTransfer.setData('application/x-endge-domain-entity', json)

  const tree: DomainDragTreeItem[] = sourceItems.map((it) => {
    const n = it.node as FsFileNode
    const pathSegments = it.path.split('/').filter(Boolean)
    const parentPath = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : null
    const hierarchyNodes = flatFs.value
      .filter(
        f => f.path === it.path || (it.path.startsWith(`${f.path}/`) && f.path.length > 0),
      )
      .sort((a, b) => a.depth - b.depth)
      .map((f) => {
        if (f.node.type === 'folder') {
          const folder = f.node as FsFolderNode
          return {
            path: f.path,
            depth: f.depth,
            type: 'folder' as const,
            id: folder.id,
            name: folder.name ?? folder.id,
            isRoot: folder.isRoot === true,
            folderId: folder.folderId,
          }
        }
        const file = f.node as FsFileNode
        return {
          path: f.path,
          depth: f.depth,
          type: 'file' as const,
          id: file.id,
          identity: file.identity,
          name: file.name ?? file.id,
          sectionType: file.sectionType,
          docType: String(file.docType ?? ''),
        }
      })
    return {
      id: n.id,
      identity: n.identity,
      name: n.name ?? n.id,
      sectionType: n.sectionType,
      docType: String(n.docType ?? ''),
      rootId: it.rootId,
      path: it.path,
      pathSegments,
      depth: it.depth,
      parentPath,
      hierarchy: hierarchyNodes,
    }
  })
  setDomainDrag(sources.map(n => n.sectionType), tree)
}

function onDragOver(e: DragEvent, item: FlatFsItem): void {
  if (item.node.type !== 'folder')
    return
  const folderNode = item.node as FsFolderNode
  if (isSystemTypeFolder(folderNode) && !folderNode.isRoot)
    return
  e.preventDefault()
  if (e.dataTransfer)
    e.dataTransfer.dropEffect = 'move'
  dragOverPath.value = item.path
}

function onDragLeave(item: FlatFsItem): void {
  if (dragOverPath.value === item.path)
    dragOverPath.value = null
}

function clearDragSources(): void {
  dragSources.value = []
  clearDomainDrag()
}

async function onDrop(e: DragEvent, item: FlatFsItem): Promise<void> {
  e.preventDefault()
  const dropNode = item.node
  if (dropNode.type !== 'folder')
    return
  const folderNode = dropNode as FsFolderNode
  if (isSystemTypeFolder(folderNode) && !folderNode.isRoot) {
    dragSources.value = []
    dragOverPath.value = null
    clearDomainDrag()
    toast.error('Системные папки типов недоступны для перетаскивания')
    return
  }

  let payload: DragPayloadItem[] = []
  try {
    const raw = e.dataTransfer?.getData('text/plain')
    if (raw)
      payload = JSON.parse(raw)
  }
  catch { /* ignore */ }
  if (!payload.length) {
    dragSources.value = []
    dragOverPath.value = null
    return
  }

  dragSources.value = []
  dragOverPath.value = null

  const dropTarget = {
    targetRootId: item.rootId,
    dropFolderId: getDropFolderId(folderNode),
  }

  const result = await EndgeIDE.runBusy(executeDrop(payload, dropTarget))

  Endge.domain.notify()

  if (result.errors.length) {
    result.errors.forEach(msg => toast.error(msg))
  }
  if (payload.length > 1) {
    if (result.moved && result.skipped)
      toast.success(`Перенесено: ${result.moved}`, { description: `Не перенесено: ${result.skipped}` })
    else if (result.moved)
      toast.success(`Перенесено: ${result.moved}`)
    else if (result.skipped && !result.errors.length)
      toast.info('Ничего не перенесено', { description: `Не подходят правила для выбранных сущностей (${result.skipped})` })
  }
}

/** Маппинг: identity корневой папки — секция и активные документы домена. */
const ROOT_TO_SECTION = computed(() => {
  const softId = softDeletedFolderId.value
  const compositions = withoutDeleted((Endge.domain as any).getCompositions?.() ?? [], softId)
  return {
    'root-types': { section: DomainSectionType.Type, items: () => withoutDeleted([...(domainStore.typesPrimitives ?? []), ...(domainStore.typesComplex ?? [])], softId) },
    'root-queries': {
      section: DomainSectionType.Query,
      items: () => withoutDeleted(domainStore.queries, softId),
    },
    'root-data-views': { section: DomainSectionType.DataView, items: () => withoutDeleted((Endge.domain as any).getDataViews?.() ?? [], softId) },
    'root-compositions': {
      section: DomainSectionType.Composition,
      items: () => compositions.filter(composition => String(composition.kind ?? 'library') === 'library'),
    },
    'root-stores': { section: DomainSectionType.Store, items: () => withoutDeleted((Endge.domain as any).getStores?.() ?? [], softId) },
    'root-components': { section: DomainSectionType.Component, items: () => withoutDeleted([...domainStore.components, ...((Endge.domain as any).getComponentSFCs?.() ?? [])], softId) },
    'root-actions': { section: DomainSectionType.Action, items: () => withoutDeleted(domainStore.actions, softId) },
    'root-filters': { section: DomainSectionType.Filters, items: () => withoutDeleted(domainStore.filters, softId) },
    'root-converters': { section: DomainSectionType.Converter, items: () => withoutDeleted(domainStore.converters, softId) },
    'root-computations': { section: DomainSectionType.Computation, items: () => withoutDeleted(Endge.domain.getComputations(), softId) },
    'root-parameters': { section: DomainSectionType.Parameters, items: () => withoutDeleted(domainStore.parameters, softId) },
    'root-integrations': { section: DomainSectionType.Integration, items: () => withoutDeleted(domainStore.integrations, softId) },
    'root-environments': { section: DomainSectionType.Environment, items: () => withoutDeleted(domainStore.environments, softId) },
    'root-tenants': { section: DomainSectionType.Tenant, items: () => withoutDeleted(domainStore.tenants, softId) },
    'root-policies': { section: DomainSectionType.Policy, items: () => withoutDeleted(domainStore.policies, softId) },
    'root-styles': { section: DomainSectionType.Style, items: () => withoutDeleted(domainStore.styles, softId) },
    'root-page-templates': { section: DomainSectionType.PageTemplate, items: () => withoutDeleted(domainStore.pageTemplates, softId) },
    'root-pages': { section: DomainSectionType.Page, items: () => withoutDeleted(domainStore.pages, softId) },
    'root-navigations': { section: DomainSectionType.Navigation, items: () => withoutDeleted(domainStore.navigations, softId) },
    'root-vocabs': { section: DomainSectionType.Vocabs, items: () => withoutDeleted(domainStore.vocabs, softId) },
    'root-mocks': { section: DomainSectionType.Mock, items: () => withoutDeleted(domainStore.mocks, softId) },
    'root-i18n-bundles': { section: DomainSectionType.I18nBundles, items: () => withoutDeleted(domainStore.i18nBundles, softId) },
    'root-auth-profiles': { section: DomainSectionType.AuthProfile, items: () => withoutDeleted(domainStore.authProfiles, softId) },
    'root-projects': { section: DomainSectionType.Project, items: () => withoutDeleted(domainStore.projects, softId) },
    'soft-deleted': {
      section: DomainSectionType.Parameters,
      items: () => getSoftDeletedItems({
        ...(domainStore as any),
        dataViews: (Endge.domain as any).getDataViews?.() ?? [],
        stores: (Endge.domain as any).getStores?.() ?? [],
        mocks: Endge.domain.getMocks(),
        computations: Endge.domain.getComputations(),
      }, softId, (domainStore.folders as any[]) ?? []),
    },
  }
})

/** Порядок корневых папок. */
const ROOT_FOLDER_ORDER = computed(() => getRootFolderOrder(Object.keys(ROOT_TO_SECTION.value)))

const ROOT_BLOCKS = computed(() => getDomainTreeRootBlocks(ROOT_FOLDER_ORDER.value))

const DOMAIN_ICON_COMPONENTS: Record<string, any> = {
  ArrowLeftRight,
  BookOpen,
  Braces,
  Briefcase,
  Building2,
  Columns,
  Database,
  FileCode2,
  FileWarning,
  Filter,
  FormInput,
  GitBranch,
  KeyRound,
  Languages,
  Layout,
  Network,
  Palette,
  Plug,
  Puzzle,
  Route,
  Send,
  ServerCog,
  Shield,
  SquareFunction,
  Table2,
  Type,
  Zap,
}

function createSectionPresentation(sectionType: DomainSectionType): { icon: any, colorClass: string } {
  const presentation = getDomainSectionPresentation(sectionType)
  return {
    icon: DOMAIN_ICON_COMPONENTS[presentation.icon] ?? FileWarning,
    colorClass: presentation.colorClass,
  }
}

/** Иконка и цвет для корневых папок (типы, запросы, компоненты и т.д.). */
const ROOT_FOLDER_ICONS: Record<string, { icon: any, colorClass: string }> = {
  'root-types': createSectionPresentation(DomainSectionType.Type),
  'root-queries': createSectionPresentation(DomainSectionType.Query),
  'root-data-views': createSectionPresentation(DomainSectionType.DataView),
  'root-compositions': createSectionPresentation(DomainSectionType.Composition),
  'root-stores': createSectionPresentation(DomainSectionType.Store),
  'root-components': createSectionPresentation(DomainSectionType.Component),
  'root-actions': createSectionPresentation(DomainSectionType.Action),
  'root-parameters': createSectionPresentation(DomainSectionType.Parameters),
  'root-converters': createSectionPresentation(DomainSectionType.Converter),
  'root-computations': createSectionPresentation(DomainSectionType.Computation),
  'root-integrations': createSectionPresentation(DomainSectionType.Integration),
  'root-filters': createSectionPresentation(DomainSectionType.Filters),
  'root-environments': createSectionPresentation(DomainSectionType.Environment),
  'root-tenants': createSectionPresentation(DomainSectionType.Tenant),
  'root-policies': createSectionPresentation(DomainSectionType.Policy),
  'root-styles': createSectionPresentation(DomainSectionType.Style),
  'root-page-templates': createSectionPresentation(DomainSectionType.PageTemplate),
  'root-pages': createSectionPresentation(DomainSectionType.Page),
  'root-navigations': createSectionPresentation(DomainSectionType.Navigation),
  'root-vocabs': createSectionPresentation(DomainSectionType.Vocabs),
  'root-mocks': createSectionPresentation(DomainSectionType.Mock),
  'root-i18n-bundles': createSectionPresentation(DomainSectionType.I18nBundles),
  'root-auth-profiles': createSectionPresentation(DomainSectionType.AuthProfile),
  'root-projects': createSectionPresentation(DomainSectionType.Project),
  'soft-deleted': { icon: Trash2, colorClass: 'text-muted-foreground' },
}

/** Типы документов, которые можно дублировать (те же, что в «Создать»). */
const DUPLICATABLE_DOC_TYPES = new Set<DomainDocumentType>([
  ComponentType.DSL,
  ComponentType.Table,
  COMPONENT_SFC_TYPE,
  QueryType.REST,
  'data-view',
  'composition',
  'store',
  'mock',
  'action',
  'computation',
  'integration',
  'environment',
  'tenant',
  'policy',
  'style',
  'page-template',
  'page',
  'navigation',
  'vocabs',
  'i18n-bundles',
  'auth-profile',
])

const SYSTEM_TYPE_FOLDER_IDENTITIES = new Set([
  'types-primitives',
  'types-references',
])

function isSystemTypeFolder(node: FsFolderNode): boolean {
  return node.isSystem === true || SYSTEM_TYPE_FOLDER_IDENTITIES.has(String(node.identity ?? ''))
}

function getFolderIcon(node: FsFolderNode): any {
  if (node.isRoot && node.id in ROOT_FOLDER_ICONS)
    return ROOT_FOLDER_ICONS[node.id]?.icon
  return Folder
}

function getFolderColorClass(node: FsFolderNode): string {
  if (node.isRoot && node.id in ROOT_FOLDER_ICONS)
    return ROOT_FOLDER_ICONS[node.id]?.colorClass ?? 'text-yellow-500'
  return 'text-yellow-500'
}

function getTreeDocumentIconClass(node: FsFileNode): string[] {
  const iconClass = EndgeIDE.tabs.getDocumentIcon(node.docType, node.presentationKind)
    .split(/\s+/)
    .filter(token => token && !token.startsWith('text-') && !token.startsWith('dark:text-'))
  const colorClass = getDomainDocumentPresentation(node.docType, node.presentationKind).colorClass
  return [...iconClass, colorClass, 'text-base']
}

function getRootDocumentIcon(node: FsFileNode): any | null {
  const presentation = getDomainDocumentPresentation(node.docType, node.presentationKind)
  return DOMAIN_ICON_COMPONENTS[presentation.icon] ?? FileWarning
}

function getRootDocumentIconColor(node: FsFileNode): string {
  return getDomainDocumentPresentation(node.docType, node.presentationKind).colorClass
}

function getRootDocumentBadgeIcon(node: FsFileNode): any | null {
  const badgeIcon = getDomainDocumentPresentation(node.docType, node.presentationKind).badgeIcon
  return badgeIcon == null ? null : DOMAIN_ICON_COMPONENTS[badgeIcon] ?? null
}

// ---------- дерево ----------
const fsTree = computed<FsNode[]>(() => {
  const allFolders = Array.isArray(domainStore.folders) ? domainStore.folders : []
  const tree = buildDomainTree({
    rootToSection: ROOT_TO_SECTION.value,
    rootOrder: ROOT_FOLDER_ORDER.value,
    rootLabels: ROOT_FOLDER_LABELS,
    allFolders,
    softDeletedFolderId: softDeletedFolderId.value,
    contextualCompositions: withoutDeleted(
      (Endge.domain as any).getCompositions?.() ?? [],
      softDeletedFolderId.value,
    ).filter(composition => String(composition.kind ?? 'library') !== 'library') as Array<{
      id?: string | number
      identity?: string
      name?: string
      displayName?: string
      kind?: RCompositionKind
      kindIdentity?: string | null
      folderId?: string | number | null
    }>,
  })

  return tree
})

const flatFs = computed<FlatFsItem[]>(() =>
  flattenTree(fsTree.value, expandedFolders.value),
)

const groupedFlatFs = computed(() =>
  ROOT_BLOCKS.value
    .map(block => ({
      ...block,
      items: flatFs.value.filter(item => block.rootIds.includes(item.rootId)),
    }))
    .filter(block => block.items.length > 0),
)

function collectExpandablePaths(items: FsNode[], parentPath = ''): string[] {
  const out: string[] = []
  for (const node of items) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name
    if (node.type === 'folder' && node.children?.length) {
      out.push(path)
      out.push(...collectExpandablePaths(node.children, path))
    }
    else if (node.type === 'file') {
      const fileNode = node as FsFileNode
      if (fileNode.children?.length) {
        out.push(path)
        out.push(...collectExpandablePaths(fileNode.children, path))
      }
    }
  }
  return out
}

const allExpandablePaths = computed(() => collectExpandablePaths(fsTree.value))

function expandAll(): void {
  expandedFolders.value = new Set(allExpandablePaths.value)
}

function collapseAll(): void {
  expandedFolders.value = new Set()
}

// ---------- выделение (множественное: Ctrl/Meta, диапазон: Shift) ----------
/** Ключ выделения: путь в дереве (уникален для узла), чтобы одна identity в разных видах не давала коллизию. */
function getSelectionKey(item: FlatFsItem): string {
  if (item.node.type !== 'file')
    return ''
  return item.path
}

const selectedFileIds = ref<Set<string>>(new Set())
const lastClickedPath = ref<string | null>(null)

const selectedExportNodes = computed<FsFileNode[]>(() =>
  flattenTree(fsTree.value, new Set(allExpandablePaths.value))
    .filter(item => item.node.type === 'file'
      && !(item.node as FsFileNode).isTableColumn
      && selectedFileIds.value.has(getSelectionKey(item)))
    .map(item => item.node as FsFileNode),
)

function getFileItemsInRoot(rootId: string): FlatFsItem[] {
  return flatFs.value.filter(it => it.node.type === 'file' && it.rootId === rootId)
}

function selectRange(anchorPath: string, targetPath: string, rootId: string): void {
  const fileItems = getFileItemsInRoot(rootId)
  const paths = fileItems.map(it => it.path)
  const i = paths.indexOf(anchorPath)
  const j = paths.indexOf(targetPath)
  if (i === -1 || j === -1)
    return
  const [lo, hi] = i <= j ? [i, j] : [j, i]
  const next = new Set(selectedFileIds.value)
  for (let k = lo; k <= hi; k++) {
    const fi = fileItems[k]
    const key = fi ? getSelectionKey(fi) : ''
    if (key)
      next.add(key)
  }
  selectedFileIds.value = next
}

function onRowClick(e: MouseEvent, item: FlatFsItem): void {
  closeContextMenu()

  if (item.node.type === 'folder') {
    toggleFolder(item.path)
    return
  }

  const node = item.node as FsFileNode
  const isShift = (e as MouseEvent & { shiftKey?: boolean }).shiftKey
  const isMulti = (e as MouseEvent & { ctrlKey?: boolean, metaKey?: boolean }).ctrlKey || (e as MouseEvent & { metaKey?: boolean }).metaKey

  if (isShift && lastClickedPath.value) {
    const anchorItem = flatFs.value.find(f => f.path === lastClickedPath.value)
    const anchorRootId = anchorItem?.rootId ?? item.rootId
    selectRange(lastClickedPath.value, item.path, anchorRootId)
    return
  }
  if (isMulti) {
    const next = new Set(selectedFileIds.value)
    const key = getSelectionKey(item)
    if (key) {
      if (next.has(key))
        next.delete(key)
      else next.add(key)
    }
    selectedFileIds.value = next
    lastClickedPath.value = item.path
    return
  }

  selectedFileIds.value = getSelectionKey(item) ? new Set([getSelectionKey(item)]) : new Set()
  lastClickedPath.value = item.path

  if (node.docType === 'primitive') {
    toast.info('Это примитивный тип', {
      description: 'Редактор примитивов не доступен.',
    })
    return
  }
  const targetId = node.isTableColumn && node.parentComponentId ? node.parentComponentId : node.id
  if (targetId == null || String(targetId).trim() === '') {
    toast.warning('Нет идентификатора документа')
    return
  }
  if (node.sectionType === DomainSectionType.Project) {
    EndgeIDE.tabs.openDocument(String(targetId), 'project')
    return
  }
  EndgeIDE.tabs.openDocument(targetId, node.docType)
}

function isSelected(item: FlatFsItem): boolean {
  return item.node.type === 'file' && selectedFileIds.value.has(getSelectionKey(item))
}

// ---------- actions ----------
async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

/** Закрывает вкладку документа, если она открыта. */
function closeDocumentTabIfOpen(id: string, docType: DomainDocumentType): void {
  tabs.closeTab(`${docType}-${id}`)
}

async function removeDocument(node: FsFileNode, permanent = false): Promise<void> {
  try {
    const result = await deleteEntity(node, permanent)
    closeDocumentTabIfOpen(node.id, node.docType)
    result.deletedDocs.forEach(doc => closeDocumentTabIfOpen(doc.id, doc.docType))
    toast.success(permanent ? 'Документ удалён навсегда' : 'Документ перемещён в «Удалённые»')
  }
  catch (e) {
    console.error(e)
    toast.error('Не удалось удалить', { description: (e as Error)?.message })
  }
}

async function restoreDocument(node: FsFileNode): Promise<void> {
  try {
    await restoreEntity(node)
    toast.success('Документ восстановлен')
  }
  catch (e) {
    console.error(e)
    toast.error('Не удалось восстановить', { description: (e as Error)?.message })
  }
}

async function createSubfolderUi(targetFolder: FsFolderNode, targetPath: string): Promise<void> {
  try {
    await createDomainSubfolder(targetFolder)
    toast.success('Папка создана')
  }
  catch (e) {
    console.error('[Domain_Widget] Ошибка сохранения папки в Payload:', e)
    toast.error('Не удалось создать папку', { description: (e as Error)?.message })
  }

  const s = new Set(expandedFolders.value)
  s.add(targetPath)
  expandedFolders.value = s
}

async function removeFolder(node: FsFolderNode): Promise<void> {
  try {
    await softDeleteFolder(node)
    toast.success('Папка перемещена в «Удалённые»')
  }
  catch (e) {
    console.error('[Domain_Widget] Ошибка удаления папки:', e)
    toast.error('Не удалось удалить папку', { description: (e as Error)?.message })
  }
}

async function restoreFolderFromTrash(node: FsFolderNode): Promise<void> {
  try {
    await restoreFolder(node)
    toast.success('Папка восстановлена')
  }
  catch (e) {
    console.error('[Domain_Widget] Ошибка восстановления папки:', e)
    toast.error('Не удалось восстановить папку', { description: (e as Error)?.message })
  }
}

function openRenameDialog(node: FsFolderNode): void {
  if (!node.folderId)
    return
  renameDialog.value.folderId = String(node.folderId)
  renameDialog.value.newName = node.name
  renameDialog.value.open = true
}

async function confirmRename(): Promise<void> {
  const folder = Endge.domain.getFolder(renameDialog.value.folderId)
  if (!folder)
    return
  const newName = renameDialog.value.newName.trim()
  if (!newName) {
    toast.error('Введите название папки')
    return
  }
  folder.name = newName
  folder.displayName = newName
  renameDialog.value.open = false
  try {
    await Endge.schema.saveFolder(String(renameDialog.value.folderId))
    toast.success('Папка переименована')
  }
  catch (e) {
    console.error('[Domain_Widget] Ошибка сохранения переименования папки:', e)
    toast.error('Не удалось переименовать папку', { description: (e as Error)?.message })
  }
  Endge.domain.notify()
}

async function downloadSelectedDocuments(): Promise<void> {
  try {
    await Endge.downloadSelected(selectedExportNodes.value.map(node => ({
      id: node.id,
      identity: node.identity,
      sectionType: node.sectionType,
      docType: node.docType,
    })))
    toast.success(`Скачано сущностей: ${selectedExportNodes.value.length}`)
  }
  catch (error) {
    console.error('[Domain_Widget] Не удалось скачать выбранные сущности:', error)
    toast.error('Не удалось скачать выбранные сущности', { description: (error as Error)?.message })
  }
}

// ---------- context menu items ----------
/** Формирует контекстные действия для узла дерева домена. */
function getMenuActions(node: FsNode, path?: string | null): Array<{ label: string, icon: any, action: MenuAction, destructive?: boolean }> {
  const items: Array<{ label: string, icon: any, action: MenuAction, destructive?: boolean }> = []

  if (node.type === 'folder') {
    const isRoot = node.isRoot === true
    if (isSystemTypeFolder(node) && !isRoot)
      return items

    const isSoftDeletedRoot = isRoot && node.id === 'soft-deleted'
    const isInSoftDeletedBranch = !isRoot && node.folderId != null && isFolderInSoftDeletedBranch(node.folderId)

    if (isSoftDeletedRoot) {
      items.push({
        label: 'Очистить все',
        icon: Trash2,
        destructive: true,
        action: { type: 'clear-soft-deleted' },
      })
    }

    if (!isRoot && node.folderId) {
      if (isInSoftDeletedBranch) {
        items.push({
          label: 'Восстановить папку',
          icon: RotateCcw,
          action: { type: 'restore-folder', node },
        })
      }
      else {
        items.push({
          label: 'Удалить папку',
          icon: Trash2,
          destructive: true,
          action: { type: 'remove-folder', node },
        })
        items.push({
          label: 'Переименовать',
          icon: Pencil,
          action: { type: 'rename-folder', node },
        })
      }
    }

    if (!isSoftDeletedRoot && !isInSoftDeletedBranch) {
      items.push({
        label: 'Создать папку',
        icon: FolderPlus,
        action: { type: 'create-folder', node },
      })
      items.push({
        label: 'Добавить сущность',
        icon: Plus,
        action: { type: 'create-doc', node },
      })
    }
  }
  else {
    const fileNode = node as FsFileNode
    if (fileNode.isTableColumn)
      return items

    if (path && selectedFileIds.value.has(path) && selectedExportNodes.value.length > 1) {
      items.push({
        label: `Скачать выбранные (${selectedExportNodes.value.length})`,
        icon: Download,
        action: { type: 'download-selected' },
      })
    }

    const isSystemDoc = fileNode.isSystem === true
    const isInDeleted = fileNode.isInDeletedFolder === true
    const canRestoreDoc = canRestore(fileNode.docType)
    const canSoftDeleteDoc = canSoftDelete(fileNode.sectionType, fileNode.docType)
    const canHardDeleteDoc = canHardDelete(fileNode.docType)

    if (!isSystemDoc && !isInDeleted && fileNode.sectionType === DomainSectionType.Project) {
      items.push({
        label: 'Создать композицию',
        icon: Network,
        action: { type: 'create-project-composition', node: fileNode },
      })
    }

    if (isInDeleted && canRestoreDoc) {
      items.push({
        label: 'Восстановить',
        icon: RotateCcw,
        action: { type: 'restore-doc', node },
      })
    }

    if (!isSystemDoc && !isInDeleted && DUPLICATABLE_DOC_TYPES.has(fileNode.docType)) {
      items.push({
        label: 'Дублировать',
        icon: Copy,
        action: { type: 'duplicate-doc', node },
      })
    }

    if (!isSystemDoc && ((!isInDeleted && canSoftDeleteDoc) || (isInDeleted && canHardDeleteDoc))) {
      items.push({
        label: isInDeleted ? 'Удалить навсегда' : 'Удалить',
        icon: Trash2,
        destructive: true,
        action: { type: 'remove-doc', node, permanent: isInDeleted },
      })
    }
  }

  return items
}

async function runMenuAction(a: MenuAction, ctxPath: string | null): Promise<void> {
  if (a.type === 'remove-folder') {
    await EndgeIDE.runBusy(removeFolder(a.node))
    return
  }

  if (a.type === 'restore-folder') {
    await EndgeIDE.runBusy(restoreFolderFromTrash(a.node))
    return
  }

  if (a.type === 'rename-folder') {
    openRenameDialog(a.node)
    return
  }

  if (a.type === 'create-folder') {
    if (!ctxPath)
      return
    await EndgeIDE.runBusy(createSubfolderUi(a.node, ctxPath))
    return
  }

  if (a.type === 'create-doc') {
    closeContextMenu()
    EndgeIDE.modals.openCreateDocument({
      sectionType: a.node.sectionType,
      folderId: a.node.isRoot ? undefined : (a.node.folderId ?? undefined),
    })
    return
  }

  if (a.type === 'create-project-composition') {
    const projectIdentity = String(a.node.identity ?? a.node.id ?? '').trim()
    if (!projectIdentity) {
      toast.error('Не удалось определить identity проекта')
      return
    }
    closeContextMenu()
    EndgeIDE.modals.openCreateDocument({
      sectionType: DomainSectionType.Composition,
      documentType: 'composition',
      compositionOwner: {
        kind: 'project',
        identity: projectIdentity,
        displayName: a.node.name,
      },
    })
    return
  }

  if (a.type === 'remove-doc') {
    await EndgeIDE.runBusy(removeDocument(a.node, a.permanent))
    return
  }

  if (a.type === 'restore-doc') {
    await EndgeIDE.runBusy(restoreDocument(a.node))
    return
  }

  if (a.type === 'duplicate-doc') {
    closeContextMenu()
    EndgeIDE.modals.openDuplicateDocument({
      id: a.node.id,
      docType: a.node.docType,
      name: a.node.name ?? a.node.id,
    })
    return
  }

  if (a.type === 'download-selected') {
    await downloadSelectedDocuments()
    return
  }

  if (a.type === 'clear-soft-deleted') {
    EndgeIDE.modals.openClearSoftDeleted()
  }
}

// ---------- ui helpers ----------
function rowPaddingStyle(depth: number, isNestedEntity = false): Record<string, string> {
  const base = isNestedEntity ? (depth - 1) * 12 + 4 : depth * 12
  return { paddingLeft: `${base + (isNestedEntity ? 6 : 0)}px` }
}

function rowClasses(item: FlatFsItem): string {
  const isOver = dragOverPath.value === item.path && item.node.type === 'folder'
  const selected = isSelected(item)
  const isMutedSystemFolder
    = item.node.type === 'folder'
      && isSystemTypeFolder(item.node as FsFolderNode)
      && (item.node as FsFolderNode).isRoot !== true
  return [
    'flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer select-none',
    isMutedSystemFolder ? 'text-slate-600' : 'text-foreground dark:text-[oklch(0.89_0_0)] hover:bg-primary/30',
    selected ? 'bg-primary/30 ring-1 ring-secondary/70' : '',
    isOver ? 'bg-primary/30 ring-1 ring-primary/70' : '',
  ].filter(Boolean).join(' ')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- header tools -->
    <div class="rounded-none border-x-0 border-t-0 shrink-0">
      <div class="px-2 py-1 flex items-center justify-between gap-1">
        <TooltipProvider :delay-duration="150">
          <div class="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-7" @click="() => Endge.download()">
                  <Download class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Скачать JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-7" :disabled="EndgeIDE.busy.value" @click="save">
                  <Loader2 v-if="EndgeIDE.busy.value" class="size-3.5 animate-spin" />
                  <Save v-else class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Сохранить</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-7" @click="expandAll">
                  <ChevronsDown class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Развернуть все блоки</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-7" @click="collapseAll">
                  <ChevronsUp class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Свернуть все блоки</TooltipContent>
            </Tooltip>
          </div>

          <div class="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" class="size-7" @click="EndgeIDE.modals.openCreateDocument()">
                  <Plus class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Создать</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>

    <!-- tree -->
    <div class="flex-1 min-h-0" @click="closeContextMenu">
      <ScrollArea class="h-full">
        <div class="p-2 text-sm">
          <div
            v-for="block in groupedFlatFs"
            :key="block.id"
            class="mb-3 last:mb-0"
            :class="block.className"
          >
            <div
              v-if="block.showTitle !== false"
              class="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80"
            >
              {{ block.title }}
            </div>

            <div
              v-for="it in block.items"
              :key="it.path"
              :class="rowClasses(it)"
              :style="rowPaddingStyle(it.depth, (it.node as FsFileNode).isTableColumn)"
              :draggable="it.node.type === 'file' && !(it.node as FsFileNode).isTableColumn"
              @click.stop="(ev: MouseEvent) => onRowClick(ev, it)"
              @contextmenu="(e) => openContextMenu(e, it.node, it.path)"
              @dragstart="(e) => onDragStart(e, it)"
              @dragend="clearDragSources()"
              @dragover="(e) => onDragOver(e, it)"
              @dragleave="() => onDragLeave(it)"
              @drop="(e) => onDrop(e, it)"
            >
              <template v-if="it.node.type === 'folder'">
                <ChevronDown v-if="folderIsExpanded(it.path)" class="size-4 shrink-0" />
                <ChevronRight v-else class="size-4 shrink-0" />
                <component
                  :is="getFolderIcon(it.node)"
                  class="size-4 shrink-0"
                  :class="getFolderColorClass(it.node)"
                />
              </template>

              <template v-else>
                <ChevronDown
                  v-if="(it.node as FsFileNode).children?.length && folderIsExpanded(it.path)"
                  class="size-4 shrink-0"
                  @click.stop="toggleFolder(it.path)"
                />
                <ChevronRight
                  v-else-if="(it.node as FsFileNode).children?.length"
                  class="size-4 shrink-0"
                  @click.stop="toggleFolder(it.path)"
                />
                <span v-else class="size-4 shrink-0 ml-1 inline-block" />
                <Columns
                  v-if="(it.node as FsFileNode).isTableColumn"
                  class="size-4 shrink-0 text-sky-500 mr-1"
                />
                <span
                  v-else-if="getRootDocumentIcon(it.node as FsFileNode)"
                  class="relative size-4 shrink-0"
                >
                  <component
                    :is="getRootDocumentIcon(it.node as FsFileNode)"
                    class="size-4"
                    :class="getRootDocumentIconColor(it.node as FsFileNode)"
                  />
                  <component
                    :is="getRootDocumentBadgeIcon(it.node as FsFileNode)"
                    v-if="getRootDocumentBadgeIcon(it.node as FsFileNode)"
                    class="absolute -bottom-1 -right-1 size-2.5 rounded-[2px] bg-background p-px"
                    :class="getRootDocumentIconColor(it.node as FsFileNode)"
                  />
                </span>
                <i
                  v-else
                  :class="getTreeDocumentIconClass(it.node as FsFileNode)"
                  class="shrink-0"
                />
              </template>

              <span class="truncate">{{ it.node.name }}</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>

    <!-- context menu (fixed по координатам курсора, закрытие по клику снаружи) -->
    <Teleport to="body">
      <div
        v-if="contextMenu.open && contextMenu.node"
        ref="contextMenuRef"
        role="menu"
        class="z-50 min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        :style="{
          position: 'fixed',
          left: `${contextMenu.x}px`,
          top: `${contextMenu.y}px`,
        }"
        @click.stop
      >
        <button
          v-for="(mi, idx) in getMenuActions(contextMenu.node, contextMenu.path)"
          :key="idx"
          type="button"
          role="menuitem"
          class="flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground" :class="[
            mi.destructive ? 'text-destructive focus:text-destructive' : '',
          ]"
          @click="async () => { await runMenuAction(mi.action, contextMenu.path); closeContextMenu() }"
        >
          <component :is="mi.icon" class="mr-2 size-4 shrink-0" />
          <span>{{ mi.label }}</span>
        </button>
      </div>
    </Teleport>

    <!-- rename folder dialog -->
    <Dialog v-model:open="renameDialog.open">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Переименовать папку</DialogTitle>
        </DialogHeader>

        <div class="space-y-2 py-2">
          <div class="text-sm text-muted-foreground">
            Новое название папки:
          </div>
          <Input v-model="renameDialog.newName" placeholder="Введите новое название" />
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" @click="renameDialog.open = false">
            Отменить
          </Button>
          <Button @click="() => EndgeIDE.runBusy(confirmRename())">
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
