import type { GraphQLSchemaInput, GraphQLSchemaLoadResult, QueryProgramPayload } from '@endge/core'
import type { Ref } from 'vue'
import type {
  GraphQLSchemaCacheOrigin,
  GraphQLSchemaCacheRecord,
  GraphQLSchemaCacheScope,
  GraphQLSchemaCacheStorage,
} from '@/features/endge-ide/services/graphql-schema/graphql-schema-cache-repository'
import type { GraphQLCompletionSchema } from '@/features/endge-ide/services/graphql-schema/graphql-schema-completions'
import type { GraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

import { loadGraphQLSchema } from '@endge/core'
import { readonly, ref, shallowRef } from 'vue'

import { graphQLSchemaCacheKey } from '@/features/endge-ide/services/graphql-schema/graphql-schema-cache-repository'
import { createGraphQLIntrospectionPayload } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

// Загруженная схема GraphQL одного endpoint текущего backend и Workspace.
export interface GraphQLSchemaEntry {
  key: string
  endpoint: string
  schema: GraphQLCompletionSchema
  format: GraphQLSchemaLoadResult['format']
  origin: GraphQLSchemaCacheOrigin
  sourceName: string
  savedAt: string
  // Исходный текст (SDL или JSON introspection) для импорта Type.
  text: string
  typeCount: number
  // false — браузер не сохранил запись, схема живёт до перезагрузки.
  persisted: boolean
}

export interface EndgeIDEGraphQLSchemaDependencies {
  storage: GraphQLSchemaCacheStorage
  // Текущий backend и Workspace; null — Core context не загружен.
  scope: () => GraphQLSchemaCacheScope | null
  // Разрешает workspace tokens endpoint так же, как исполнитель Query.
  resolveEndpoint: (endpoint: string) => string
  // Выполняет payload через исполнитель core и возвращает data ответа.
  execute: (payload: QueryProgramPayload) => Promise<unknown>
  now?: () => Date
}

/**
 * Ошибка загрузки схемы с сообщением для пользователя.
 */
export class GraphQLSchemaLoadError extends Error {
  public constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'GraphQLSchemaLoadError'
  }
}

/**
 * Владеет локальным кэшем схем GraphQL для редакторов Query и Stream.
 * Схема привязана к backend + Workspace + разрешённому endpoint и не попадает в backend.
 */
export class EndgeIDEGraphQLSchema_Module {
  private readonly _entries = shallowRef<ReadonlyMap<string, GraphQLSchemaEntry>>(new Map())
  private readonly _loading = shallowRef<ReadonlySet<string>>(new Set())
  private readonly _revision = ref(0)
  // Ключи, для которых чтение из storage уже начато или завершено.
  private readonly _hydrated = new Set<string>()
  // Отсекает поздние асинхронные результаты после reset.
  private _generation = 0

  public constructor(private readonly _dependencies: EndgeIDEGraphQLSchemaDependencies) {}

  // ---------------------------------------------
  // PUBLIC API
  // ---------------------------------------------

  /**
   * Возвращает ключ кэша для статического endpoint документа.
   */
  public keyFor(target: GraphQLSchemaTarget | null): string | null {
    if (!target || target.dynamicEndpoint || !target.endpoint) {
      return null
    }
    const scope = this._dependencies.scope()
    if (!scope) {
      return null
    }
    return graphQLSchemaCacheKey(scope, this.resolveEndpoint(target))
  }

  /**
   * Возвращает разрешённый endpoint для подписи и ключа кэша.
   */
  public resolveEndpoint(target: GraphQLSchemaTarget): string {
    try {
      return this._dependencies.resolveEndpoint(target.endpoint) || target.endpoint
    }
    catch {
      return target.endpoint
    }
  }

  /**
   * Возвращает схему endpoint; при первом обращении асинхронно читает её из storage.
   */
  public entryFor(target: GraphQLSchemaTarget | null): GraphQLSchemaEntry | null {
    void this._revision.value
    const key = this.keyFor(target)
    if (!key) {
      return null
    }
    const entry = this._entries.value.get(key)
    if (!entry && !this._hydrated.has(key)) {
      void this._hydrate(key)
    }
    return entry ?? null
  }

  /**
   * Сообщает, выполняется ли загрузка схемы endpoint.
   */
  public isLoading(target: GraphQLSchemaTarget | null): boolean {
    const key = this.keyFor(target)
    return key ? this._loading.value.has(key) : false
  }

  /**
   * Выполняет introspection на endpoint документа с его auth и headers и сохраняет схему.
   */
  public async loadFromEndpoint(target: GraphQLSchemaTarget): Promise<GraphQLSchemaEntry> {
    const key = this._requireKey(target)
    const endpoint = this.resolveEndpoint(target)
    return this._withLoading(key, async () => {
      const data = await this._dependencies.execute(createGraphQLIntrospectionPayload(target))
      return this._store(key, endpoint, data, JSON.stringify(data), 'introspection', endpoint)
    })
  }

  /**
   * Сохраняет схему из SDL или JSON introspection, выбранного пользователем.
   */
  public async importText(target: GraphQLSchemaTarget, text: string, sourceName: string): Promise<GraphQLSchemaEntry> {
    const key = this._requireKey(target)
    const endpoint = this.resolveEndpoint(target)
    return this._withLoading(key, () => this._store(key, endpoint, text, text, 'file', sourceName))
  }

  /**
   * Удаляет сохранённую схему endpoint.
   */
  public async remove(target: GraphQLSchemaTarget): Promise<void> {
    const key = this._requireKey(target)
    const next = new Map(this._entries.value)
    next.delete(key)
    this._entries.value = next
    this._hydrated.add(key)
    this._bump()
    await this._dependencies.storage.remove(key)
  }

  /**
   * Освобождает схемы в памяти вместе с lifecycle EndgeIDE; storage сохраняется.
   */
  public reset(): void {
    this._generation += 1
    this._entries.value = new Map()
    this._loading.value = new Set()
    this._hydrated.clear()
    this._bump()
  }

  // ---------------------------------------------
  // PRIVATE
  // ---------------------------------------------

  private _requireKey(target: GraphQLSchemaTarget): string {
    const key = this.keyFor(target)
    if (!key) {
      throw new GraphQLSchemaLoadError(
        target.dynamicEndpoint
          ? 'Endpoint GraphQL вычисляется из props: схему можно привязать только к статическому endpoint.'
          : 'Не задан endpoint GraphQL или не загружен Workspace.',
        target.dynamicEndpoint ? 'graphql-schema-endpoint-dynamic' : 'graphql-schema-endpoint-missing',
      )
    }
    return key
  }

  private async _withLoading<T>(key: string, operation: () => Promise<T>): Promise<T> {
    this._loading.value = new Set([...this._loading.value, key])
    try {
      return await operation()
    }
    finally {
      const next = new Set(this._loading.value)
      next.delete(key)
      this._loading.value = next
    }
  }

  private async _store(
    key: string,
    endpoint: string,
    input: unknown,
    text: string,
    origin: GraphQLSchemaCacheOrigin,
    sourceName: string,
  ): Promise<GraphQLSchemaEntry> {
    const generation = this._generation
    const loaded = loadSchema(input)
    const record: GraphQLSchemaCacheRecord = {
      version: 1,
      endpoint,
      text,
      origin,
      sourceName,
      savedAt: (this._dependencies.now?.() ?? new Date()).toISOString(),
    }
    const persisted = await this._dependencies.storage.write(key, record)
    const entry = createEntry(key, record, loaded, persisted)
    if (generation === this._generation) {
      this._setEntry(entry)
    }
    return entry
  }

  private async _hydrate(key: string): Promise<void> {
    this._hydrated.add(key)
    const generation = this._generation
    const record = await this._dependencies.storage.read(key)
    if (!record || generation !== this._generation || this._entries.value.has(key)) {
      return
    }
    const loaded = loadGraphQLSchema(record.text)
    if (loaded.schema) {
      this._setEntry(createEntry(key, record, { ...loaded, schema: loaded.schema }, true))
    }
  }

  private _setEntry(entry: GraphQLSchemaEntry): void {
    this._hydrated.add(entry.key)
    this._entries.value = new Map(this._entries.value).set(entry.key, entry)
    this._bump()
  }

  private _bump(): void {
    this._revision.value += 1
  }

  // ---------------------------------------------
  // ACCESS
  // ---------------------------------------------

  /**
   * Счётчик изменений схем: редакторы перепроверяют документ при его изменении.
   */
  public get revision(): Readonly<Ref<number>> {
    return readonly(this._revision)
  }
}

function loadSchema(input: unknown): GraphQLSchemaLoadResult & { schema: GraphQLCompletionSchema } {
  const loaded = loadGraphQLSchema(input as GraphQLSchemaInput)
  if (!loaded.schema) {
    const diagnostic = loaded.diagnostics[0]
    throw new GraphQLSchemaLoadError(
      loaded.diagnostics.map(item => item.message).join('\n') || 'Схема GraphQL не распознана.',
      diagnostic?.code ?? 'graphql-schema-invalid',
    )
  }
  return loaded as GraphQLSchemaLoadResult & { schema: GraphQLCompletionSchema }
}

function createEntry(
  key: string,
  record: GraphQLSchemaCacheRecord,
  loaded: GraphQLSchemaLoadResult & { schema: GraphQLCompletionSchema },
  persisted: boolean,
): GraphQLSchemaEntry {
  return {
    key,
    endpoint: record.endpoint,
    schema: loaded.schema,
    format: loaded.format,
    origin: record.origin,
    sourceName: record.sourceName,
    savedAt: record.savedAt,
    text: record.text,
    typeCount: Object.keys(loaded.schema.getTypeMap()).filter(name => !name.startsWith('__')).length,
    persisted,
  }
}
