import type {
  DomainWorkingSetGraph,
  DomainWorkingSetRef,
} from '@/features/endge-ide/domain/types/domain-working-set.type'
import type { ProgramEntityType } from '@endge/core'

import { Endge } from '@endge/core'

import { normalizeDomainWorkingSetEntityType } from '@/features/endge-ide/tools/resolve-domain-working-set'

const PROGRAM_ENTITY_TYPES = new Set<ProgramEntityType>([
  'type',
  'component-sfc',
  'computation',
  'action',
  'query',
  'data-view',
  'store',
  'filter',
  'composition',
  'style',
])

const CONTEXTUAL_COMPOSITION_OWNER_TYPES = new Set([
  'project',
  'tenant',
  'query',
  'environment',
  'workspace',
])

/** Возвращает только исходящие dependencies документа. */
function getDependencies(ref: DomainWorkingSetRef): DomainWorkingSetRef[] {
  const dependencies: DomainWorkingSetRef[] = []
  const entityType = normalizeDomainWorkingSetEntityType(ref.entityType)
  const idOrIdentity = ref.identity ?? ref.id

  if (CONTEXTUAL_COMPOSITION_OWNER_TYPES.has(entityType)) {
    for (const composition of Endge.domain.getCompositions()) {
      if (composition.kind !== entityType || composition.kindIdentity !== String(idOrIdentity)) {
        continue
      }
      dependencies.push({
        entityType: 'composition',
        id: composition.id ?? composition.identity,
        identity: composition.identity,
      })
    }
  }

  if (!PROGRAM_ENTITY_TYPES.has(entityType as ProgramEntityType)) {
    return dependencies
  }

  const artifact = Endge.program.getArtifact(entityType as ProgramEntityType, idOrIdentity)
  if (!artifact) {
    return dependencies
  }

  dependencies.push(...artifact.dependencies.map(dependency => ({
    entityType: normalizeDomainWorkingSetEntityType(dependency.entityType),
    id: dependency.id,
    identity: dependency.identity,
  })))
  return dependencies
}

/** Возвращает presentation owner Composition без раскрытия его дочерних сущностей. */
function getOwner(ref: DomainWorkingSetRef): DomainWorkingSetRef | null {
  if (normalizeDomainWorkingSetEntityType(ref.entityType) !== 'composition') {
    return null
  }

  const composition = Endge.domain.getComposition(ref.identity ?? ref.id)
  const ownerIdentity = composition?.kindIdentity
  if (!composition || !ownerIdentity || composition.kind === 'library') {
    return null
  }

  const owner = composition.kind === 'project'
    ? Endge.domain.getProject(ownerIdentity)
    : composition.kind === 'tenant'
      ? Endge.domain.getTenant(ownerIdentity)
      : composition.kind === 'query'
        ? Endge.domain.getQuery(ownerIdentity)
        : composition.kind === 'environment'
          ? Endge.domain.getEnvironment(ownerIdentity)
          : null

  return {
    entityType: composition.kind,
    id: owner?.id ?? ownerIdentity,
    identity: owner?.identity ?? ownerIdentity,
  }
}

/** Configurator adapter над текущими Endge.domain и Endge.program. */
export const ENDGE_DOMAIN_WORKING_SET_GRAPH: DomainWorkingSetGraph = {
  dependenciesOf: getDependencies,
  ownerOf: getOwner,
}
