import type { IDBPDatabase } from 'idb'

import { openDB } from 'idb'

// Origin сохранённой схемы: introspection endpoint или файл пользователя.
export type GraphQLSchemaCacheOrigin = 'introspection' | 'file'

// Локальная запись схемы GraphQL; backend не участвует.
export interface GraphQLSchemaCacheRecord {
  version: 1
  // Разрешённый endpoint, к которому относится схема.
  endpoint: string
  // SDL или JSON introspection в исходном виде; core loadGraphQLSchema принимает оба.
  text: string
  origin: GraphQLSchemaCacheOrigin
  // Имя файла или endpoint для подписи в UI.
  sourceName: string
  // ISO-время сохранения.
  savedAt: string
}

// Область кэша: схемы разных backend и Workspace не смешиваются.
export interface GraphQLSchemaCacheScope {
  backendURL: string
  workspaceIdentity: string
}

// Асинхронное локальное хранилище схем; ошибки браузерного storage не прерывают редактор.
export interface GraphQLSchemaCacheStorage {
  read: (key: string) => Promise<GraphQLSchemaCacheRecord | null>
  // Возвращает false, если запись сохранена только в памяти текущей сессии.
  write: (key: string, record: GraphQLSchemaCacheRecord) => Promise<boolean>
  remove: (key: string) => Promise<void>
}

export const GRAPHQL_SCHEMA_CACHE_DATABASE = 'endge-ide-graphql-schemas'
const STORE_NAME = 'schemas'
const KEY_PREFIX = 'endge-ide:graphql-schema:v1'

/**
 * Строит ключ кэша по backend, Workspace и разрешённому endpoint.
 */
export function graphQLSchemaCacheKey(scope: GraphQLSchemaCacheScope, endpoint: string): string {
  const backend = scope.backendURL.trim() || 'detached'
  const workspace = scope.workspaceIdentity.trim() || 'detached'
  return `${KEY_PREFIX}:${encodeURIComponent(backend)}:${encodeURIComponent(workspace)}:${encodeURIComponent(endpoint.trim())}`
}

/**
 * Проверяет форму прочитанной записи: повреждённые данные считаются отсутствующими.
 */
export function isGraphQLSchemaCacheRecord(value: unknown): value is GraphQLSchemaCacheRecord {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Partial<GraphQLSchemaCacheRecord>
  return record.version === 1
    && typeof record.endpoint === 'string'
    && typeof record.text === 'string'
    && (record.origin === 'introspection' || record.origin === 'file')
    && typeof record.sourceName === 'string'
    && typeof record.savedAt === 'string'
}

/**
 * Хранит схемы в IndexedDB: introspection больших схем не помещается в общий localStorage origin.
 * Без IndexedDB (тесты, приватный режим) записи живут в памяти текущей сессии.
 */
export class GraphQLSchemaCacheRepository implements GraphQLSchemaCacheStorage {
  private readonly _memory = new Map<string, GraphQLSchemaCacheRecord>()
  private _database: Promise<IDBPDatabase | null> | null = null

  public constructor(private readonly _indexedDB: () => IDBFactory | undefined = defaultIndexedDB) {}

  public async read(key: string): Promise<GraphQLSchemaCacheRecord | null> {
    const memory = this._memory.get(key)
    if (memory) {
      return memory
    }
    const database = await this._open()
    if (!database) {
      return null
    }
    try {
      const value: unknown = await database.get(STORE_NAME, key)
      return isGraphQLSchemaCacheRecord(value) ? value : null
    }
    catch {
      return null
    }
  }

  public async write(key: string, record: GraphQLSchemaCacheRecord): Promise<boolean> {
    this._memory.set(key, record)
    const database = await this._open()
    if (!database) {
      return false
    }
    try {
      await database.put(STORE_NAME, record, key)
      return true
    }
    catch {
      return false
    }
  }

  public async remove(key: string): Promise<void> {
    this._memory.delete(key)
    const database = await this._open()
    try {
      await database?.delete(STORE_NAME, key)
    }
    catch {
      // Недоступный storage не должен блокировать очистку в памяти.
    }
  }

  private _open(): Promise<IDBPDatabase | null> {
    this._database ??= this._openDatabase()
    return this._database
  }

  private async _openDatabase(): Promise<IDBPDatabase | null> {
    const factory = this._indexedDB()
    if (!factory) {
      return null
    }
    try {
      const opened = await openDB(GRAPHQL_SCHEMA_CACHE_DATABASE, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME)
          }
        },
        // Удаление базы при выходе (versionchange) не должно ждать закрытия вкладки.
        blocking: () => {
          opened.close()
          this._database = null
        },
      })
      return opened
    }
    catch {
      return null
    }
  }
}

function defaultIndexedDB(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB
}
