import type { DomainDocumentType } from '@endge/core'

import { ComponentType, Endge, FilterType, ParameterType, QueryType } from '@endge/core'

import { resolveEndgeIDEDocument } from '@/features/endge-ide/model/core/endge-ide-restored-document-tabs'
import { getDomainDocumentLabel } from '@/features/endge-ide/model/domain/domain-entity-presentation'

interface DomainDocumentLocation {
  identity?: unknown
  folderId?: string | number | null
  storeIdentity?: unknown
  kind?: unknown
  kindIdentity?: unknown
  type?: DomainDocumentType
}

const ROOT_IDENTITY_BY_DOCUMENT_TYPE: ReadonlyMap<string, string> = new Map([
  [String(ComponentType.Component), 'root-components'],
  [String(ComponentType.DSL), 'root-components'],
  [String(ComponentType.Table), 'root-components'],
  [String(ComponentType.SFC), 'root-components'],
  [String(QueryType.REST), 'root-queries'],
  [String(QueryType.GraphQL), 'root-queries'],
  [String(QueryType.Custom), 'root-queries'],
  [String(ParameterType.DefaultParameter), 'root-parameters'],
  [String(FilterType.DefaultFilter), 'root-filters'],
  ['primitive', 'root-types'],
  ['type', 'root-types'],
  ['data-view', 'root-data-views'],
  ['composition', 'root-compositions'],
  ['store', 'root-stores'],
  ['stream', 'root-queries'],
  ['update', 'root-stores'],
  ['mock', 'root-mocks'],
  ['action', 'root-actions'],
  ['converter', 'root-converters'],
  ['computation', 'root-computations'],
  ['integration', 'root-integrations'],
  ['environment', 'root-environments'],
  ['tenant', 'root-tenants'],
  ['policy', 'root-policies'],
  ['style', 'root-styles'],
  ['page-template', 'root-page-templates'],
  ['page', 'root-pages'],
  ['navigation', 'root-navigations'],
  ['vocabs', 'root-vocabs'],
  ['i18n-bundles', 'root-i18n-bundles'],
  ['auth-profile', 'root-auth-profiles'],
  ['project', 'root-projects'],
])

const COMPOSITION_ROOT_BY_KIND: ReadonlyMap<string, string> = new Map([
  ['query', 'root-queries'],
  ['tenant', 'root-tenants'],
  ['project', 'root-projects'],
  ['environment', 'root-environments'],
  ['workspace', 'root-compositions'],
])

const ROOT_LABEL_BY_IDENTITY: ReadonlyMap<string, string> = new Map([
  ['root-types', 'Типы'],
  ['root-queries', 'Обмен данными'],
  ['root-data-views', 'Представления'],
  ['root-compositions', 'Композиции'],
  ['root-stores', 'Хранилище'],
  ['root-components', 'Компоненты'],
  ['root-actions', 'Действия'],
  ['root-filters', 'Фильтры'],
  ['root-converters', 'Конвертеры'],
  ['root-computations', 'Вычисления'],
  ['root-parameters', 'Параметры'],
  ['root-integrations', 'Интеграции'],
  ['root-environments', 'Окружения'],
  ['root-tenants', 'Тенанты'],
  ['root-policies', 'Политики'],
  ['root-styles', 'Стили'],
  ['root-page-templates', 'Шаблоны страниц'],
  ['root-pages', 'Страницы'],
  ['root-navigations', 'Навигация'],
  ['root-vocabs', 'Словари'],
  ['root-mocks', 'Mock'],
  ['root-i18n-bundles', 'Словари переводов'],
  ['root-auth-profiles', 'Аутентификация'],
  ['root-projects', 'Проекты'],
])

function getFolderLabel(folder: { displayName?: unknown, name?: unknown, identity?: unknown }): string {
  return String(folder.displayName ?? '').trim()
    || String(folder.name ?? '').trim()
    || String(folder.identity ?? '').trim()
}

function getFolderPath(
  folderId: string | number | null | undefined,
  fallbackRootIdentity: string | null,
): string[] {
  let currentFolderId = folderId
  if (currentFolderId == null && fallbackRootIdentity) {
    currentFolderId = Endge.domain.getFolderByIdentity(fallbackRootIdentity)?.id ?? fallbackRootIdentity
  }

  const segments: string[] = []
  const visited = new Set<string>()
  while (currentFolderId != null && String(currentFolderId).trim()) {
    const lookupKey = String(currentFolderId)
    if (visited.has(lookupKey)) {
      break
    }
    visited.add(lookupKey)

    const folder = Endge.domain.getFolder(currentFolderId)
    if (!folder) {
      if (fallbackRootIdentity && lookupKey === fallbackRootIdentity) {
        const fallbackRootLabel = ROOT_LABEL_BY_IDENTITY.get(fallbackRootIdentity)
        if (fallbackRootLabel) {
          segments.unshift(fallbackRootLabel)
        }
      }
      break
    }
    const label = getFolderLabel(folder)
    if (label) {
      segments.unshift(label)
    }
    currentFolderId = folder.parent
  }
  return segments
}

function getContextOwner(
  kind: string,
  identity: string,
): { document: DomainDocumentLocation, documentType: DomainDocumentType } | null {
  if (!identity) {
    return null
  }
  if (kind === 'query') {
    const document = Endge.domain.getQuery(identity)
    return document ? { document, documentType: document.type } : null
  }
  if (kind === 'tenant') {
    const document = Endge.domain.getTenant(identity)
    return document ? { document, documentType: 'tenant' } : null
  }
  if (kind === 'project') {
    const document = Endge.domain.getProject(identity)
    return document ? { document, documentType: 'project' } : null
  }
  if (kind === 'environment') {
    const document = Endge.domain.getEnvironment(identity)
    return document ? { document, documentType: 'environment' } : null
  }
  return null
}

function getDocumentPath(
  document: DomainDocumentLocation,
  documentId: string,
  documentType: DomainDocumentType,
): string {
  const label = getDomainDocumentLabel(documentId, documentType)

  if (String(documentType) === 'update') {
    const storeIdentity = String(document.storeIdentity ?? '').trim()
    const store = storeIdentity ? Endge.domain.getStore(storeIdentity) : null
    if (store) {
      return [...getFolderPath(store.folderId, 'root-stores'), getDomainDocumentLabel(storeIdentity, 'store'), label].join('/')
    }
  }

  let rootIdentity = ROOT_IDENTITY_BY_DOCUMENT_TYPE.get(String(documentType)) ?? null
  if (String(documentType) === 'composition') {
    const kind = String(document.kind ?? 'library')
    const owner = getContextOwner(kind, String(document.kindIdentity ?? '').trim())
    if (owner) {
      const ownerIdentity = String(owner.document.identity ?? document.kindIdentity ?? '').trim()
      return [
        ...getFolderPath(
          owner.document.folderId,
          ROOT_IDENTITY_BY_DOCUMENT_TYPE.get(String(owner.documentType)) ?? null,
        ),
        getDomainDocumentLabel(ownerIdentity, owner.documentType),
        label,
      ].join('/')
    }
    rootIdentity = COMPOSITION_ROOT_BY_KIND.get(kind) ?? rootIdentity
  }

  return [...getFolderPath(document.folderId, rootIdentity), label].join('/')
}

/** Путь документа в той же иерархии, в которой он показан в виджете проекта. */
export function getDomainDocumentProjectPath(
  documentId: string,
  documentType: DomainDocumentType,
): string | null {
  const normalizedId = String(documentId ?? '').trim()
  if (!normalizedId) {
    return null
  }
  const document = resolveEndgeIDEDocument(normalizedId, documentType) as DomainDocumentLocation | null
  if (!document) {
    return null
  }
  return getDocumentPath(document, normalizedId, documentType)
}
