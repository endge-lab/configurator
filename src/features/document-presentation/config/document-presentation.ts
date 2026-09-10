import type { DomainDocumentPresentation } from '../types/document-presentation'

import { ComponentType, DomainSectionType, FilterType, ParameterType, QueryType } from '@endge/core'

export const DOCUMENT_COLORS = {
  blue: 'text-blue-500',
  orange: 'text-orange-500',
  cyan: 'text-cyan-500',
  violet: 'text-violet-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  slate: 'text-slate-500',
  teal: 'text-teal-500',
  rose: 'text-rose-500',
  lime: 'text-lime-500',
  sky: 'text-sky-500',
  fuchsia: 'text-fuchsia-500',
  pink: 'text-pink-500',
  mock: 'text-[#8B5A2B] dark:text-[#C08A52]',
  indigo: 'text-indigo-400',
  navigation: 'text-cyan-400',
  fallback: 'text-red-500',
} as const

export const DOMAIN_SECTION_PRESENTATION: Readonly<Record<DomainSectionType, DomainDocumentPresentation>> = {
  [DomainSectionType.Primitive]: { icon: 'Type', colorClass: DOCUMENT_COLORS.blue },
  [DomainSectionType.Type]: { icon: 'Type', colorClass: DOCUMENT_COLORS.blue },
  [DomainSectionType.Query]: { icon: 'Send', colorClass: DOCUMENT_COLORS.orange },
  [DomainSectionType.DataView]: { icon: 'GitBranch', colorClass: DOCUMENT_COLORS.cyan },
  [DomainSectionType.Composition]: { icon: 'Network', colorClass: DOCUMENT_COLORS.violet },
  [DomainSectionType.Simulation]: { icon: 'FlaskConical', colorClass: DOCUMENT_COLORS.pink },
  [DomainSectionType.Store]: { icon: 'Database', colorClass: DOCUMENT_COLORS.emerald },
  [DomainSectionType.Mock]: { icon: 'Braces', colorClass: DOCUMENT_COLORS.mock },
  [DomainSectionType.Component]: { icon: 'Puzzle', colorClass: DOCUMENT_COLORS.blue },
  [DomainSectionType.Action]: { icon: 'Zap', colorClass: DOCUMENT_COLORS.amber },
  [DomainSectionType.Event]: { icon: 'Radio', colorClass: DOCUMENT_COLORS.violet },
  [DomainSectionType.Parameters]: { icon: 'FormInput', colorClass: DOCUMENT_COLORS.slate },
  [DomainSectionType.Converter]: { icon: 'ArrowLeftRight', colorClass: DOCUMENT_COLORS.cyan },
  [DomainSectionType.Computation]: { icon: 'SquareFunction', colorClass: DOCUMENT_COLORS.orange },
  [DomainSectionType.Integration]: { icon: 'Plug', colorClass: DOCUMENT_COLORS.teal },
  [DomainSectionType.Filters]: { icon: 'Filter', colorClass: DOCUMENT_COLORS.rose },
  [DomainSectionType.Environment]: { icon: 'ServerCog', colorClass: DOCUMENT_COLORS.lime },
  [DomainSectionType.Tenant]: { icon: 'Building2', colorClass: DOCUMENT_COLORS.emerald },
  [DomainSectionType.Policy]: { icon: 'Shield', colorClass: DOCUMENT_COLORS.sky },
  [DomainSectionType.Style]: { icon: 'Palette', colorClass: DOCUMENT_COLORS.fuchsia },
  [DomainSectionType.Configuration]: { icon: 'SlidersHorizontal', colorClass: DOCUMENT_COLORS.slate },
  [DomainSectionType.PageTemplate]: { icon: 'Layout', colorClass: DOCUMENT_COLORS.indigo },
  [DomainSectionType.Page]: { icon: 'Columns', colorClass: DOCUMENT_COLORS.indigo },
  [DomainSectionType.Navigation]: { icon: 'Route', colorClass: DOCUMENT_COLORS.navigation },
  [DomainSectionType.Vocabs]: { icon: 'BookOpen', colorClass: DOCUMENT_COLORS.teal },
  [DomainSectionType.I18nBundles]: { icon: 'Languages', colorClass: DOCUMENT_COLORS.amber },
  [DomainSectionType.AuthProfile]: { icon: 'KeyRound', colorClass: DOCUMENT_COLORS.sky },
  [DomainSectionType.Project]: { icon: 'Briefcase', colorClass: DOCUMENT_COLORS.sky },
}

export const FALLBACK_PRESENTATION: DomainDocumentPresentation = {
  icon: 'FileWarning',
  colorClass: DOCUMENT_COLORS.fallback,
}

export const DOCUMENT_AUXILIARY_PRESENTATION = {
  filterView: { icon: 'SlidersHorizontal', colorClass: DOCUMENT_COLORS.blue },
  scope: { icon: 'Layers3', colorClass: DOCUMENT_COLORS.slate },
  workspace: { icon: 'Building2', colorClass: DOCUMENT_COLORS.orange },
  tableColumn: { icon: 'Columns', colorClass: DOCUMENT_COLORS.sky },
  folder: { icon: 'Folder', colorClass: 'fill-current text-yellow-500 dark:text-slate-400' },
  derivedFolder: { icon: 'Folder', colorClass: 'fill-sky-500/30 text-sky-600 dark:text-sky-400' },
} as const satisfies Record<string, DomainDocumentPresentation>

export const DOCUMENT_TYPE_PRESENTATION: Readonly<Record<string, DomainDocumentPresentation>> = {
  stream: { icon: 'RadioTower', colorClass: DOCUMENT_COLORS.orange },
}

export const DOCUMENT_BADGE_ICONS: Readonly<Record<string, string>> = {
  [ComponentType.Table]: 'Table2',
  [ComponentType.DSL]: 'Braces',
}

export const DOCUMENT_SECTION_BY_TYPE: Readonly<Partial<Record<string, DomainSectionType>>> = {
  'primitive': DomainSectionType.Primitive,
  'type': DomainSectionType.Type,
  'data-view': DomainSectionType.DataView,
  'composition': DomainSectionType.Composition,
  'simulation': DomainSectionType.Simulation,
  'store': DomainSectionType.Store,
  'stream': DomainSectionType.Query,
  'update': DomainSectionType.Store,
  'mock': DomainSectionType.Mock,
  'action': DomainSectionType.Action,
  'converter': DomainSectionType.Converter,
  'computation': DomainSectionType.Computation,
  'integration': DomainSectionType.Integration,
  'environment': DomainSectionType.Environment,
  'tenant': DomainSectionType.Tenant,
  'policy': DomainSectionType.Policy,
  'style': DomainSectionType.Style,
  'configuration': DomainSectionType.Configuration,
  'page-template': DomainSectionType.PageTemplate,
  'page': DomainSectionType.Page,
  'navigation': DomainSectionType.Navigation,
  'vocabs': DomainSectionType.Vocabs,
  'i18n-bundles': DomainSectionType.I18nBundles,
  'auth-profile': DomainSectionType.AuthProfile,
  'project': DomainSectionType.Project,
  [ComponentType.Component]: DomainSectionType.Component,
  [ComponentType.DSL]: DomainSectionType.Component,
  [ComponentType.Table]: DomainSectionType.Component,
  [ComponentType.SFC]: DomainSectionType.Component,
  [QueryType.REST]: DomainSectionType.Query,
  [QueryType.GraphQL]: DomainSectionType.Query,
  [QueryType.Custom]: DomainSectionType.Query,
  [ParameterType.DefaultParameter]: DomainSectionType.Parameters,
  [FilterType.DefaultFilter]: DomainSectionType.Filters,
}

/** Размер зависит от поверхности, а символ и цвет остаются общими. */
export const DOCUMENT_ICON_SIZES = {
  tree: 'size-4',
  tab: 'size-4',
  workflowNode: 'size-4',
  workflowResource: 'size-16',
  workflowCompactResource: 'size-6',
  picker: 'size-5',
  pagePreview: 'size-3.5',
} as const

export const DOCUMENT_ICON_BADGE_SIZE = 'size-2.5'
export const DOCUMENT_ICON_STROKE_WIDTH = { normal: 2, resource: 1.5 } as const
