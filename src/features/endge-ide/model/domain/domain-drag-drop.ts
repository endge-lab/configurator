/**
 * Единый модуль операций над доменным деревом в Domain Widget.
 *
 * В модуле собраны все ключевые сценарии:
 * - создание и рекурсивное удаление папок;
 * - удаление сущностей;
 * - перенос папок и сущностей внутри доменного дерева (drag-and-drop).
 */

import type { DomainDocumentType } from '@endge/core'
import type { FsFileNode, FsFolderNode } from './domain-tree'

import {
  ComponentType,
  DomainSectionType,
  Endge,
  FilterType,
  isExternallyManaged,
  ParameterType,
  QueryType,
  RFolder,
} from '@endge/core'
import { randomString } from '@endge/utils'

import {
  COMPOSITION_ROOT_IDENTITY,
  getCompositionRootFolderId,
  getQueryRootFolderId,
  QUERY_ROOT_IDENTITY,
  setQueryCompositionRole,
} from './query-composition-presentation'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

/** Элемент payload при перетаскивании сущности. */
export interface DragPayloadItem {
  kind?: 'document'
  id: string
  identity?: string
  sectionType: DomainSectionType
  docType: DomainDocumentType
  rootId: string
}

/** Элемент payload при перетаскивании persisted-папки вместе с её веткой. */
export interface FolderDragPayloadItem {
  kind: 'folder'
  id: string
  identity?: string
  sectionType: DomainSectionType
  rootId: string
}

export type DomainDragPayloadItem = DragPayloadItem | FolderDragPayloadItem

/** Цель drop-операции. */
export interface DropTarget {
  targetRootId: string
  /** Id папки назначения или `null`, если drop в корень секции. */
  dropFolderId: string | number | null
}

/** Итог обработки drop-операции. */
export interface DropResult {
  moved: number
  skipped: number
  errors: string[]
}

/** Документ, физически удалённый из домена (для закрытия вкладок и UI-очистки). */
export interface DeletedDocumentRef {
  id: string
  docType: DomainDocumentType
}

/** Итог операции удаления сущности. */
export interface DeleteEntityResult {
  mode: 'soft' | 'hard'
  deletedDocs: DeletedDocumentRef[]
}

/** Снимок реальных папок и документов, которые входят в удаляемую ветку. */
export interface FolderDeletionPlan {
  root: FsFolderNode
  folders: FsFolderNode[]
  entities: FsFileNode[]
}

/** Результат рекурсивного удаления папки. */
export interface FolderDeletionResult {
  folderCount: number
  entityCount: number
  deletedEntities: FsFileNode[]
  failedEntities: Array<{ node: FsFileNode, error: Error }>
  deletedFolders: FsFolderNode[]
  failedFolders: Array<{ node: FsFolderNode, error: Error }>
}

const BASE_DELETABLE_DOCUMENT_TYPES = new Set<DomainDocumentType>([
  ComponentType.Table,
  ComponentType.DSL,
  COMPONENT_SFC_TYPE,
  QueryType.REST,
  QueryType.GraphQL,
  QueryType.Custom,
  'data-view',
  'composition',
  'store',
  'stream',
  'update',
  'mock',
  'computation',
  ParameterType.DefaultParameter,
  FilterType.DefaultFilter as DomainDocumentType,
  'type',
  'primitive',
  'project',
])

const DELETABLE_DOCUMENT_TYPES = new Set<DomainDocumentType>([
  ...BASE_DELETABLE_DOCUMENT_TYPES,
  'action',
  'converter',
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

/**
 * Проверяет, можно ли удалить сущность через backend API.
 */
export function canDelete(_sectionType: DomainSectionType, docType?: DomainDocumentType): boolean {
  if (docType) {
    return DELETABLE_DOCUMENT_TYPES.has(docType)
  }
  return true
}

/**
 * Возвращает id папки-назначения при drop в узел дерева.
 */
export function getDropFolderId(dropNode: FsFolderNode): string | number | null {
  return dropNode.isRoot ? null : (dropNode.folderId ?? null)
}

function isManagedFolderNode(node: FsFolderNode): boolean {
  return isExternallyManaged(node)
}

/**
 * Создаёт подпапку в указанной папке/корне и сохраняет её в Payload.
 * В корневой (в т.ч. системной) папке создание дочерней разрешено — мы только задаём parent.
 */
export async function createSubfolder(targetFolder: FsFolderNode, name: string): Promise<RFolder> {
  if (targetFolder.sectionType === DomainSectionType.Integration) {
    throw new Error('Глобальный реестр интеграций не поддерживает папки')
  }
  if (isManagedFolderNode(targetFolder) && !targetFolder.isRoot) {
    throw new Error('Управляемая извне папка недоступна для редактирования')
  }

  const folderName = name.trim()
  if (!folderName) {
    throw new Error('Введите название папки')
  }

  const parentId = resolveParentIdForNewFolder(targetFolder)
  const parentFolder = parentId == null ? null : Endge.domain.getFolder(parentId)
  const entityType = String(parentFolder?.entityType ?? '').trim()
  if (!entityType) {
    throw new Error('Не удалось определить тип сущностей для новой папки')
  }

  let newId = `folder-${randomString(5)}`
  while (Endge.domain.hasFolderById(newId) || Endge.domain.hasFolderByIdentity(newId)) {
    newId = `folder-${randomString(5)}`
  }

  const folder = RFolder.fromPlain({
    id: newId,
    identity: newId,
    name: folderName,
    displayName: folderName,
    entityType,
    parent: parentId,
  })

  Endge.domain.addFolder(folder)
  await Endge.domainRepository.saveFolder(String(folder.id))
  Endge.domain.notify()
  return folder
}

/**
 * Собирает папку, все вложенные persisted-папки и реальные документы.
 * Виртуальные проекции и колонки таблиц не являются самостоятельными сущностями.
 */
export function createFolderDeletionPlan(root: FsFolderNode): FolderDeletionPlan {
  const folders: FsFolderNode[] = []
  const entities: FsFileNode[] = []
  const visitedFolders = new Set<string>()
  const visitedEntities = new Set<string>()

  const visit = (folder: FsFolderNode): void => {
    if (folder.virtual) {
      return
    }

    const folderKey = String(folder.folderId ?? folder.id)
    if (visitedFolders.has(folderKey)) {
      return
    }
    visitedFolders.add(folderKey)
    folders.push(folder)

    for (const child of folder.children ?? []) {
      if (child.type === 'folder') {
        visit(child)
        continue
      }

      const entity = child as FsFileNode
      if (entity.virtual || entity.isTableColumn) {
        continue
      }

      const entityKey = `${entity.sectionType}:${entity.docType}:${entity.id}`
      if (visitedEntities.has(entityKey)) {
        continue
      }
      visitedEntities.add(entityKey)
      entities.push(entity)
    }
  }

  visit(root)
  return { root, folders, entities }
}

function validateFolderDeletionPlan(plan: FolderDeletionPlan): void {
  const managedFolder = plan.folders.find(isManagedFolderNode)
  if (managedFolder) {
    throw new Error(`Управляемую извне папку «${managedFolder.name}» нельзя удалить`)
  }

  const managedEntity = plan.entities.find(isExternallyManaged)
  if (managedEntity) {
    throw new Error(`Управляемый извне документ «${managedEntity.name}» нельзя удалить`)
  }

  const unsupportedEntity = plan.entities.find(entity => !canDelete(entity.sectionType, entity.docType))
  if (unsupportedEntity) {
    throw new Error(
      `Удаление не поддерживается для «${unsupportedEntity.name}» (${unsupportedEntity.docType})`,
    )
  }
}

/**
 * Рекурсивно удаляет содержимое папки стандартными DELETE-запросами.
 * Сначала удаляются документы, затем папки от самых глубоких к корневой.
 */
export async function deleteFolderRecursively(
  plan: FolderDeletionPlan,
): Promise<FolderDeletionResult> {
  validateFolderDeletionPlan(plan)

  const deletedEntities: FsFileNode[] = []
  const failedEntities: Array<{ node: FsFileNode, error: Error }> = []
  for (const entity of plan.entities) {
    try {
      await deleteEntity(entity)
      deletedEntities.push(entity)
    }
    catch (error) {
      failedEntities.push({
        node: entity,
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }

  const deletedFolders: FsFolderNode[] = []
  const failedFolders: Array<{ node: FsFolderNode, error: Error }> = []
  if (failedEntities.length === 0) {
    for (const folder of [...plan.folders].reverse()) {
      try {
        await Endge.domainRepository.deleteFolder(String(folder.folderId ?? folder.id))
        deletedFolders.push(folder)
      }
      catch (error) {
        failedFolders.push({
          node: folder,
          error: error instanceof Error ? error : new Error(String(error)),
        })
        break
      }
    }
  }

  Endge.domain.notify()
  return {
    folderCount: plan.folders.length,
    entityCount: plan.entities.length,
    deletedEntities,
    failedEntities,
    deletedFolders,
    failedFolders,
  }
}

/**
 * Удаляет сущность.
 *
 * Backend сохраняет удалённое состояние и ревизию документа.
 */
export async function deleteEntity(node: FsFileNode): Promise<DeleteEntityResult> {
  const entity = getEntityBySection(node.id, node.sectionType, node.docType)
  if (isExternallyManaged(node) || isExternallyManaged(entity)) {
    throw new Error('Управляемый извне документ нельзя удалить')
  }
  if (!DELETABLE_DOCUMENT_TYPES.has(node.docType)) {
    throw new Error(`Удаление не поддерживается для типа: ${node.docType}`)
  }
  await Endge.domainRepository.deleteDocument(node.id, node.docType)
  Endge.domain.notify()
  return { mode: 'soft', deletedDocs: [] }
}

/**
 * Обновляет локальную папку сущности (без API-вызова).
 */
export function setEntityFolderInDomain(
  id: string,
  sectionType: DomainSectionType,
  folderId: string | number | null,
  docType?: DomainDocumentType,
): boolean {
  const entity = getEntityBySection(id, sectionType, docType)
  if (!entity) {
    return false
  }

  const mutable = entity as any
  mutable.folderId = folderId
  if (sectionType === DomainSectionType.Component) {
    mutable.group = folderId
  }
  return true
}

/**
 * Выполняет DnD-перенос сущностей между папками/секциями.
 */
export async function executeDrop(payload: DomainDragPayloadItem[], dropTarget: DropTarget): Promise<DropResult> {
  const result: DropResult = { moved: 0, skipped: 0, errors: [] }
  const folderMoves: DragPayloadItem[] = []

  if (dropTarget.targetRootId === 'root-integrations') {
    result.errors.push('Глобальный реестр интеграций не поддерживает папки')
    result.skipped = payload.length
    return result
  }

  if (dropTarget.dropFolderId != null) {
    const folder = Endge.domain.getFolder(dropTarget.dropFolderId)
    if (isExternallyManaged(folder)) {
      result.errors.push('Управляемые извне папки недоступны для перетаскивания')
      result.skipped = payload.length
      return result
    }
  }

  for (const item of payload) {
    if (item.kind === 'folder') {
      try {
        const moved = await moveFolder(item, dropTarget)
        moved ? result.moved++ : result.skipped++
      }
      catch (err) {
        result.skipped++
        result.errors.push(`Папка «${item.id}»: ${(err as Error)?.message ?? 'ошибка смены родительской папки'}`)
      }
      continue
    }

    const entity = getEntityBySection(item.id, item.sectionType)
    if (isExternallyManaged(entity)) {
      result.skipped++
      result.errors.push(`«${item.id}»: управляемый извне документ нельзя перемещать`)
      continue
    }

    if (item.rootId !== dropTarget.targetRootId) {
      const canReclassifyComposition = item.docType === 'composition'
        && ((item.rootId === COMPOSITION_ROOT_IDENTITY && dropTarget.targetRootId === QUERY_ROOT_IDENTITY)
          || (item.rootId === QUERY_ROOT_IDENTITY && dropTarget.targetRootId === COMPOSITION_ROOT_IDENTITY))
      if (!canReclassifyComposition) {
        result.skipped++
        result.errors.push(`«${item.id}»: перетаскивание между разными секциями запрещено`)
        continue
      }

      try {
        await reclassifyComposition(item.id, dropTarget.targetRootId, dropTarget.dropFolderId)
        result.moved++
      }
      catch (err) {
        result.skipped++
        result.errors.push(`«${item.id}»: ${(err as Error)?.message ?? 'ошибка смены роли композиции'}`)
      }
      continue
    }

    folderMoves.push(item)
  }

  if (folderMoves.length === 1) {
    const item = folderMoves[0]!
    try {
      await changeEntityFolder(item.id, item.sectionType, item.docType, dropTarget.targetRootId, dropTarget.dropFolderId)
      result.moved++
    }
    catch (err) {
      result.skipped++
      result.errors.push(`«${item.id}»: ${(err as Error)?.message ?? 'ошибка смены папки'}`)
    }
  }
  else if (folderMoves.length > 1) {
    try {
      const moved = await changeEntitiesFolder(folderMoves, dropTarget.targetRootId, dropTarget.dropFolderId)
      result.moved += moved
      result.skipped += folderMoves.length - moved
    }
    catch (err) {
      result.skipped += folderMoves.length
      result.errors.push(`Выбранные документы: ${(err as Error)?.message ?? 'ошибка массовой смены папки'}`)
    }
  }

  Endge.domain.notify()
  return result
}

/**
 * Переносит persisted-папку целой веткой.
 *
 * Дочерние папки ссылаются на неё через `parent`, а документы — на свои
 * непосредственные папки через `folderId`, поэтому изменение parent корня
 * сохраняет всю вложенную структуру без каскада document PATCH-запросов.
 */
async function moveFolder(item: FolderDragPayloadItem, dropTarget: DropTarget): Promise<boolean> {
  if (item.rootId !== dropTarget.targetRootId) {
    throw new Error('перетаскивание между разными секциями запрещено')
  }

  const folder = Endge.domain.getFolder(item.id)
  if (!folder) {
    throw new Error('папка не найдена')
  }
  if (String(folder.identity) === item.rootId) {
    throw new Error('корневую папку секции нельзя перемещать')
  }
  if (isExternallyManaged(folder)) {
    throw new Error('управляемую извне папку нельзя перемещать')
  }

  const targetFolder = dropTarget.dropFolderId != null
    ? Endge.domain.getFolder(dropTarget.dropFolderId)
    : Endge.domain.getFolderByIdentity(dropTarget.targetRootId)
  if (dropTarget.dropFolderId != null && !targetFolder) {
    throw new Error('папка назначения не найдена')
  }
  if (targetFolder && isExternallyManaged(targetFolder) && String(targetFolder.identity) !== dropTarget.targetRootId) {
    throw new Error('управляемая извне папка недоступна для перетаскивания')
  }
  if (targetFolder && isFolderInsideBranch(targetFolder, folder)) {
    throw new Error('нельзя переместить папку в саму себя или в её подпапку')
  }

  const targetParent = targetFolder?.id ?? targetFolder?.identity ?? dropTarget.targetRootId
  if (String(folder.parent ?? '') === String(targetParent ?? '')) {
    return false
  }

  const previousParent = folder.parent ?? null
  folder.parent = targetParent
  try {
    await Endge.domainRepository.saveFolder(String(folder.id))
  }
  catch (error) {
    folder.parent = previousParent
    Endge.domain.notify()
    throw error
  }
  return true
}

function isFolderInsideBranch(target: RFolder, branchRoot: RFolder): boolean {
  const branchIds = new Set([
    String(branchRoot.id),
    String(branchRoot.identity),
  ])
  const visited = new Set<string>()
  let current: RFolder | null = target

  while (current) {
    if (branchIds.has(String(current.id)) || branchIds.has(String(current.identity))) {
      return true
    }

    const key = `${String(current.id)}:${String(current.identity)}`
    if (visited.has(key)) {
      return true
    }
    visited.add(key)

    current = current.parent == null
      ? null
      : Endge.domain.getFolder(current.parent)
  }
  return false
}

/** Переносит Composition между обычной и query presentation-ролью. */
async function reclassifyComposition(
  id: string,
  targetRootId: string,
  dropFolderId: string | number | null,
): Promise<void> {
  const composition = getEntityBySection(id, DomainSectionType.Composition)
  if (!composition) {
    throw new Error('композиция не найдена')
  }

  const targetIsQueries = targetRootId === QUERY_ROOT_IDENTITY
  const rootFolderId = targetIsQueries ? getQueryRootFolderId() : getCompositionRootFolderId()
  const targetFolderId = dropFolderId ?? rootFolderId
  if (targetFolderId == null) {
    throw new Error('системная папка назначения не найдена')
  }

  const previousMeta = composition.meta
  const previousFolderId = composition.folderId
  const previousKind = composition.kind
  const previousKindIdentity = composition.kindIdentity
  composition.meta = setQueryCompositionRole(composition.meta, targetIsQueries)
  composition.kind = targetIsQueries ? 'query' : 'library'
  composition.kindIdentity = null
  composition.folderId = targetFolderId
  try {
    await Endge.domainRepository.saveDocument(id, 'composition', { model: composition })
  }
  catch (error) {
    composition.meta = previousMeta
    composition.kind = previousKind
    composition.kindIdentity = previousKindIdentity
    composition.folderId = previousFolderId
    throw error
  }
}

/**
 * Переносит сущность в другую папку (домен + API).
 */
async function changeEntityFolder(
  id: string,
  sectionType: DomainSectionType,
  docType: DomainDocumentType,
  targetRootId: string,
  dropFolderId: string | number | null,
): Promise<void> {
  const folderIdentity = getFolderIdentityForApi(targetRootId, dropFolderId)
  const entity = getEntityBySection(id, sectionType, docType) as any
  const prevFolderId = entity?.folderId ?? entity?.folder ?? entity?.group ?? null
  if (!setEntityFolderInDomain(id, sectionType, dropFolderId, docType)) {
    throw new Error('не удалось обновить папку в домене')
  }
  try {
    await Endge.domainRepository.changeDocumentFolder(id, docType, folderIdentity)
  }
  catch (err) {
    setEntityFolderInDomain(id, sectionType, prevFolderId, docType)
    throw err
  }
}

/** Атомарно переносит несколько сущностей в одну папку одним backend-запросом. */
async function changeEntitiesFolder(
  items: readonly DragPayloadItem[],
  targetRootId: string,
  dropFolderId: string | number | null,
): Promise<number> {
  const folderIdentity = getFolderIdentityForApi(targetRootId, dropFolderId)
  if (!folderIdentity) {
    throw new Error('не удалось определить папку назначения')
  }
  return Endge.domainRepository.changeDocumentsFolder(items.map(item => ({
    documentId: item.id,
    documentType: item.docType,
  })), folderIdentity)
}

/**
 * Возвращает identity папки для вызова `changeDocumentFolder`.
 * getFolder ищет по id и по identity — подходит для узлов из дерева (id/identity могут быть string или number).
 */
function getFolderIdentityForApi(targetRootId: string, dropFolderId: string | number | null): string | null {
  if (dropFolderId == null || dropFolderId === '') {
    return targetRootId
  }
  const folder = Endge.domain.getFolder(dropFolderId)
  return folder ? ((folder as any).identity ?? folder.id) : null
}

/**
 * Вычисляет parent для новой подпапки.
 */
function resolveParentIdForNewFolder(targetFolder: FsFolderNode): string | number | null {
  if (!targetFolder.isRoot) {
    return targetFolder.folderId ?? null
  }

  const rootIdentity = String(targetFolder.id)
  const rootFolder = Endge.domain.getFolderByIdentity(rootIdentity)
  return rootFolder?.id ?? rootIdentity
}

/**
 * Конвертирует string-id в number для вызовов `get*ById`.
 */
function toNumericId(id: string | number): number | null {
  if (typeof id === 'number' && Number.isFinite(id)) {
    return id
  }
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return Number(id)
  }
  return null
}

/**
 * Ищет сущность в домене по секции и id/identity.
 */
function getEntityBySection(id: string, sectionType: DomainSectionType, docType?: DomainDocumentType): any | null {
  const numId = toNumericId(id)

  if (docType === 'stream') {
    return (numId != null ? Endge.domain.getStreamById(numId) : null) ?? Endge.domain.getStream(id)
  }
  if (docType === 'update') {
    return (numId != null ? Endge.domain.getUpdateById(numId) : null) ?? Endge.domain.getUpdate(id)
  }

  if (sectionType === DomainSectionType.Component) {
    return Endge.domain.getComponent(id) ?? (Endge.domain as any).getComponentSFC?.(id)
  }
  if (sectionType === DomainSectionType.Query) {
    return (numId != null ? Endge.domain.getQueryById(numId) : null) ?? Endge.domain.getQuery(id)
  }
  if (sectionType === DomainSectionType.DataView) {
    return (numId != null ? (Endge.domain as any).getDataViewById?.(numId) : null) ?? (Endge.domain as any).getDataView?.(id)
  }
  if (sectionType === DomainSectionType.Composition) {
    return (numId != null ? Endge.domain.getCompositionById(numId) : null) ?? Endge.domain.getComposition(id)
  }
  if (sectionType === DomainSectionType.Store) {
    return (numId != null ? Endge.domain.getStoreById(numId) : null) ?? Endge.domain.getStore(id)
  }
  if (sectionType === DomainSectionType.Mock) {
    return (numId != null ? Endge.domain.getMockById(numId) : null) ?? Endge.domain.getMock(id)
  }
  if (sectionType === DomainSectionType.Parameters) {
    return (numId != null ? Endge.domain.getParameterById(numId) : null) ?? Endge.domain.getParameterIdentity(id)
  }
  if (sectionType === DomainSectionType.Filters) {
    return (numId != null ? Endge.domain.getFilterById(numId) : null) ?? Endge.domain.getFilter(id)
  }
  if (sectionType === DomainSectionType.Type || sectionType === DomainSectionType.Primitive) {
    return (numId != null ? Endge.domain.getTypeById(numId) : null) ?? Endge.domain.getType(id)
  }
  if (sectionType === DomainSectionType.Action) {
    return (numId != null ? Endge.domain.getActionById(numId) : null) ?? Endge.domain.getAction(id)
  }
  if (sectionType === DomainSectionType.Converter) {
    return (numId != null ? Endge.domain.getConverterById(numId) : null) ?? Endge.domain.getConverter(id)
  }
  if (sectionType === DomainSectionType.Computation) {
    return (numId != null ? Endge.domain.getComputationById(numId) : null) ?? Endge.domain.getComputation(id)
  }
  if (sectionType === DomainSectionType.Integration) {
    return (numId != null ? Endge.domain.getIntegrationById(numId) : null) ?? Endge.domain.getIntegration(id)
  }
  if (sectionType === DomainSectionType.Environment) {
    return (numId != null ? Endge.domain.getEnvironmentById(numId) : null) ?? Endge.domain.getEnvironment(id)
  }
  if (sectionType === DomainSectionType.Tenant) {
    return (numId != null ? Endge.domain.getTenantById(numId) : null) ?? Endge.domain.getTenant(id)
  }
  if (sectionType === DomainSectionType.Policy) {
    return (numId != null ? Endge.domain.getPolicyById(numId) : null) ?? Endge.domain.getPolicy(id)
  }
  if (sectionType === DomainSectionType.Style) {
    return (numId != null ? Endge.domain.getStyleById(numId) : null) ?? Endge.domain.getStyle(id)
  }
  if (sectionType === DomainSectionType.Configuration) {
    return (numId != null ? Endge.domain.getConfigurationById(numId) : null) ?? Endge.domain.getConfiguration(id)
  }
  if (sectionType === DomainSectionType.PageTemplate) {
    return (numId != null ? Endge.domain.getPageTemplateById(numId) : null) ?? Endge.domain.getPageTemplate(id)
  }
  if (sectionType === DomainSectionType.Page) {
    return (numId != null ? Endge.domain.getPageById(numId) : null) ?? Endge.domain.getPage(id)
  }
  if (sectionType === DomainSectionType.Navigation) {
    return (numId != null ? Endge.domain.getNavigationById(numId) : null) ?? Endge.domain.getNavigation(id)
  }
  if (sectionType === DomainSectionType.Vocabs) {
    return (numId != null ? Endge.domain.getVocabById(numId) : null) ?? Endge.domain.getVocab(id)
  }
  if (sectionType === DomainSectionType.I18nBundles) {
    return (numId != null ? Endge.domain.getI18nBundleById(numId) : null) ?? Endge.domain.getI18nBundle(id)
  }
  if (sectionType === DomainSectionType.AuthProfile) {
    return (numId != null ? Endge.domain.getAuthProfileById(numId) : null) ?? Endge.domain.getAuthProfile(id)
  }
  if (sectionType === DomainSectionType.Project) {
    return (numId != null ? Endge.domain.getProjectById(numId) : null) ?? Endge.domain.getProject(id)
  }
  return null
}
