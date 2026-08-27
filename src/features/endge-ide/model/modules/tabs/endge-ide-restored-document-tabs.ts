import type { DomainDocumentType } from '@endge/core'
import type { SmartTabRef } from '@/components/ui/smart-tabs/types'

// Restored document resolution is private to the tabs module.

import { ComponentType, Endge, FilterType, ParameterType, QueryType } from '@endge/core'

export const ENDGE_IDE_DOCUMENT_VIEW_ID = 'endge-document-editor' as const

interface PersistedDocumentTabPayload {
  documentId?: unknown
  documentType?: unknown
}

const DOCUMENT_LOOKUPS: ReadonlyMap<string, (documentId: string) => unknown> = new Map<string, (documentId: string) => unknown>([
  [String(ComponentType.Table), documentId => Endge.domain.getComponent(documentId)],
  [String(ComponentType.DSL), documentId => Endge.domain.getComponent(documentId)],
  [String(ComponentType.SFC), documentId => Endge.domain.getComponentSFC(documentId)],
  [String(QueryType.REST), documentId => Endge.domain.getQuery(documentId)],
  [String(QueryType.GraphQL), documentId => Endge.domain.getQuery(documentId)],
  [String(QueryType.Custom), documentId => Endge.domain.getQuery(documentId)],
  ['data-view', documentId => Endge.domain.getDataView(documentId)],
  ['composition', documentId => Endge.domain.getComposition(documentId)],
  ['store', documentId => Endge.domain.getStore(documentId)],
  ['stream', documentId => Endge.domain.getStream(documentId)],
  ['update', documentId => Endge.domain.getUpdate(documentId)],
  ['mock', documentId => Endge.domain.getMock(documentId)],
  ['action', documentId => Endge.domain.getAction(documentId)],
  [String(ParameterType.DefaultParameter), documentId => Endge.domain.getParameter(documentId)],
  [String(FilterType.DefaultFilter), documentId => Endge.domain.getFilter(documentId)],
  ['converter', documentId => Endge.domain.getConverter(documentId)],
  ['computation', documentId => Endge.domain.getComputation(documentId)],
  ['integration', documentId => Endge.domain.getIntegration(documentId)],
  ['environment', documentId => Endge.domain.getEnvironment(documentId)],
  ['tenant', documentId => Endge.domain.getTenant(documentId)],
  ['policy', documentId => Endge.domain.getPolicy(documentId)],
  ['style', documentId => Endge.domain.getStyle(documentId)],
  ['configuration', documentId => Endge.domain.getConfiguration(documentId)],
  ['vocabs', documentId => Endge.domain.getVocab(documentId)],
  ['auth-profile', documentId => Endge.domain.getAuthProfile(documentId)],
  ['i18n-bundles', documentId => Endge.domain.getI18nBundle(documentId)],
  ['page-template', documentId => Endge.domain.getPageTemplate(documentId)],
  ['page', documentId => Endge.domain.getPage(documentId)],
  ['navigation', documentId => Endge.domain.getNavigation(documentId)],
  ['project', documentId => Endge.domain.getProject(documentId)],
  ['type', documentId => Endge.domain.getType(documentId)],
])

/** Возвращает текущий domain-документ по identity или storage id. */
export function resolveEndgeIDEDocument(
  documentId: string | number,
  documentType: DomainDocumentType,
): unknown {
  const normalizedId = String(documentId ?? '').trim()
  if (!normalizedId) {
    return null
  }
  return DOCUMENT_LOOKUPS.get(String(documentType))?.(normalizedId) ?? null
}

/** Нормализует Payload id/identity документа в стабильный identity для ключа вкладки. */
export function resolveEndgeIDEDocumentIdentity(
  documentId: string | number,
  documentType: DomainDocumentType,
): string {
  const normalizedId = String(documentId ?? '').trim()
  if (!normalizedId) {
    return ''
  }

  const document = resolveEndgeIDEDocument(normalizedId, documentType) as { identity?: unknown } | null
  const identity = String(document?.identity ?? '').trim()
  return identity || normalizedId
}

/** Возвращает id восстановленных document-вкладок, отсутствующих в загруженном домене. */
export function getMissingDocumentTabIds(tabs: readonly SmartTabRef[]): string[] {
  const missingTabIds: string[] = []
  for (const tab of tabs) {
    if (tab.viewId !== ENDGE_IDE_DOCUMENT_VIEW_ID) {
      continue
    }
    const payload = tab.payload as PersistedDocumentTabPayload | undefined
    const documentId = typeof payload?.documentId === 'string' ? payload.documentId.trim() : ''
    const documentType = typeof payload?.documentType === 'string' ? payload.documentType : ''
    if (!documentId || !DOCUMENT_LOOKUPS.has(documentType) || resolveEndgeIDEDocument(documentId, documentType as DomainDocumentType) == null) {
      missingTabIds.push(tab.id)
    }
  }
  return missingTabIds
}
