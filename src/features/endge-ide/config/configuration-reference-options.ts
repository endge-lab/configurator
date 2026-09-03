import type { TypeProgramCatalogEntry } from '@endge/core'

import { DomainSectionType } from '@endge/core'

export interface ConfigurationReferenceOption {
  value: string
  label: string
}

type ReferenceDomain = Record<string, unknown>

const COLLECTION_KEYS = new Map<string, string[]>([
  ['actions', ['actions']],
  ['components', ['components', 'componentSFCs']],
  ['converters', ['converters']],
  ['environments', ['environments']],
  ['filters', ['filters']],
  ['folders', ['folders']],
  ['integrations', ['integrations']],
  ['navigations', ['navigations']],
  ['pages', ['pages']],
  ['page-templates', ['pageTemplates']],
  ['parameters', ['parameters']],
  ['policies', ['policies']],
  ['projects', ['projects']],
  ['queries', ['queries']],
  ['styles', ['styles']],
  ['tenants', ['tenants']],
  ['types', ['types']],
  ['vocabs', ['vocabs']],
])

const SECTION_TYPES = new Map<string, DomainSectionType>([
  ['actions', DomainSectionType.Action],
  ['components', DomainSectionType.Component],
  ['converters', DomainSectionType.Converter],
  ['environments', DomainSectionType.Environment],
  ['filters', DomainSectionType.Filters],
  ['integrations', DomainSectionType.Integration],
  ['navigations', DomainSectionType.Navigation],
  ['pages', DomainSectionType.Page],
  ['page-templates', DomainSectionType.PageTemplate],
  ['parameters', DomainSectionType.Parameters],
  ['policies', DomainSectionType.Policy],
  ['projects', DomainSectionType.Project],
  ['queries', DomainSectionType.Query],
  ['styles', DomainSectionType.Style],
  ['tenants', DomainSectionType.Tenant],
  ['types', DomainSectionType.Type],
  ['vocabs', DomainSectionType.Vocabs],
])

const TARGET_ALIASES = new Map<string, string>([
  ['action', 'actions'],
  ['component', 'components'],
  ['converter', 'converters'],
  ['environment', 'environments'],
  ['filter', 'filters'],
  ['folder', 'folders'],
  ['integration', 'integrations'],
  ['navigation', 'navigations'],
  ['page', 'pages'],
  ['page-template', 'page-templates'],
  ['pagetemplate', 'page-templates'],
  ['pagetemplates', 'page-templates'],
  ['parameter', 'parameters'],
  ['policy', 'policies'],
  ['project', 'projects'],
  ['query', 'queries'],
  ['style', 'styles'],
  ['tenant', 'tenants'],
  ['type', 'types'],
  ['vocab', 'vocabs'],
])

export function normalizeConfigurationReferenceTarget(target: string): string {
  const normalized = String(target ?? '').trim().replace(/[\s_]+/g, '-').toLowerCase()
  if (!normalized) {
    return ''
  }
  const alias = TARGET_ALIASES.get(normalized)
  if (alias) {
    return alias
  }
  return normalized.endsWith('s') ? normalized : `${normalized}s`
}

export function getConfigurationReferenceOptions(
  type: TypeProgramCatalogEntry,
  domain: ReferenceDomain,
): ConfigurationReferenceOption[] {
  const target = normalizeConfigurationReferenceTarget(type.entityReference?.target ?? '')
  const collectionKeys = COLLECTION_KEYS.get(target) ?? [target]
  const entities = collectionKeys.flatMap((key) => {
    const collection = domain[key]
    return Array.isArray(collection) ? collection as Array<Record<string, unknown>> : []
  })
  const options = new Map<string, ConfigurationReferenceOption>()
  for (const entity of entities) {
    if (entity.deletedAt != null) {
      continue
    }
    const rawValue = type.entityReference?.storage === 'identity' ? entity.identity : entity.id
    if (rawValue == null || String(rawValue).trim() === '') {
      continue
    }
    const value = String(rawValue)
    const label = String(entity.displayName ?? entity.name ?? entity.identity ?? entity.id ?? value).trim() || value
    options.set(value, { value, label })
  }
  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value))
}

export function getConfigurationReferenceSectionTypes(type: TypeProgramCatalogEntry): DomainSectionType[] {
  const sectionType = SECTION_TYPES.get(normalizeConfigurationReferenceTarget(type.entityReference?.target ?? ''))
  return sectionType ? [sectionType] : []
}

export function getConfigurationReferenceDropKinds(type: TypeProgramCatalogEntry): Array<'document' | 'folder'> {
  return normalizeConfigurationReferenceTarget(type.entityReference?.target ?? '') === 'folders'
    ? ['folder']
    : ['document']
}
