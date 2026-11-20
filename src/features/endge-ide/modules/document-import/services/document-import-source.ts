import type { DocumentImportFormat } from '@endge/core'
import type { EndgeIDEDocumentImportSource } from '@/features/endge-ide/modules/document-import/domain/types/document-import-ui.type'

import { createGraphQLIntrospectionQuery } from '@endge/core'

import { i18n } from '@/i18n/index'

const SCHEMA_REQUEST_TIMEOUT_MS = 15_000

export async function loadDocumentImportSource(
  format: DocumentImportFormat,
  input: string,
  signal: AbortSignal,
): Promise<EndgeIDEDocumentImportSource> {
  const url = parseSchemaUrl(input)
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(SCHEMA_REQUEST_TIMEOUT_MS)])

  try {
    const request: RequestInit = {
      credentials: 'omit',
      signal: requestSignal,
    }
    if (format === 'graphql') {
      request.method = 'POST'
      request.headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/graphql-response+json, application/json',
      }
      request.body = JSON.stringify({
        query: createGraphQLIntrospectionQuery(),
        operationName: 'IntrospectionQuery',
      })
    }

    const response = await fetch(url, request)
    if (!response.ok) {
      throw new Error(i18n.global.t('endgeIde.documentImport.urlErrors.http', { status: response.status }))
    }
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      throw new Error(i18n.global.t('endgeIde.documentImport.urlErrors.html'))
    }

    return {
      source: await response.text(),
      // Параметры запроса могут содержать секреты. Не передаём их в план импорта.
      sourceName: `${url.origin}${url.pathname}`,
    }
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(i18n.global.t('endgeIde.documentImport.urlErrors.timeout'))
    }
    if (error instanceof TypeError) {
      throw new Error(i18n.global.t('endgeIde.documentImport.urlErrors.network'))
    }
    throw error
  }
}

function parseSchemaUrl(input: string): URL {
  try {
    const url = new URL(input.trim())
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url
    }
  }
  catch {
    // Невалидный URL и неподдерживаемый протокол показывают одну подсказку.
  }
  throw new Error(i18n.global.t('endgeIde.documentImport.urlErrors.invalid'))
}
