import type {
  GraphQLResponseError,
  QueryExecutionObserver,
  QueryExecutionResponse,
  RQuery,
} from '@endge/core'
import type { QueryRunRequestPreview } from '@/features/endge-ide/services/query-run/query-request-redaction'

import { GraphQLQueryError, GraphQLResponseFormatError, normalizeGraphQLResponseError } from '@endge/core'

import { redactQueryRequest } from '@/features/endge-ide/services/query-run/query-request-redaction'

// Класс ошибки запуска для подписи в панели.
export type QueryRunErrorKind = 'compile' | 'graphql' | 'response-format' | 'transport' | 'runtime'

export interface QueryRunError {
  kind: QueryRunErrorKind
  name: string
  message: string
  // HTTP-статус ответа, если ошибка пришла от транспорта.
  status?: number
}

// Итог одного запуска Query в панели Configurator.
export interface QueryRunResult {
  status: 'success' | 'error'
  startedAt: string
  durationMs: number
  // false — HTTP-запрос не отправлялся (mock-данные или режим mock).
  requestSent: boolean
  request: QueryRunRequestPreview | null
  response: QueryExecutionResponse | null
  graphQLErrors: GraphQLResponseError[]
  outputs: Record<string, unknown> | null
  error: QueryRunError | null
}

export interface QueryRunnerDependencies {
  // Подготавливает Query домена и его artifact; ошибка означает, что запуск невозможен.
  prepare: () => RQuery
  // Выполняет Query через runtime core с наблюдателем запроса.
  execute: (query: RQuery, props: Record<string, unknown>, observer: QueryExecutionObserver) => Promise<unknown>
  now?: () => number
  clock?: () => Date
}

/**
 * Запускает Query через runtime core и собирает итог для панели: запрос без секретов,
 * сырой ответ, GraphQL errors и outputs. Никогда не бросает: любая ошибка входит в результат.
 */
export async function runQueryForPanel(
  dependencies: QueryRunnerDependencies,
  props: Record<string, unknown>,
): Promise<QueryRunResult> {
  const now = dependencies.now ?? (() => performance.now())
  const startedAt = (dependencies.clock?.() ?? new Date()).toISOString()
  const started = now()
  let request: QueryRunRequestPreview | null = null
  let response: QueryExecutionResponse | null = null
  const observer: QueryExecutionObserver = {
    onRequest: (value) => {
      request = redactQueryRequest(value)
    },
    onResponse: (value) => {
      response = value
    },
  }

  const finish = (patch: Pick<QueryRunResult, 'status' | 'outputs' | 'error'> & { thrown?: unknown }): QueryRunResult => {
    const finalRequest = request as QueryRunRequestPreview | null
    const finalResponse = response as QueryExecutionResponse | null
    return {
      status: patch.status,
      startedAt,
      durationMs: Math.max(0, Math.round(now() - started)),
      requestSent: finalRequest !== null,
      request: finalRequest,
      response: finalResponse,
      graphQLErrors: readGraphQLErrors(finalRequest, finalResponse, patch.thrown),
      outputs: patch.outputs,
      error: patch.error,
    }
  }

  let query: RQuery
  try {
    query = dependencies.prepare()
  }
  catch (error) {
    return finish({ status: 'error', outputs: null, error: toRunError(error, 'compile') })
  }

  try {
    const outputs = await dependencies.execute(query, props, observer)
    return finish({ status: 'success', outputs: normalizeOutputs(outputs), error: null })
  }
  catch (error) {
    return finish({ status: 'error', outputs: null, error: toRunError(error, classify(error, response)), thrown: error })
  }
}

function classify(error: unknown, response: QueryExecutionResponse | null): QueryRunErrorKind {
  if (error instanceof GraphQLQueryError || readName(error) === 'GraphQLQueryError') {
    return 'graphql'
  }
  if (error instanceof GraphQLResponseFormatError || readName(error) === 'GraphQLResponseFormatError') {
    return 'response-format'
  }
  if (response || /^HTTP(?:\s\d{3})?\b/.test(readMessage(error))) {
    return 'transport'
  }
  return 'runtime'
}

function toRunError(error: unknown, kind: QueryRunErrorKind): QueryRunError {
  const status = error && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined
  return {
    kind,
    name: readName(error) || 'Error',
    message: readMessage(error),
    ...(status !== undefined ? { status } : {}),
  }
}

/**
 * GraphQL errors для панели: из GraphQLQueryError (errorPolicy throw) или из сырого
 * ответа (ignore/all), чтобы их было видно при любой политике.
 */
function readGraphQLErrors(
  request: QueryRunRequestPreview | null,
  response: QueryExecutionResponse | null,
  thrown: unknown,
): GraphQLResponseError[] {
  if (thrown instanceof GraphQLQueryError || (readName(thrown) === 'GraphQLQueryError' && Array.isArray((thrown as { errors?: unknown }).errors))) {
    return [...(thrown as GraphQLQueryError).errors]
  }
  if (request?.protocol !== 'GraphQL' || !response) {
    return []
  }
  const body = response.data
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return []
  }
  const errors = (body as { errors?: unknown }).errors
  return Array.isArray(errors) ? errors.map(normalizeGraphQLResponseError) : []
}

function normalizeOutputs(outputs: unknown): Record<string, unknown> {
  return outputs && typeof outputs === 'object' && !Array.isArray(outputs)
    ? outputs as Record<string, unknown>
    : { result: outputs }
}

function readName(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string'
    ? (error as { name: string }).name
    : ''
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : JSON.stringify(error) ?? String(error)
}
