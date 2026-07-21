import type { DomainDocumentType } from '@endge/core'

import { ComponentType, DomainSectionType, FilterType, ParameterType, QueryType } from '@endge/core'

/** IDE-specific visual metadata for domain documents. */
export interface DomainDocumentPresentation {
  icon: string
  colorClass: string
  badgeIcon?: string
}

export const DOMAIN_SECTION_PRESENTATION: Record<DomainSectionType, DomainDocumentPresentation> = {
  [DomainSectionType.Primitive]: { icon: 'Type', colorClass: 'text-blue-500' },
  [DomainSectionType.Type]: { icon: 'Type', colorClass: 'text-blue-500' },
  [DomainSectionType.Query]: { icon: 'Send', colorClass: 'text-orange-500' },
  [DomainSectionType.DataView]: { icon: 'GitBranch', colorClass: 'text-cyan-500' },
  [DomainSectionType.Composition]: { icon: 'Network', colorClass: 'text-violet-500' },
  [DomainSectionType.Store]: { icon: 'Database', colorClass: 'text-emerald-500' },
  [DomainSectionType.Mock]: { icon: 'Braces', colorClass: 'text-[#8B5A2B] dark:text-[#C08A52]' },
  [DomainSectionType.Component]: { icon: 'Puzzle', colorClass: 'text-blue-500' },
  [DomainSectionType.Action]: { icon: 'Zap', colorClass: 'text-amber-500' },
  [DomainSectionType.Event]: { icon: 'Radio', colorClass: 'text-violet-500' },
  [DomainSectionType.Parameters]: { icon: 'FormInput', colorClass: 'text-slate-500' },
  [DomainSectionType.Converter]: { icon: 'ArrowLeftRight', colorClass: 'text-cyan-500' },
  [DomainSectionType.Computation]: { icon: 'SquareFunction', colorClass: 'text-orange-500' },
  [DomainSectionType.Integration]: { icon: 'Plug', colorClass: 'text-teal-500' },
  [DomainSectionType.Filters]: { icon: 'Filter', colorClass: 'text-rose-500' },
  [DomainSectionType.Environment]: { icon: 'ServerCog', colorClass: 'text-lime-500' },
  [DomainSectionType.Tenant]: { icon: 'Building2', colorClass: 'text-emerald-500' },
  [DomainSectionType.Policy]: { icon: 'Shield', colorClass: 'text-sky-500' },
  [DomainSectionType.Style]: { icon: 'Palette', colorClass: 'text-fuchsia-500' },
  [DomainSectionType.PageTemplate]: { icon: 'Layout', colorClass: 'text-indigo-400' },
  [DomainSectionType.Page]: { icon: 'Columns', colorClass: 'text-indigo-400' },
  [DomainSectionType.Navigation]: { icon: 'Route', colorClass: 'text-cyan-400' },
  [DomainSectionType.Vocabs]: { icon: 'BookOpen', colorClass: 'text-teal-500' },
  [DomainSectionType.I18nBundles]: { icon: 'Languages', colorClass: 'text-amber-500' },
  [DomainSectionType.AuthProfile]: { icon: 'KeyRound', colorClass: 'text-sky-500' },
  [DomainSectionType.Project]: { icon: 'Briefcase', colorClass: 'text-sky-500' },
}

const FALLBACK_PRESENTATION: DomainDocumentPresentation = {
  icon: 'FileWarning',
  colorClass: 'text-red-500',
}

export function getDomainSectionPresentation(sectionType: DomainSectionType): DomainDocumentPresentation {
  return DOMAIN_SECTION_PRESENTATION[sectionType] ?? FALLBACK_PRESENTATION
}

export function getDomainDocumentPresentation(
  docType: DomainDocumentType,
  presentationKind?: string,
): DomainDocumentPresentation {
  const sectionType = getDocumentSectionType(docType)
  const presentation = sectionType == null
    ? FALLBACK_PRESENTATION
    : getDomainSectionPresentation(sectionType)

  const compositionOwnerSection = getCompositionOwnerSection(presentationKind)
  if (String(docType) === 'composition' && compositionOwnerSection != null) {
    return {
      ...presentation,
      colorClass: getDomainSectionPresentation(compositionOwnerSection).colorClass,
    }
  }

  const componentBadgeIcon = getComponentBadgeIcon(docType)
  if (componentBadgeIcon != null) {
    return {
      ...presentation,
      badgeIcon: componentBadgeIcon,
    }
  }

  return presentation
}

function getCompositionOwnerSection(presentationKind?: string): DomainSectionType | null {
  switch (presentationKind) {
    case 'query-composition':
    case 'query':
      return DomainSectionType.Query
    case 'tenant':
      return DomainSectionType.Tenant
    case 'project':
      return DomainSectionType.Project
    case 'environment':
      return DomainSectionType.Environment
    case 'workspace':
      return DomainSectionType.Project
    default:
      return null
  }
}

function getComponentBadgeIcon(docType: DomainDocumentType): string | null {
  switch (String(docType)) {
    case String(ComponentType.Table):
      return 'Table2'
    case String(ComponentType.DSL):
      return 'Braces'
    default:
      return null
  }
}

function getDocumentSectionType(docType: DomainDocumentType): DomainSectionType | null {
  const key = String(docType)

  if (key === String(ComponentType.Component)
    || key === String(ComponentType.DSL)
    || key === String(ComponentType.Table)
    || key === String(ComponentType.SFC)) {
    return DomainSectionType.Component
  }

  if (key === String(QueryType.REST)
    || key === String(QueryType.GraphQL)
    || key === String(QueryType.Custom)) {
    return DomainSectionType.Query
  }

  if (key === String(ParameterType.DefaultParameter)) {
    return DomainSectionType.Parameters
  }
  if (key === String(FilterType.DefaultFilter)) {
    return DomainSectionType.Filters
  }

  const sectionByDocumentType: Partial<Record<string, DomainSectionType>> = {
    'primitive': DomainSectionType.Primitive,
    'type': DomainSectionType.Type,
    'data-view': DomainSectionType.DataView,
    'composition': DomainSectionType.Composition,
    'store': DomainSectionType.Store,
    'mock': DomainSectionType.Mock,
    'action': DomainSectionType.Action,
    'converter': DomainSectionType.Converter,
    'computation': DomainSectionType.Computation,
    'integration': DomainSectionType.Integration,
    'environment': DomainSectionType.Environment,
    'tenant': DomainSectionType.Tenant,
    'policy': DomainSectionType.Policy,
    'style': DomainSectionType.Style,
    'page-template': DomainSectionType.PageTemplate,
    'page': DomainSectionType.Page,
    'navigation': DomainSectionType.Navigation,
    'vocabs': DomainSectionType.Vocabs,
    'i18n-bundles': DomainSectionType.I18nBundles,
    'auth-profile': DomainSectionType.AuthProfile,
    'project': DomainSectionType.Project,
  }

  return sectionByDocumentType[key] ?? null
}
