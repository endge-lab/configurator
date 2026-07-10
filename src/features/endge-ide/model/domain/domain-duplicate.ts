/**
 * Дублирование сущности домена: получение по docType и полная копия через duplicate() / duplicateComponent().
 */

import type { DomainDocumentType, EndgeDomain } from '@endge/core'

import {
  ComponentType,
  Endge,
  FilterType,
  ParameterType,
  QueryType,
  duplicateComponent,
} from '@endge/core'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

/**
 * Возвращает сущность домена по id и типу документа.
 */
export function getEntityByDocType(
  domain: EndgeDomain,
  id: string | number,
  docType: DomainDocumentType,
): unknown {
  switch (docType) {
    case COMPONENT_SFC_TYPE:
      return (domain as any).getComponentSFC?.(id)
    case ComponentType.DSL:
    case ComponentType.Table:
      return domain.getComponent(id)
    case QueryType.REST:
    case QueryType.GraphQL:
    case QueryType.Custom:
      return domain.getQuery(id)
    case 'data-view':
      return (domain as any).getDataView?.(id)
    case 'action':
      return domain.getAction(id)
    case 'integration':
      return domain.getIntegration(id)
    case 'view':
      return domain.getView(id)
    case 'environment':
      return domain.getEnvironment(id)
    case 'tenant':
      return domain.getTenant(id)
    case 'policy':
      return domain.getPolicy(id)
    case 'style':
      return domain.getStyle(id)
    case 'page-template':
      return domain.getPageTemplate(id)
    case 'page':
      return domain.getPage(id)
    case 'navigation':
      return domain.getNavigation(id)
    case 'vocabs':
      return domain.getVocab(id)
    case 'auth-profile':
      return domain.getAuthProfile(id)
    case 'i18n-bundles':
      return domain.getI18nBundle(id)
    case FilterType.DefaultFilter:
      return domain.getFilter(id)
    case ParameterType.DefaultParameter:
      return domain.getParameter(id)
    case 'converter':
      return domain.getConverter(id)
    default:
      return null
  }
}

/**
 * Дублирует сущность: полная копия через duplicate() / duplicateComponent(), сохранение в корне.
 */
export async function duplicateEntity(
  sourceId: string | number,
  docType: DomainDocumentType,
  newIdentity: string,
  newName: string,
): Promise<void> {
  const domain = Endge.domain
  const source = getEntityByDocType(domain, sourceId, docType)
  if (!source) {
    throw new Error(`Сущность не найдена: ${sourceId} (${docType})`)
  }

  const options = { identity: newIdentity, name: newName }
  const draft =
    docType === ComponentType.DSL || docType === ComponentType.Table
      ? duplicateComponent(source as any, options)
      : (source as any).duplicate(options)

  if (!draft) {
    throw new Error(`Не удалось создать копию: ${sourceId}`)
  }

  await Endge.schema.saveDocument(newIdentity, docType, { model: draft })
  Endge.domain.notify()
}
