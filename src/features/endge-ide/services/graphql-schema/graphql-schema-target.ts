import type {
  QueryProgramPayload,
  QuerySourceDocument,
  StreamSourceDocument,
} from '@endge/core'

import { createGraphQLIntrospectionQuery } from '@endge/core'

// Source-kinds, у которых есть GraphQL document: Query kind 'graphql' и Stream transport graphqlSse.
export type GraphQLSchemaSourceKind = 'query' | 'stream'

// Endpoint и транспортные настройки GraphQL-документа, достаточные для introspection.
export interface GraphQLSchemaTarget {
  sourceKind: GraphQLSchemaSourceKind
  // Endpoint в записи Source: строка или workspace token вида {API_URL}/graphql.
  endpoint: string
  // Endpoint вычисляется из props: схему нельзя привязать к статическому адресу.
  dynamicEndpoint: boolean
  request: Pick<QueryProgramPayload, 'endpoint' | 'headers' | 'auth' | 'timeoutMs'>
}

interface SourceCompiler {
  compile: (sourceKind: string, source: string) => { document?: unknown }
}

/**
 * Определяет GraphQL endpoint Query/Stream по текущему тексту Source без сети.
 * Компилятор возвращает document и при ошибках, поэтому незаконченный document не мешает загрузке схемы.
 */
export function resolveGraphQLSchemaTarget(
  compiler: SourceCompiler,
  sourceKind: GraphQLSchemaSourceKind,
  source: string,
): GraphQLSchemaTarget | null {
  let document: unknown
  try {
    document = compiler.compile(sourceKind, source).document
  }
  catch {
    return null
  }
  if (!document || typeof document !== 'object') {
    return null
  }
  if (sourceKind === 'query') {
    const query = document as QuerySourceDocument
    if (query.kind !== 'graphql') {
      return null
    }
    return createTarget(sourceKind, query.request.endpoint, {
      endpoint: query.request.endpoint,
      headers: query.request.headers,
      auth: query.request.auth,
      timeoutMs: query.request.timeoutMs,
    })
  }
  const transport = (document as StreamSourceDocument).transport
  if (!transport || transport.kind !== 'graphql-sse') {
    return null
  }
  // url из props (`urlExpression`) — динамический endpoint, схему к нему не привязать.
  return createTarget(sourceKind, transport.urlExpression ?? transport.url, {
    endpoint: transport.url,
    headers: transport.headers ?? {},
    auth: transport.authMode === 'profile'
      ? { mode: 'profile', profile: transport.authProfileIdentity ?? '' }
      : { mode: transport.authMode },
  })
}

/**
 * Собирает одноразовый query-gql payload introspection для существующего исполнителя core.
 */
export function createGraphQLIntrospectionPayload(target: GraphQLSchemaTarget): QueryProgramPayload {
  return {
    sourceVersion: 2,
    type: 'query-gql',
    endpoint: target.request.endpoint,
    query: createGraphQLIntrospectionQuery(),
    operationName: 'IntrospectionQuery',
    errorPolicy: 'throw',
    headers: target.request.headers,
    auth: target.request.auth,
    timeoutMs: target.request.timeoutMs,
    props: [],
    requestBody: null,
    requestVariables: null,
    mockDataEnabled: false,
    outputs: [],
  }
}

function createTarget(
  sourceKind: GraphQLSchemaSourceKind,
  endpoint: unknown,
  request: GraphQLSchemaTarget['request'],
): GraphQLSchemaTarget | null {
  if (typeof endpoint === 'string') {
    const trimmed = endpoint.trim()
    return trimmed ? { sourceKind, endpoint: trimmed, dynamicEndpoint: false, request } : null
  }
  return endpoint ? { sourceKind, endpoint: '', dynamicEndpoint: true, request } : null
}
