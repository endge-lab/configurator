import type { DomainDocumentType, EventContract, EventContractEntityType } from '@endge/core'

import {
  ComponentType,
  EventContractEntityType as ContractEntityType,
  Endge,
  QueryType,
} from '@endge/core'

/**
 * Приводит тип документа к типу сущности контрактов.
 */
export function resolveEventContractEntityType(documentType: DomainDocumentType): EventContractEntityType | null {
  if (documentType === ComponentType.Table || documentType === ComponentType.DSL) { return ContractEntityType.Component }

  if (
    documentType === QueryType.REST
    || documentType === QueryType.GraphQL
    || documentType === QueryType.Custom
  ) {
    return ContractEntityType.Query
  }

  if (documentType === 'project') { return ContractEntityType.Project }
  if (documentType === 'page') { return ContractEntityType.Page }
  if (documentType === 'page-template') { return ContractEntityType.PageTemplate }

  return null
}

export function getEventContractsByEntity(entityType: EventContractEntityType): EventContract[] {
  return Endge.configuration.contracts.getBehaviorByEntity(entityType)
}

export function getEventContractsForDocument(documentType: DomainDocumentType): EventContract[] {
  const entityType = resolveEventContractEntityType(documentType)
  if (!entityType) { return [] }
  return getEventContractsByEntity(entityType)
}

export function getEventContractForDocument(
  documentType: DomainDocumentType,
  eventName: string,
): EventContract | null {
  const entityType = resolveEventContractEntityType(documentType)
  if (!entityType) { return null }
  return Endge.configuration.contracts.getBehaviorByEvent(entityType, eventName)
}

export function supportsEnvironmentOverrideForDocument(
  documentType: DomainDocumentType,
  eventName: string,
): boolean {
  const entityType = resolveEventContractEntityType(documentType)
  if (!entityType) { return false }
  return Endge.configuration.contracts.supportsBehaviorOverride(entityType, eventName)
}
