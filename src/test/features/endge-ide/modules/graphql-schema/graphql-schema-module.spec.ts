import type { QueryProgramPayload } from '@endge/core'
import type { GraphQLSchemaCacheRecord, GraphQLSchemaCacheStorage } from '@/features/endge-ide/services/graphql-schema/graphql-schema-cache-repository'
import type { GraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

import { Endge } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'

import { EndgeIDEGraphQLSchema_Module, GraphQLSchemaLoadError } from '@/features/endge-ide/modules/graphql-schema/EndgeIDEGraphQLSchema_Module'
import {
  graphQLSchemaCacheKey,
  GraphQLSchemaCacheRepository,
  isGraphQLSchemaCacheRecord,
} from '@/features/endge-ide/services/graphql-schema/graphql-schema-cache-repository'
import {
  createGraphQLIntrospectionPayload,
  resolveGraphQLSchemaTarget,
} from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'
import { TEST_GRAPHQL_SDL } from '@/test/features/endge-ide/services/graphql-schema/graphql-schema-fixture'

const QUERY_SOURCE = `defineQuery({
  kind: 'graphql',
  request: {
    endpoint: '{API_URL}/graphql',
    operationName: 'Load',
    document: gql\`query Load { user(id: "1") { id } }\`,
    headers: { 'X-Tenant': 'ou' },
    auth: { mode: 'profile', profile: 'keycloak-ou' },
    timeoutMs: 5000,
  },
  outputs: { user: output().from(data('user')) },
})`

const STREAM_SOURCE = `defineStream({
  transport: graphqlSse({
    url: 'https://graphql.example.test/stream',
    document: gql\`subscription { userChanged(id: "1") { id } }\`,
    auth: 'none',
  }),
  events: { next: event('user.changed') },
})`

class MemoryStorage implements GraphQLSchemaCacheStorage {
  public readonly records = new Map<string, GraphQLSchemaCacheRecord>()
  public persist = true

  public async read(key: string) {
    return this.records.get(key) ?? null
  }

  public async write(key: string, record: GraphQLSchemaCacheRecord) {
    if (this.persist) {
      this.records.set(key, record)
    }
    return this.persist
  }

  public async remove(key: string) {
    this.records.delete(key)
  }
}

function createModule(options: { storage?: MemoryStorage, execute?: (payload: QueryProgramPayload) => Promise<unknown>, workspace?: string } = {}) {
  const storage = options.storage ?? new MemoryStorage()
  const execute = vi.fn(options.execute ?? (async () => ({ __schema: null })))
  const module = new EndgeIDEGraphQLSchema_Module({
    storage,
    scope: () => ({ backendURL: 'https://backend.test', workspaceIdentity: options.workspace ?? 'ou' }),
    resolveEndpoint: endpoint => endpoint.replace('{API_URL}', 'https://api.test'),
    execute,
    now: () => new Date('2026-10-26T12:00:00.000Z'),
  })
  return { module, storage, execute }
}

function staticTarget(endpoint = 'https://api.test/graphql'): GraphQLSchemaTarget {
  return { sourceKind: 'query', endpoint, dynamicEndpoint: false, request: { endpoint, headers: {}, auth: { mode: 'none' } } }
}

// Минимальный ответ introspection endpoint ({ __schema }) — data, которую возвращает исполнитель Query.
const INTROSPECTION_DATA = {
  __schema: {
    queryType: { name: 'Query' },
    mutationType: null,
    subscriptionType: null,
    directives: [],
    types: [
      {
        kind: 'OBJECT',
        name: 'Query',
        description: null,
        fields: [{
          name: 'hello',
          description: 'Приветствие',
          args: [],
          type: { kind: 'SCALAR', name: 'String', ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        }],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      { kind: 'SCALAR', name: 'String', description: null, fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null },
    ],
  },
}

/**
 * Endpoint и транспорт документа определяются из текущего Source без сети:
 * introspection идёт тем же путём, что и запрос Query (endpoint, headers, auth).
 */
describe('определение GraphQL endpoint документа', () => {
  it('для GraphQL Query берёт endpoint, headers, auth и timeout из request', () => {
    const target = resolveGraphQLSchemaTarget(Endge.source, 'query', QUERY_SOURCE)
    expect(target).toMatchObject({
      sourceKind: 'query',
      endpoint: '{API_URL}/graphql',
      dynamicEndpoint: false,
      request: { endpoint: '{API_URL}/graphql', auth: { mode: 'profile', profile: 'keycloak-ou' }, timeoutMs: 5000 },
    })
    const payload = createGraphQLIntrospectionPayload(target!)
    expect(payload).toMatchObject({
      type: 'query-gql',
      endpoint: '{API_URL}/graphql',
      operationName: 'IntrospectionQuery',
      errorPolicy: 'throw',
      mockDataEnabled: false,
      requestVariables: null,
    })
    expect(String(payload.query)).toContain('__schema')
  })

  it('для Stream graphqlSse берёт url и режим auth транспорта', () => {
    const target = resolveGraphQLSchemaTarget(Endge.source, 'stream', STREAM_SOURCE)
    expect(target).toMatchObject({
      sourceKind: 'stream',
      endpoint: 'https://graphql.example.test/stream',
      request: { auth: { mode: 'none' } },
    })
  })

  it('у REST Query и Stream без graphqlSse не имеют схемы; endpoint из props помечается как динамический', () => {
    expect(resolveGraphQLSchemaTarget(Endge.source, 'query', Endge.source.createDefault('query', 'rest'))).toBeNull()
    expect(resolveGraphQLSchemaTarget({ compile: () => ({ document: { transport: { kind: 'sse' } } }) }, 'stream', '')).toBeNull()
    const dynamic = resolveGraphQLSchemaTarget(
      { compile: () => ({ document: { kind: 'graphql', request: { endpoint: { type: 'prop', key: 'url' }, headers: {}, auth: { mode: 'inherit' } } } }) },
      'query',
      '',
    )
    expect(dynamic).toMatchObject({ dynamicEndpoint: true, endpoint: '' })
  })
})

/**
 * Кэш схем принадлежит IDE Module: ключ — backend + Workspace + разрешённый endpoint,
 * запись переживает reset (перезагрузку IDE), а ошибки схемы не попадают в storage.
 */
describe('модуль схем GraphQL Configurator', () => {
  it('загружает схему introspection через исполнитель и сохраняет её локально', async () => {
    const { module, storage, execute } = createModule({ execute: async () => INTROSPECTION_DATA })
    const target = resolveGraphQLSchemaTarget(Endge.source, 'query', QUERY_SOURCE)!
    const entry = await module.loadFromEndpoint(target)

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ type: 'query-gql', operationName: 'IntrospectionQuery' }))
    expect(entry).toMatchObject({ endpoint: 'https://api.test/graphql', origin: 'introspection', format: 'introspection', persisted: true })
    expect(entry.typeCount).toBeGreaterThanOrEqual(2)
    const key = graphQLSchemaCacheKey({ backendURL: 'https://backend.test', workspaceIdentity: 'ou' }, 'https://api.test/graphql')
    expect(storage.records.get(key)).toMatchObject({ origin: 'introspection', savedAt: '2026-10-26T12:00:00.000Z' })
    expect(module.entryFor(target)?.schema.getType('Query')).toBeTruthy()
    expect(JSON.parse(storage.records.get(key)!.text)).toEqual(INTROSPECTION_DATA)
  })

  it('импортирует SDL из файла и восстанавливает схему из storage после reset', async () => {
    const storage = new MemoryStorage()
    const { module } = createModule({ storage })
    const target = staticTarget()
    await module.importText(target, TEST_GRAPHQL_SDL, 'schema.graphql')

    module.reset()
    expect(module.entryFor(target)).toBeNull()
    await vi.waitFor(() => expect(module.entryFor(target)).not.toBeNull())
    expect(module.entryFor(target)).toMatchObject({ origin: 'file', sourceName: 'schema.graphql', format: 'sdl' })
  })

  it('не сохраняет некорректную схему и сообщает ошибку core', async () => {
    const { module, storage } = createModule({ execute: async () => ({ data: null, errors: [{ message: 'introspection disabled' }] }) })
    await expect(module.loadFromEndpoint(staticTarget())).rejects.toThrow('introspection disabled')
    await expect(module.importText(staticTarget(), 'type Query {', 'broken.graphql')).rejects.toBeInstanceOf(GraphQLSchemaLoadError)
    expect(storage.records.size).toBe(0)
    expect(module.isLoading(staticTarget())).toBe(false)
  })

  it('разделяет схемы по Workspace и не принимает динамический endpoint', async () => {
    const storage = new MemoryStorage()
    const first = createModule({ storage, workspace: 'ou' }).module
    const second = createModule({ storage, workspace: 'other' }).module
    await first.importText(staticTarget(), TEST_GRAPHQL_SDL, 'schema.graphql')
    second.entryFor(staticTarget())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(second.entryFor(staticTarget())).toBeNull()
    await expect(first.loadFromEndpoint({ ...staticTarget(''), dynamicEndpoint: true }))
      .rejects
      .toMatchObject({ code: 'graphql-schema-endpoint-dynamic' })
  })

  it('удаление схемы очищает память и storage; без браузерного storage схема остаётся в памяти', async () => {
    const storage = new MemoryStorage()
    const { module } = createModule({ storage })
    await module.importText(staticTarget(), TEST_GRAPHQL_SDL, 'schema.graphql')
    await module.remove(staticTarget())
    expect(module.entryFor(staticTarget())).toBeNull()
    expect(storage.records.size).toBe(0)

    storage.persist = false
    const entry = await module.importText(staticTarget(), TEST_GRAPHQL_SDL, 'schema.graphql')
    expect(entry.persisted).toBe(false)
    expect(module.entryFor(staticTarget())).not.toBeNull()
  })

  it('repository без IndexedDB работает в памяти и отбрасывает повреждённые записи', async () => {
    const repository = new GraphQLSchemaCacheRepository(() => undefined)
    const record: GraphQLSchemaCacheRecord = {
      version: 1,
      endpoint: 'https://api.test/graphql',
      text: TEST_GRAPHQL_SDL,
      origin: 'file',
      sourceName: 'schema.graphql',
      savedAt: '2026-10-26T12:00:00.000Z',
    }
    expect(await repository.write('key', record)).toBe(false)
    expect(await repository.read('key')).toEqual(record)
    await repository.remove('key')
    expect(await repository.read('key')).toBeNull()
    expect(isGraphQLSchemaCacheRecord({ ...record, version: 2 })).toBe(false)
  })
})
