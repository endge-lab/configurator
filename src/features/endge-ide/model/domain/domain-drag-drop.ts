/**
 * Единый модуль операций над доменным деревом в Domain Widget.
 *
 * В модуле собраны все ключевые сценарии:
 * - создание/мягкое удаление/восстановление папок;
 * - мягкое/жёсткое удаление и восстановление сущностей;
 * - перенос сущностей между папками (drag-and-drop).
 */

import type { FsFileNode, FsFolderNode } from './domain-tree'
import type { DomainDocumentType } from '@endge/core'

import {
  ComponentType,
  DomainSectionType,
  Endge,
  FilterType,
  ParameterType,
  QueryType,
  RFolder,
  ScriptType,
} from '@endge/core'
import { randomString } from '@endge/utils'

import { SOFT_DELETED_IDENTITY } from './domain-tree'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

/** Элемент payload при перетаскивании сущности. */
export interface DragPayloadItem {
  id: string
  sectionType: DomainSectionType
  docType: DomainDocumentType
  rootId: string
  /** Признак дочерней сущности вида (component/filter/query внутри view). */
  isViewChild?: boolean
}

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

/** Корневой id виртуальной секции «Удалённые». */
export const DROP_TARGET_SOFT_DELETED = SOFT_DELETED_IDENTITY as string

interface FolderRestoreState {
  parent: string | number | null
  rootIdentity: string | null
}

const folderRestoreState = new Map<string, FolderRestoreState>()

const SYSTEM_TYPE_FOLDER_IDENTITIES = new Set([
  'types-primitives',
  'types-references',
])

const SECTION_ROOT_IDENTITY: Partial<Record<DomainSectionType, string>> = {
  [DomainSectionType.Primitive]: 'root-primitives',
  [DomainSectionType.Type]: 'root-types',
  [DomainSectionType.Query]: 'root-queries',
  [DomainSectionType.DataView]: 'root-data-views',
  [DomainSectionType.Component]: 'root-components',
  [DomainSectionType.Scenario]: 'root-scenarios',
  [DomainSectionType.Action]: 'root-actions',
  [DomainSectionType.Parameters]: 'root-parameters',
  [DomainSectionType.Converter]: 'root-converters',
  [DomainSectionType.Integration]: 'root-integrations',
  [DomainSectionType.Filters]: 'root-filters',
  [DomainSectionType.View]: 'root-views',
  [DomainSectionType.Environment]: 'root-environments',
  [DomainSectionType.Tenant]: 'root-tenants',
  [DomainSectionType.Policy]: 'root-policies',
  [DomainSectionType.Style]: 'root-styles',
  [DomainSectionType.PageTemplate]: 'root-page-templates',
  [DomainSectionType.Page]: 'root-pages',
  [DomainSectionType.Navigation]: 'root-navigations',
  [DomainSectionType.Vocabs]: 'root-vocabs',
  [DomainSectionType.I18nBundles]: 'root-i18n-bundles',
  [DomainSectionType.AuthProfile]: 'root-auth-profiles',
  [DomainSectionType.Settings]: 'root-settings',
  [DomainSectionType.Project]: 'root-projects',
}

const SCHEMA_SOFT_DELETE_TYPES = new Set<DomainDocumentType>([
  ComponentType.Table,
  ComponentType.DSL,
  COMPONENT_SFC_TYPE,
  QueryType.REST,
  QueryType.GraphQL,
  QueryType.Custom,
  'data-view',
  ScriptType.ScenarioSetup,
  ParameterType.DefaultParameter,
  FilterType.DefaultFilter as DomainDocumentType,
  'type',
  'primitive',
  'project',
])

const SCHEMA_HARD_DELETE_TYPES = new Set<DomainDocumentType>([
  ...SCHEMA_SOFT_DELETE_TYPES,
  'view',
  'environment',
  'tenant',
  'policy',
  'style',
  'vocabs',
  'i18n-bundles',
  'auth-profile',
  'project',
])

const CHANGE_FOLDER_TYPES = new Set<DomainDocumentType>([
  ...SCHEMA_SOFT_DELETE_TYPES,
  'action',
  'converter',
  'integration',
  'view',
  'environment',
  'tenant',
  'policy',
  'style',
  'navigation',
  'vocabs',
  'i18n-bundles',
  'auth-profile',
])

/**
 * Проверяет, можно ли выполнять мягкое удаление сущности.
 */
export function canSoftDelete(sectionType: DomainSectionType, docType?: DomainDocumentType): boolean {
  if (docType)
    return SCHEMA_SOFT_DELETE_TYPES.has(docType) || CHANGE_FOLDER_TYPES.has(docType)
  if (sectionType === DomainSectionType.Settings)
    return false
  return true
}

/**
 * Проверяет, поддерживается ли жёсткое удаление для типа документа.
 */
export function canHardDelete(docType: DomainDocumentType): boolean {
  return SCHEMA_HARD_DELETE_TYPES.has(docType)
}

/**
 * Проверяет, поддерживается ли восстановление для типа документа.
 */
export function canRestore(docType: DomainDocumentType): boolean {
  return SCHEMA_SOFT_DELETE_TYPES.has(docType) || CHANGE_FOLDER_TYPES.has(docType)
}

/**
 * Возвращает id папки-назначения при drop в узел дерева.
 */
export function getDropFolderId(dropNode: FsFolderNode): string | number | null {
  return dropNode.isRoot ? null : (dropNode.folderId ?? null)
}

function isSystemFolderNode(node: FsFolderNode): boolean {
  return node.isSystem === true || SYSTEM_TYPE_FOLDER_IDENTITIES.has(String(node.identity ?? ''))
}

/**
 * Создаёт подпапку в указанной папке/корне и сохраняет её в Payload.
 * В корневой (в т.ч. системной) папке создание дочерней разрешено — мы только задаём parent.
 */
export async function createSubfolder(targetFolder: FsFolderNode): Promise<RFolder> {
  if (isSystemFolderNode(targetFolder) && !targetFolder.isRoot)
    throw new Error('Системная папка недоступна для редактирования')

  const parentId = resolveParentIdForNewFolder(targetFolder)
  let newId = `folder-${randomString(5)}`
  while (Endge.domain.hasFolderById(newId) || Endge.domain.hasFolderByIdentity(newId)) {
    newId = `folder-${randomString(5)}`
  }

  const folder = RFolder.fromPlain({
    id: newId,
    identity: newId,
    name: 'Новая папка',
    displayName: 'Новая папка',
    parent: parentId,
  })

  Endge.domain.addFolder(folder)
  await Endge.schema.saveFolder(String(folder.id))
  Endge.domain.notify()
  return folder
}

/**
 * Мягко удаляет папку: переносит её под корень `soft-deleted`.
 */
export async function softDeleteFolder(node: FsFolderNode): Promise<void> {
  if (isSystemFolderNode(node))
    throw new Error('Системную папку нельзя удалить')

  const folder = getMutableFolder(node)
  const softRoot = Endge.domain.getFolderByIdentity(SOFT_DELETED_IDENTITY)
  if (!softRoot)
    throw new Error('Папка «Удалённые» не найдена')

  const key = String(folder.id)
  if (!folderRestoreState.has(key)) {
    folderRestoreState.set(key, {
      parent: folder.parent ?? null,
      rootIdentity: getSectionRootIdentity(node.sectionType),
    })
  }

  folder.parent = softRoot.id ?? softRoot.identity ?? SOFT_DELETED_IDENTITY
  await Endge.schema.saveFolder(String(folder.id))
  Endge.domain.notify()
}

/**
 * Восстанавливает папку из `soft-deleted`.
 *
 * Если есть сохранённый исходный parent - папка возвращается в него,
 * иначе переносится в корневую секцию (по определённому `sectionType`).
 */
export async function restoreFolder(node: FsFolderNode): Promise<void> {
  const folder = getMutableFolder(node)
  const key = String(folder.id)
  const restore = folderRestoreState.get(key)

  let targetParent: string | number | null = restore?.parent ?? null
  if (targetParent == null) {
    const guessedSection = guessSectionTypeByFolder(String(folder.id)) ?? node.sectionType
    targetParent = resolveSectionRootParent(guessedSection)
  }

  folder.parent = targetParent
  await Endge.schema.saveFolder(String(folder.id))
  Endge.domain.notify()
}

/**
 * Удаляет сущность.
 *
 * - `permanent = false`: мягкое удаление (перенос в `soft-deleted`);
 * - `permanent = true`: жёсткое удаление (разрешено только для сущности в `soft-deleted`).
 */
export async function deleteEntity(node: FsFileNode, permanent = false): Promise<DeleteEntityResult> {
  if (permanent)
    return hardDeleteEntity(node)
  await softDeleteEntity(node)
  Endge.domain.notify()
  return { mode: 'soft', deletedDocs: [] }
}

/**
 * Восстанавливает сущность в корневую секцию.
 */
export async function restoreEntity(node: FsFileNode): Promise<void> {
  if (SCHEMA_SOFT_DELETE_TYPES.has(node.docType)) {
    await Endge.schema.restoreDocument(node.id, node.docType)
  }
  else if (CHANGE_FOLDER_TYPES.has(node.docType)) {
    const rootIdentity = getSectionRootIdentity(node.sectionType)
    if (!rootIdentity)
      throw new Error(`Для секции ${node.sectionType} не определён корень восстановления`)
    await Endge.schema.changeDocumentFolder(node.id, node.docType, rootIdentity)
  }
  else {
    throw new Error(`Восстановление не поддерживается для типа: ${node.docType}`)
  }

  markEntityAsRestoredInDomain(node.id, node.sectionType)
  Endge.domain.notify()
}

/**
 * Определяет, находится ли папка внутри ветки `soft-deleted`.
 */
export function isFolderInSoftDeletedBranch(folderId: string | number): boolean {
  const softRoot = Endge.domain.getFolderByIdentity(SOFT_DELETED_IDENTITY)
  if (!softRoot)
    return false

  const visited = new Set<string>()
  let current = Endge.domain.getFolder(folderId)
  while (current) {
    const key = String(current.id)
    if (visited.has(key))
      return false
    visited.add(key)

    if (current.id === softRoot.id || current.identity === SOFT_DELETED_IDENTITY)
      return true

    const parent = current.parent
    if (parent == null)
      return false
    current = Endge.domain.getFolder(parent)
  }

  return false
}

/**
 * Помечает сущность как удалённую в локальном домене (перемещение в `soft-deleted`).
 */
export function markEntityAsDeletedInDomain(id: string, sectionType: DomainSectionType): void {
  const softId = Endge.domain.getFolderByIdentity(SOFT_DELETED_IDENTITY)?.id ?? null
  if (softId == null)
    return

  const now = new Date().toISOString()
  const entity = getEntityBySection(id, sectionType)
  if (!entity)
    return

  const mutable = entity as any
  mutable.folderId = softId
  mutable.deletedAt = now
  if (sectionType === DomainSectionType.Component)
    mutable.group = softId
}

/**
 * Сбрасывает флаги удаления у сущности в локальном домене.
 */
export function markEntityAsRestoredInDomain(id: string, sectionType: DomainSectionType): void {
  const entity = getEntityBySection(id, sectionType)
  if (!entity)
    return

  const mutable = entity as any
  mutable.folderId = null
  mutable.deletedAt = null
  if (sectionType === DomainSectionType.Component)
    mutable.group = null
}

/**
 * Обновляет локальную папку сущности (без API-вызова).
 */
export function setEntityFolderInDomain(id: string, sectionType: DomainSectionType, folderId: string | number | null): boolean {
  const entity = getEntityBySection(id, sectionType)
  if (!entity)
    return false

  const mutable = entity as any
  mutable.folderId = folderId
  if (sectionType === DomainSectionType.Component)
    mutable.group = folderId
  return true
}

/**
 * Выполняет DnD-перенос сущностей между папками/секциями.
 */
export async function executeDrop(payload: DragPayloadItem[], dropTarget: DropTarget): Promise<DropResult> {
  const result: DropResult = { moved: 0, skipped: 0, errors: [] }
  const isDropToDeleted = dropTarget.targetRootId === DROP_TARGET_SOFT_DELETED

  if (dropTarget.dropFolderId != null) {
    const folder = Endge.domain.getFolder(dropTarget.dropFolderId)
    const identity = String((folder as any)?.identity ?? '')
    if (folder?.isSystem === true || SYSTEM_TYPE_FOLDER_IDENTITIES.has(identity)) {
      result.errors.push('Системные папки типов недоступны для перетаскивания')
      result.skipped = payload.length
      return result
    }
  }

  for (const item of payload) {
    if (item.rootId === DROP_TARGET_SOFT_DELETED) {
      result.skipped++
      result.errors.push(`«${item.id}»: перетаскивание из «Удалённые» запрещено`)
      continue
    }

    if (isDropToDeleted) {
      if (!canSoftDelete(item.sectionType, item.docType)) {
        result.skipped++
        result.errors.push(`«${item.id}»: мягкое удаление не поддерживается для ${item.docType}`)
        continue
      }

      try {
        await softDeleteEntity({
          id: item.id,
          sectionType: item.sectionType,
          docType: item.docType,
          isViewChild: item.isViewChild,
        })
        result.moved++
      }
      catch (err) {
        result.skipped++
        result.errors.push(`«${item.id}»: ${(err as Error)?.message ?? 'ошибка удаления'}`)
      }
      continue
    }

    if (item.rootId !== dropTarget.targetRootId) {
      result.skipped++
      result.errors.push(`«${item.id}»: перетаскивание между разными секциями запрещено`)
      continue
    }

    if (item.isViewChild) {
      result.skipped++
      result.errors.push(`«${item.id}»: дочернюю сущность вида нельзя перемещать`)
      continue
    }

    try {
      await changeEntityFolder(item.id, item.sectionType, item.docType, dropTarget.targetRootId, dropTarget.dropFolderId)
      result.moved++
    }
    catch (err) {
      result.skipped++
      result.errors.push(`«${item.id}»: ${(err as Error)?.message ?? 'ошибка смены папки'}`)
    }
  }

  Endge.domain.notify()
  return result
}

/**
 * Выполняет мягкое удаление сущности и очищает ссылки view-child.
 */
async function softDeleteEntity(node: Pick<FsFileNode, 'id' | 'sectionType' | 'docType' | 'isViewChild'>): Promise<void> {
  if (node.isViewChild) {
    const kind = kindBySection(node.sectionType)
    if (kind)
      await clearEntityRefsInViews(node.id, kind)
  }

  if (SCHEMA_SOFT_DELETE_TYPES.has(node.docType)) {
    await Endge.schema.deleteDocument(node.id, node.docType)
  }
  else if (CHANGE_FOLDER_TYPES.has(node.docType)) {
    await Endge.schema.changeDocumentFolder(node.id, node.docType, SOFT_DELETED_IDENTITY)
  }
  else {
    throw new Error(`Мягкое удаление не поддерживается для типа: ${node.docType}`)
  }

  markEntityAsDeletedInDomain(node.id, node.sectionType)
}

/**
 * Выполняет жёсткое удаление сущности.
 */
async function hardDeleteEntity(node: FsFileNode): Promise<DeleteEntityResult> {
  if (!node.isInDeletedFolder)
    throw new Error('Жёсткое удаление доступно только для сущностей из папки «Удалённые»')

  if (node.sectionType === DomainSectionType.View) {
    const deletedDocs = await hardDeleteViewWithInherited(node.id)
    Endge.domain.notify()
    return { mode: 'hard', deletedDocs }
  }

  if (!SCHEMA_HARD_DELETE_TYPES.has(node.docType))
    throw new Error(`Жёсткое удаление не поддерживается для типа: ${node.docType}`)

  await Endge.schema.deleteDocumentHard(node.id, node.docType)
  removeEntityFromDomain(node.id, node.sectionType)
  Endge.domain.notify()
  return {
    mode: 'hard',
    deletedDocs: [{ id: node.id, docType: node.docType }],
  }
}

/**
 * Удаляет view и его зависимые inherited-сущности.
 */
async function hardDeleteViewWithInherited(viewId: string): Promise<DeletedDocumentRef[]> {
  const deleted: DeletedDocumentRef[] = []
  const view = Endge.domain.getView(viewId)

  if (view) {
    const deps = collectInheritedOnlyDependencies(viewId)
    for (const dep of deps) {
      await Endge.schema.deleteDocumentHard(dep.id, dep.docType)
      removeEntityFromDomain(dep.id, dep.sectionType)
      deleted.push({ id: dep.id, docType: dep.docType })
    }
  }

  await Endge.schema.deleteDocumentHard(viewId, 'view')
  removeEntityFromDomain(viewId, DomainSectionType.View)
  deleted.push({ id: viewId, docType: 'view' })
  return deleted
}

/**
 * Собирает зависимости view, которые наследуются только от него.
 */
function collectInheritedOnlyDependencies(viewId: string): Array<{ id: string, docType: DomainDocumentType, sectionType: DomainSectionType }> {
  const out: Array<{ id: string, docType: DomainDocumentType, sectionType: DomainSectionType }> = []
  const view = Endge.domain.getView(viewId)
  if (!view)
    return out

  if (view.filterId) {
    const f = Endge.domain.getFilter(view.filterId)
    if (isInheritedOnlyFromView(f, viewId)) {
      out.push({
              id: String(view.filterId),
        docType: FilterType.DefaultFilter as DomainDocumentType,
        sectionType: DomainSectionType.Filters,
      })
    }
  }

  if (view.queryId) {
    const q = Endge.domain.getQuery(view.queryId)
    if (isInheritedOnlyFromView(q, viewId) && q?.type) {
      out.push({
              id: String(view.queryId),
        docType: q.type,
        sectionType: DomainSectionType.Query,
      })
    }
  }

  if (view.componentId) {
    const c = Endge.domain.getComponent(view.componentId)
    if (isInheritedOnlyFromView(c, viewId) && c?.type) {
      out.push({
              id: String(view.componentId),
        docType: c.type as DomainDocumentType,
        sectionType: DomainSectionType.Component,
      })
    }
  }

  return out
}

/**
 * Проверяет, что inherited-сущность связана только с указанным view.
 */
function isInheritedOnlyFromView(
  entity: { inherited?: boolean, meta?: { inheritedFrom?: Array<{ docType?: string, docIdentity?: string }> } } | null,
  viewId: string,
): boolean {
  if (!entity?.inherited)
    return false
  const from = entity.meta?.inheritedFrom
  if (!Array.isArray(from) || from.length !== 1)
    return false
  const ref = from[0]
  return ref?.docType === 'view' && ref?.docIdentity === viewId
}

/**
 * Обнуляет ссылки во всех view на указанную сущность.
 */
async function clearEntityRefsInViews(entityId: string, kind: 'component' | 'filter' | 'query'): Promise<void> {
  const views = Endge.domain.getViews()
  for (const view of views) {
    const current = kind === 'component' ? view.componentId : kind === 'filter' ? view.filterId : view.queryId
    if (current == null || String(current) !== String(entityId))
      continue

    const mutableView = view as any
    if (kind === 'component')
      mutableView.componentId = null
    else if (kind === 'filter')
      mutableView.filterId = null
    else
      mutableView.queryId = null

    await Endge.schema.saveDocument(view.id, 'view')
  }
}

/**
 * Возвращает тип связки view по секции домена.
 */
function kindBySection(sectionType: DomainSectionType): 'component' | 'filter' | 'query' | null {
  if (sectionType === DomainSectionType.Component)
    return 'component'
  if (sectionType === DomainSectionType.Filters)
    return 'filter'
  if (sectionType === DomainSectionType.Query)
    return 'query'
  return null
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
  const entity = getEntityBySection(id, sectionType) as any
  const prevFolderId = entity?.folderId ?? entity?.folder ?? entity?.group ?? null
  if (!setEntityFolderInDomain(id, sectionType, dropFolderId))
    throw new Error('не удалось обновить папку в домене')
  try {
    await Endge.schema.changeDocumentFolder(id, docType, folderIdentity)
  }
  catch (err) {
    setEntityFolderInDomain(id, sectionType, prevFolderId)
    throw err
  }
}

/**
 * Возвращает identity папки для вызова `changeDocumentFolder`.
 * getFolder ищет по id и по identity — подходит для узлов из дерева (id/identity могут быть string или number).
 */
function getFolderIdentityForApi(targetRootId: string, dropFolderId: string | number | null): string | null {
  if (dropFolderId == null || dropFolderId === '')
    return targetRootId
  const folder = Endge.domain.getFolder(dropFolderId)
  return folder ? ((folder as any).identity ?? folder.id) : null
}

/**
 * Валидирует папочный узел и возвращает мутабельную папку из домена.
 */
function getMutableFolder(node: FsFolderNode): RFolder {
  if (node.isRoot)
    throw new Error('Нельзя выполнить операцию с корневой папкой')
  if (isSystemFolderNode(node))
    throw new Error('Системная папка недоступна для редактирования')
  if (node.folderId == null)
    throw new Error('Не удалось определить id папки')

  const folder = Endge.domain.getFolder(node.folderId)
  if (!folder)
    throw new Error(`Папка не найдена: ${node.folderId}`)
  return folder
}

/**
 * Вычисляет parent для новой подпапки.
 */
function resolveParentIdForNewFolder(targetFolder: FsFolderNode): string | number | null {
  if (!targetFolder.isRoot)
    return targetFolder.folderId ?? null

  const rootIdentity = String(targetFolder.id)
  const rootFolder = Endge.domain.getFolderByIdentity(rootIdentity)
  return rootFolder?.id ?? rootIdentity
}

/**
 * Возвращает parent корневой секции для восстановления сущности/папки.
 */
function resolveSectionRootParent(sectionType: DomainSectionType): string | number | null {
  const identity = getSectionRootIdentity(sectionType)
  if (!identity)
    return null
  return Endge.domain.getFolderByIdentity(identity)?.id ?? identity
}

/**
 * Возвращает identity корня секции.
 */
function getSectionRootIdentity(sectionType: DomainSectionType): string | null {
  return SECTION_ROOT_IDENTITY[sectionType] ?? null
}

/**
 * Удаляет сущность из локального домена по секции.
 */
function removeEntityFromDomain(id: string, sectionType: DomainSectionType): void {
  const entity = getEntityBySection(id, sectionType) as any
  if (!entity)
    return

  const byId = (entityId: string | number, fallbackIdentity: string, removeById: ((id: any) => void) | undefined, removeByIdentity: (identity: string) => void) => {
    if (removeById && entityId != null) {
      removeById(entityId)
      return
    }
    removeByIdentity(fallbackIdentity)
  }

  const entityId = entity.id
  const identity = String(entity.identity ?? id)

  if (sectionType === DomainSectionType.Component) {
    if (entity.type === COMPONENT_SFC_TYPE)
      byId(entityId, identity, (x: any) => (Endge.domain as any).removeComponentSFCById?.(x), x => (Endge.domain as any).removeComponentSFC?.(x))
    else
      byId(entityId, identity, (x: any) => Endge.domain.removeComponentById?.(x), x => Endge.domain.removeComponent(x))
  }
  else if (sectionType === DomainSectionType.Scenario) {
    byId(entityId, identity, (x: any) => Endge.domain.removeScenarioById?.(x), x => Endge.domain.removeScenario(x))
  }
  else if (sectionType === DomainSectionType.Query) {
    byId(entityId, identity, (x: any) => Endge.domain.removeQueryById?.(x), x => Endge.domain.removeQuery(x))
  }
  else if (sectionType === DomainSectionType.DataView) {
    byId(entityId, identity, (x: any) => (Endge.domain as any).removeDataViewById?.(x), x => (Endge.domain as any).removeDataView(x))
  }
  else if (sectionType === DomainSectionType.Parameters) {
    byId(entityId, identity, (x: any) => Endge.domain.removeParameterById?.(x), x => Endge.domain.removeParameter(x))
  }
  else if (sectionType === DomainSectionType.Filters) {
    byId(entityId, identity, (x: any) => Endge.domain.removeFilterById?.(x), x => Endge.domain.removeFilter(x))
  }
  else if (sectionType === DomainSectionType.Type || sectionType === DomainSectionType.Primitive) {
    byId(entityId, identity, (x: any) => Endge.domain.removeTypeById?.(x), x => Endge.domain.removeType(x))
  }
  else if (sectionType === DomainSectionType.Action) {
    byId(entityId, identity, (x: any) => Endge.domain.removeActionById?.(x), x => Endge.domain.removeAction(x))
  }
  else if (sectionType === DomainSectionType.Converter) {
    byId(entityId, identity, (x: any) => Endge.domain.removeConverterById?.(x), x => Endge.domain.removeConverter(x))
  }
  else if (sectionType === DomainSectionType.Integration) {
    byId(entityId, identity, (x: any) => Endge.domain.removeIntegrationById?.(x), x => Endge.domain.removeIntegration(x))
  }
  else if (sectionType === DomainSectionType.View) {
    byId(entityId, identity, (x: any) => Endge.domain.removeViewById?.(x), x => Endge.domain.removeView(x))
  }
  else if (sectionType === DomainSectionType.Environment) {
    byId(entityId, identity, (x: any) => Endge.domain.removeEnvironmentById?.(x), x => Endge.domain.removeEnvironment(x))
  }
  else if (sectionType === DomainSectionType.Tenant) {
    byId(entityId, identity, (x: any) => Endge.domain.removeTenantById?.(x), x => Endge.domain.removeTenant(x))
  }
  else if (sectionType === DomainSectionType.Policy) {
    byId(entityId, identity, (x: any) => Endge.domain.removePolicyById?.(x), x => Endge.domain.removePolicy(x))
  }
  else if (sectionType === DomainSectionType.Style) {
    byId(entityId, identity, (x: any) => Endge.domain.removeStyleById?.(x), x => Endge.domain.removeStyle(x))
  }
  else if (sectionType === DomainSectionType.PageTemplate) {
    byId(entityId, identity, (x: any) => Endge.domain.removePageTemplateById?.(x), x => Endge.domain.removePageTemplate(x))
  }
  else if (sectionType === DomainSectionType.Page) {
    byId(entityId, identity, (x: any) => Endge.domain.removePageById?.(x), x => Endge.domain.removePage(x))
  }
  else if (sectionType === DomainSectionType.Navigation) {
    byId(entityId, identity, (x: any) => Endge.domain.removeNavigationById?.(x), x => Endge.domain.removeNavigation(x))
  }
  else if (sectionType === DomainSectionType.Vocabs) {
    byId(entityId, identity, (x: any) => Endge.domain.removeVocabsById?.(x), x => Endge.domain.removeVocabs(x))
  }
  else if (sectionType === DomainSectionType.I18nBundles) {
    byId(entityId, identity, (x: any) => Endge.domain.removeI18nBundlesById?.(x), x => Endge.domain.removeI18nBundles(x))
  }
  else if (sectionType === DomainSectionType.AuthProfile) {
    byId(entityId, identity, (x: any) => Endge.domain.removeAuthProfileById?.(x), x => Endge.domain.removeAuthProfile(x))
  }
  else if (sectionType === DomainSectionType.Project) {
    byId(entityId, identity, (x: any) => Endge.domain.removeProjectById?.(x), x => Endge.domain.removeProject(x))
  }
}

/**
 * Конвертирует string-id в number для вызовов `get*ById`.
 */
function toNumericId(id: string | number): number | null {
  if (typeof id === 'number' && Number.isFinite(id))
    return id
  if (typeof id === 'string' && /^\d+$/.test(id))
    return Number(id)
  return null
}

/**
 * Ищет сущность в домене по секции и id/identity.
 */
function getEntityBySection(id: string, sectionType: DomainSectionType): any | null {
  const numId = toNumericId(id)

  if (sectionType === DomainSectionType.Component)
    return Endge.domain.getComponent(id) ?? (Endge.domain as any).getComponentSFC?.(id)
  if (sectionType === DomainSectionType.Query)
    return (numId != null ? Endge.domain.getQueryById(numId) : null) ?? Endge.domain.getQuery(id)
  if (sectionType === DomainSectionType.DataView)
    return (numId != null ? (Endge.domain as any).getDataViewById?.(numId) : null) ?? (Endge.domain as any).getDataView?.(id)
  if (sectionType === DomainSectionType.Scenario)
    return (numId != null ? Endge.domain.getScenarioById(numId) : null) ?? Endge.domain.getScenario(id)
  if (sectionType === DomainSectionType.Parameters)
    return (numId != null ? Endge.domain.getParameterById(numId) : null) ?? Endge.domain.getParameterIdentity(id)
  if (sectionType === DomainSectionType.Filters)
    return (numId != null ? Endge.domain.getFilterById(numId) : null) ?? Endge.domain.getFilter(id)
  if (sectionType === DomainSectionType.Type || sectionType === DomainSectionType.Primitive)
    return (numId != null ? Endge.domain.getTypeById(numId) : null) ?? Endge.domain.getType(id)
  if (sectionType === DomainSectionType.Action)
    return (numId != null ? Endge.domain.getActionById(numId) : null) ?? Endge.domain.getAction(id)
  if (sectionType === DomainSectionType.Converter)
    return (numId != null ? Endge.domain.getConverterById(numId) : null) ?? Endge.domain.getConverter(id)
  if (sectionType === DomainSectionType.Integration)
    return (numId != null ? Endge.domain.getIntegrationById(numId) : null) ?? Endge.domain.getIntegration(id)
  if (sectionType === DomainSectionType.View)
    return (numId != null ? Endge.domain.getViewById(numId) : null) ?? Endge.domain.getView(id)
  if (sectionType === DomainSectionType.Environment)
    return (numId != null ? Endge.domain.getEnvironmentById(numId) : null) ?? Endge.domain.getEnvironment(id)
  if (sectionType === DomainSectionType.Tenant)
    return (numId != null ? Endge.domain.getTenantById(numId) : null) ?? Endge.domain.getTenant(id)
  if (sectionType === DomainSectionType.Policy)
    return (numId != null ? Endge.domain.getPolicyById(numId) : null) ?? Endge.domain.getPolicy(id)
  if (sectionType === DomainSectionType.Style)
    return (numId != null ? Endge.domain.getStyleById(numId) : null) ?? Endge.domain.getStyle(id)
  if (sectionType === DomainSectionType.PageTemplate)
    return (numId != null ? Endge.domain.getPageTemplateById(numId) : null) ?? Endge.domain.getPageTemplate(id)
  if (sectionType === DomainSectionType.Page)
    return (numId != null ? Endge.domain.getPageById(numId) : null) ?? Endge.domain.getPage(id)
  if (sectionType === DomainSectionType.Navigation)
    return (numId != null ? Endge.domain.getNavigationById(numId) : null) ?? Endge.domain.getNavigation(id)
  if (sectionType === DomainSectionType.Vocabs)
    return (numId != null ? Endge.domain.getVocabById(numId) : null) ?? Endge.domain.getVocab(id)
  if (sectionType === DomainSectionType.I18nBundles)
    return (numId != null ? Endge.domain.getI18nBundleById(numId) : null) ?? Endge.domain.getI18nBundle(id)
  if (sectionType === DomainSectionType.AuthProfile)
    return (numId != null ? Endge.domain.getAuthProfileById(numId) : null) ?? Endge.domain.getAuthProfile(id)
  return null
}

/**
 * Пытается определить секцию папки по сущностям внутри её ветки.
 */
function guessSectionTypeByFolder(folderId: string): DomainSectionType | null {
  const folderIds = collectFolderBranchIds(folderId)
  const hasInBranch = (e: any) => {
    const fid = e?.folderId ?? e?.folder ?? e?.group ?? null
    return fid != null && folderIds.has(String(fid))
  }

  if (Endge.domain.getComponents().some(hasInBranch))
    return DomainSectionType.Component
  if (Endge.domain.getQueries().some(hasInBranch))
    return DomainSectionType.Query
  if (((Endge.domain as any).getDataViews?.() ?? []).some(hasInBranch))
    return DomainSectionType.DataView
  if (Endge.domain.getScenarios().some(hasInBranch))
    return DomainSectionType.Scenario
  if (Endge.domain.getFilters().some(hasInBranch))
    return DomainSectionType.Filters
  if (Endge.domain.getParameters().some(hasInBranch))
    return DomainSectionType.Parameters
  if (Endge.domain.getTypes().some(hasInBranch))
    return DomainSectionType.Type
  if (Endge.domain.getActions().some(hasInBranch))
    return DomainSectionType.Action
  if (Endge.domain.getConverters().some(hasInBranch))
    return DomainSectionType.Converter
  if (Endge.domain.getIntegrations().some(hasInBranch))
    return DomainSectionType.Integration
  if (Endge.domain.getViews().some(hasInBranch))
    return DomainSectionType.View
  if (Endge.domain.getEnvironments().some(hasInBranch))
    return DomainSectionType.Environment
  if (Endge.domain.getTenants().some(hasInBranch))
    return DomainSectionType.Tenant
  if (Endge.domain.getPolicies().some(hasInBranch))
    return DomainSectionType.Policy
  if (Endge.domain.getStyles().some(hasInBranch))
    return DomainSectionType.Style
  if (Endge.domain.getPageTemplates().some(hasInBranch))
    return DomainSectionType.PageTemplate
  if (Endge.domain.getPages().some(hasInBranch))
    return DomainSectionType.Page
  if (Endge.domain.getNavigations().some(hasInBranch))
    return DomainSectionType.Navigation
  if (Endge.domain.getVocabs().some(hasInBranch))
    return DomainSectionType.Vocabs
  if (Endge.domain.getI18nBundles().some(hasInBranch))
    return DomainSectionType.I18nBundles
  if (Endge.domain.getAuthProfiles().some(hasInBranch))
    return DomainSectionType.AuthProfile

  return null
}

/**
 * Собирает id папки и всех дочерних подпапок.
 */
function collectFolderBranchIds(rootFolderId: string): Set<string> {
  const out = new Set<string>([String(rootFolderId)])
  const queue = [String(rootFolderId)]
  const folders = Endge.domain.getFolders()

  while (queue.length) {
    const current = queue.shift()!
    for (const folder of folders) {
      const parent = folder.parent == null ? null : String(folder.parent)
      const id = String(folder.id)
      if (parent === current && !out.has(id)) {
        out.add(id)
        queue.push(id)
      }
    }
  }

  return out
}
