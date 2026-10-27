import type { QueryExecutionRequest, RQuery } from '@endge/core'
import type { QueryRunnerDependencies } from '@/features/endge-ide/services/query-run/query-runner'

import { GraphQLQueryError, GraphQLResponseFormatError } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'

import {
  isSecretRequestName,
  QUERY_RUN_REDACTED,
  redactQueryRequest,
} from '@/features/endge-ide/services/query-run/query-request-redaction'
import { runQueryForPanel } from '@/features/endge-ide/services/query-run/query-runner'

const query = { id: 1, identity: 'items' } as unknown as RQuery

function graphQLRequest(overrides: Partial<QueryExecutionRequest> = {}): QueryExecutionRequest {
  return {
    protocol: 'GraphQL',
    method: 'POST',
    url: 'https://graphql.example.test/graphql',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret-token', 'X-Tenant': 'ou' },
    params: {},
    body: { query: 'query Item { item { id } }', operationName: 'Item', variables: { id: 'a' } },
    operationName: 'Item',
    authHeaders: ['Authorization'],
    authParams: [],
    ...overrides,
  }
}

function dependencies(execute: QueryRunnerDependencies['execute']): QueryRunnerDependencies {
  let time = 100
  return {
    prepare: () => query,
    execute,
    now: () => (time += 25),
    clock: () => new Date('2026-10-26T10:00:00.000Z'),
  }
}

describe('скрытие секретов в итоговом запросе', () => {
  it('скрывает auth-заголовки, заголовки и параметры с секретными именами и параметры URL', () => {
    const preview = redactQueryRequest(graphQLRequest({
      url: 'https://user:pass@api.example.test/items?api_key=k1&page=2',
      headers: {
        'Authorization': 'Bearer secret-token',
        'X-Custom-Auth': 'custom-secret',
        'Cookie': 'sid=1',
        'X-Api-Key': 'k2',
        'X-Tenant': 'ou',
      },
      params: { access_token: 't', limit: 5 },
      authHeaders: ['X-Custom-Auth'],
      authParams: ['access_token'],
    }))

    expect(preview.headers).toEqual({
      'Authorization': `Bearer ${QUERY_RUN_REDACTED}`,
      'X-Custom-Auth': QUERY_RUN_REDACTED,
      'Cookie': QUERY_RUN_REDACTED,
      'X-Api-Key': QUERY_RUN_REDACTED,
      'X-Tenant': 'ou',
    })
    expect(preview.params).toEqual({ access_token: QUERY_RUN_REDACTED, limit: 5 })
    expect(preview.url).not.toContain('k1')
    expect(preview.url).not.toContain('pass')
    expect(new URL(preview.url).searchParams.get('page')).toBe('2')
    expect(JSON.stringify(preview)).not.toMatch(/secret-token|custom-secret|sid=1|"k2"/)
    expect(preview.redacted).toEqual(expect.arrayContaining(['Authorization', 'X-Custom-Auth', 'access_token', 'api_key']))
  })

  it('не считает обычные имена секретами', () => {
    expect(['Content-Type', 'X-Tenant', 'author', 'key', 'X-Request-Id', 'flightId', 'authorName'].filter(isSecretRequestName)).toEqual([])
    expect(['X-Auth-Token', 'client_secret', 'X-CSRF-Token', 'password', 'clientSecret', 'userPassword', 'apiKey'].every(isSecretRequestName)).toBe(true)
  })

  it('маскирует секретоподобные ключи GraphQL variables и тела на любой глубине', () => {
    const preview = redactQueryRequest(graphQLRequest({
      body: {
        query: 'mutation Login($password: String!) { login(password: $password) { id } }',
        operationName: 'Login',
        variables: { login: 'egor', password: 'p@ss', filter: { apiKey: 'k3', items: [{ refreshToken: 'r1', id: 1 }] } },
      },
    }))
    expect(preview.body).toEqual({
      query: 'mutation Login($password: String!) { login(password: $password) { id } }',
      operationName: 'Login',
      variables: { login: 'egor', password: QUERY_RUN_REDACTED, filter: { apiKey: QUERY_RUN_REDACTED, items: [{ refreshToken: QUERY_RUN_REDACTED, id: 1 }] } },
    })
    expect(preview.redacted).toEqual(expect.arrayContaining(['variables.password', 'variables.filter.apiKey', 'variables.filter.items[0].refreshToken']))

    const rest = redactQueryRequest(graphQLRequest({ protocol: 'REST', body: JSON.stringify({ name: 'a', client_secret: 's1' }) }))
    expect(JSON.parse(String(rest.body))).toEqual({ name: 'a', client_secret: QUERY_RUN_REDACTED })
    const plain = redactQueryRequest(graphQLRequest({ protocol: 'REST', body: 'token=abc' }))
    expect(plain.body).toBe('token=abc')
    const form = redactQueryRequest(graphQLRequest({ protocol: 'REST', body: new URLSearchParams({ password: 'x', user: 'u' }) }))
    expect(form.body).toEqual({ password: QUERY_RUN_REDACTED, user: 'u' })
    expect(form.redacted).toContain('password')
  })
})

describe('запуск Query для панели', () => {
  it('собирает запрос без секретов, сырой ответ, outputs и длительность', async () => {
    const execute = vi.fn<QueryRunnerDependencies['execute']>(async (_query, _props, observer) => {
      observer.onRequest?.(graphQLRequest())
      observer.onResponse?.({ status: 200, headers: {}, data: { data: { item: { id: 'a' } } } })
      return { item: { id: 'a' } }
    })

    const result = await runQueryForPanel(dependencies(execute), { id: 'a' })

    expect(execute).toHaveBeenCalledWith(query, { id: 'a' }, expect.any(Object))
    expect(result).toMatchObject({
      status: 'success',
      startedAt: '2026-10-26T10:00:00.000Z',
      durationMs: 25,
      requestSent: true,
      response: { status: 200, data: { data: { item: { id: 'a' } } } },
      outputs: { item: { id: 'a' } },
      graphQLErrors: [],
      error: null,
    })
    expect(result.request?.headers.Authorization).toBe(`Bearer ${QUERY_RUN_REDACTED}`)
  })

  it('показывает GraphQL errors из сырого ответа при errorPolicy all/ignore', async () => {
    const errors = [{ message: 'Owner hidden', path: ['item', 'owner'], extensions: { code: 'FORBIDDEN' } }]
    const result = await runQueryForPanel(dependencies(async (_query, _props, observer) => {
      observer.onRequest?.(graphQLRequest())
      observer.onResponse?.({ status: 200, headers: {}, data: { data: { item: null }, errors } })
      return { item: null }
    }), {})

    expect(result.status).toBe('success')
    expect(result.graphQLErrors).toEqual(errors)
  })

  it('возвращает GraphQLQueryError с path и extensions без исключения', async () => {
    const errors = [{ message: 'Owner hidden', path: ['item', 'owner'], extensions: { code: 'FORBIDDEN' } }]
    const result = await runQueryForPanel(dependencies(async (_query, _props, observer) => {
      observer.onRequest?.(graphQLRequest())
      observer.onResponse?.({ status: 200, headers: {}, data: { data: { item: null }, errors } })
      throw new GraphQLQueryError(errors, { item: null }, { url: 'https://graphql.example.test/graphql', status: 200 })
    }), {})

    expect(result.status).toBe('error')
    expect(result.error).toMatchObject({ kind: 'graphql', name: 'GraphQLQueryError', status: 200 })
    expect(result.graphQLErrors).toEqual(errors)
    expect(result.outputs).toBeNull()
  })

  it('классифицирует ошибку транспорта с ответом и некорректный ответ GraphQL', async () => {
    const transport = await runQueryForPanel(dependencies(async (_query, _props, observer) => {
      observer.onRequest?.(graphQLRequest({ protocol: 'REST', method: 'GET', body: undefined }))
      observer.onResponse?.({ status: 503, headers: {}, data: 'down' })
      throw new Error('HTTP 503 Service Unavailable at https://rest.example.test\n"down"')
    }), {})
    const network = await runQueryForPanel(dependencies(async () => {
      throw new Error('HTTP error at https://rest.example.test\n{}')
    }), {})
    const format = await runQueryForPanel(dependencies(async () => {
      throw new GraphQLResponseFormatError('response is not JSON', { url: 'https://graphql.example.test', status: 200 })
    }), {})

    expect(transport.error?.kind).toBe('transport')
    expect(transport.response?.status).toBe(503)
    expect(network.error?.kind).toBe('transport')
    expect(network.requestSent).toBe(false)
    expect(format.error?.kind).toBe('response-format')
  })

  it('сообщает ошибку подготовки и не выполняет запрос', async () => {
    const execute = vi.fn()
    const result = await runQueryForPanel({
      prepare: () => {
        throw new Error('Query artifact has compile errors')
      },
      execute,
    }, {})

    expect(execute).not.toHaveBeenCalled()
    expect(result.error).toMatchObject({ kind: 'compile', message: 'Query artifact has compile errors' })
  })

  it('отмечает запуск без HTTP-запроса (mock)', async () => {
    const result = await runQueryForPanel(dependencies(async () => ({ raw: [1] })), {})

    expect(result).toMatchObject({ status: 'success', requestSent: false, request: null, response: null })
  })
})
