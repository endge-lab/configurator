import type { DomainDocumentType } from '@endge/core'

import { ComponentType, Endge, FilterType, ParameterType } from '@endge/core'

import { getDomainDocumentPresentation } from '@/features/endge-ide/model/domain/domain-document-presentation'

export interface ResolvedDomainEntityPresentation {
  title: string
  identity: string
  documentType: DomainDocumentType
  icon: string
  colorClass: string
  badgeIcon: string | null
}

export function resolveDomainEntityPresentation(
  documentType: DomainDocumentType,
  identity: string,
  presentationKind?: string,
): ResolvedDomainEntityPresentation {
  const normalizedIdentity = String(identity ?? '').trim()
  const visual = getDomainDocumentPresentation(documentType, presentationKind)
  return {
    title: getDomainDocumentLabel(normalizedIdentity, documentType),
    identity: normalizedIdentity,
    documentType,
    icon: visual.icon,
    colorClass: visual.colorClass,
    badgeIcon: visual.badgeIcon ?? null,
  }
}

export function getDomainDocumentLabel(id: string, docType: DomainDocumentType): string {
  const key = String(docType)
  if (key === String(ComponentType.Table) || key === String(ComponentType.DSL)) {
    return Endge.domain.getComponent(id)?.name ?? id
  }
  if (key === String(ComponentType.SFC)) {
    const component = Endge.domain.getComponentSFC(id)
    return component?.displayName ?? component?.name ?? id
  }
  if (key.startsWith('query-')) {
    const query = Endge.domain.getQuery(id)
    return query?.displayName ?? query?.name ?? id
  }
  if (key === 'data-view') {
    const dataView = Endge.domain.getDataView(id)
    return dataView?.displayName ?? dataView?.name ?? id
  }
  if (key === 'composition') {
    const composition = Endge.domain.getComposition(id)
    return composition?.displayName ?? composition?.name ?? id
  }
  if (key === 'store') {
    const store = Endge.domain.getStore(id)
    return store?.displayName ?? store?.name ?? id
  }
  if (key === 'mock') {
    const mock = Endge.domain.getMock(id)
    return mock?.displayName ?? mock?.name ?? id
  }
  if (key === 'type' || key === 'primitive') {
    return Endge.domain.getType(id)?.name ?? id
  }
  if (key === 'action') {
    const action = Endge.domain.getAction(id)
    return action?.displayName ?? action?.name ?? id
  }
  if (key === String(ParameterType.DefaultParameter)) {
    return Endge.domain.getParameter(id)?.displayName ?? id
  }
  if (key === String(FilterType.DefaultFilter)) {
    return Endge.domain.getFilter(id)?.displayName ?? id
  }
  if (key === 'converter') {
    return Endge.domain.getConverter(id)?.name ?? id
  }
  if (key === 'computation') {
    const computation = Endge.domain.getComputation(id)
    return computation?.displayName ?? computation?.name ?? id
  }
  if (key === 'integration') {
    return Endge.domain.getIntegration(id)?.name ?? id
  }
  if (key === 'environment') {
    return Endge.domain.getEnvironment(id)?.name ?? id
  }
  if (key === 'tenant') {
    const tenant = Endge.domain.getTenant(id)
    return tenant?.displayName ?? tenant?.name ?? id
  }
  if (key === 'policy') {
    return Endge.domain.getPolicy(id)?.name ?? id
  }
  if (key === 'style') {
    return Endge.domain.getStyle(id)?.name ?? id
  }
  if (key === 'vocabs') {
    const vocab = Endge.domain.getVocab(id)
    return vocab?.displayName ?? vocab?.name ?? id
  }
  if (key === 'auth-profile') {
    const profile = Endge.domain.getAuthProfile(id)
    return profile?.displayName ?? profile?.name ?? id
  }
  if (key === 'i18n-bundles') {
    const bundle = Endge.domain.getI18nBundle(id)
    return bundle?.displayName ?? bundle?.name ?? id
  }
  if (key === 'page-template') {
    return Endge.domain.getPageTemplate(id)?.name ?? id
  }
  if (key === 'page') {
    return Endge.domain.getPage(id)?.name ?? id
  }
  if (key === 'navigation') {
    return Endge.domain.getNavigation(id)?.name ?? id
  }
  if (key === 'project') {
    const project = Endge.domain.getProject(id)
    return project?.displayName ?? project?.name ?? id
  }
  return id
}
