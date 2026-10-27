import type { AgentAccessHttp_Adapter } from '@/features/agent-access/adapters/AgentAccessHttp_Adapter'
import type {
  AgentAccessOwnerFilter,
  AgentAccessToken,
  AgentAttributedRevisionPage,
  CreateAgentAccessTokenInput,
  CreatedAgentAccessToken,
} from '@/features/agent-access/domain/types/agent-access.type'

import { computed, readonly, shallowRef } from 'vue'

import { AgentAccessError } from '@/features/agent-access/adapters/AgentAccessHttp_Adapter'

export type AgentAccessListStatus = 'idle' | 'loading' | 'ready' | 'error'

// Размер страницы истории ревизий документа.
export const DOCUMENT_REVISIONS_PAGE_SIZE = 50

/**
 * Владелец персональных токенов агентов текущего backend: список, выпуск, отзыв
 * и отметка агента в истории ревизий. Секрет выпущенного токена модуль не хранит:
 * он возвращается вызывающему диалогу один раз.
 */
export class AgentAccess_Module {
  // HTTP adapter текущего backend.
  private readonly _adapter: AgentAccessHttp_Adapter
  // Проекции токенов без секрета.
  private readonly _tokens = shallowRef<readonly AgentAccessToken[]>([])
  // Предел срока действия токена из backend.
  private readonly _maxTtlSeconds = shallowRef<number | null>(null)
  // Состояние загрузки списка.
  private readonly _status = shallowRef<AgentAccessListStatus>('idle')
  // Код ошибки последней загрузки списка.
  private readonly _errorCode = shallowRef<string | null>(null)
  // Загруженный фильтр владельца.
  private readonly _owner = shallowRef<AgentAccessOwnerFilter>('me')
  // Текущая загрузка списка для дедупликации.
  private _loading: Promise<void> | null = null

  public readonly tokens = readonly(this._tokens)
  public readonly maxTtlSeconds = readonly(this._maxTtlSeconds)
  public readonly status = readonly(this._status)
  public readonly errorCode = readonly(this._errorCode)
  public readonly owner = readonly(this._owner)
  public readonly activeCount = computed(() => this._tokens.value.filter(token => token.status === 'active').length)

  /**
   * Создаёт модуль с явным HTTP adapter.
   */
  public constructor(adapter: AgentAccessHttp_Adapter) {
    this._adapter = adapter
  }

  // ---------------------------------------------
  // PUBLIC API
  // ---------------------------------------------

  /**
   * Загружает список токенов: свои или все (только Platform Admin).
   */
  public refresh(owner: AgentAccessOwnerFilter = this._owner.value): Promise<void> {
    if (this._loading && owner === this._owner.value) {
      return this._loading
    }
    this._owner.value = owner
    this._status.value = 'loading'
    this._errorCode.value = null
    const loading = this._adapter.listTokens(owner)
      .then((list) => {
        if (this._owner.value !== owner) {
          return
        }
        this._tokens.value = list.items
        this._maxTtlSeconds.value = list.maxTtlSeconds
        this._status.value = 'ready'
      })
      .catch((error: unknown) => {
        if (this._owner.value !== owner) {
          return
        }
        this._status.value = 'error'
        this._errorCode.value = errorCode(error)
      })
      .finally(() => {
        if (this._loading === loading) {
          this._loading = null
        }
      })
    this._loading = loading
    return loading
  }

  /**
   * Загружает список один раз, если он ещё не загружен.
   */
  public ensureLoaded(owner: AgentAccessOwnerFilter = this._owner.value): Promise<void> {
    if (this._status.value === 'ready' && this._owner.value === owner) {
      return Promise.resolve()
    }
    return this.refresh(owner)
  }

  /**
   * Выпускает токен. Секрет возвращается только вызывающему и не сохраняется в модуле.
   */
  public async create(input: CreateAgentAccessTokenInput): Promise<CreatedAgentAccessToken> {
    const created = await this._adapter.createToken(input)
    if (this._status.value === 'ready') {
      this._tokens.value = [created.accessToken, ...this._tokens.value.filter(token => token.id !== created.accessToken.id)]
    }
    return created
  }

  /**
   * Отзывает токен и обновляет его проекцию в списке.
   */
  public async revoke(id: string): Promise<void> {
    await this._adapter.revokeToken(id)
    const revokedAt = new Date().toISOString()
    this._tokens.value = this._tokens.value.map(token =>
      token.id === id && token.status !== 'revoked'
        ? { ...token, status: 'revoked', revokedAt: token.revokedAt ?? revokedAt }
        : token,
    )
  }

  /**
   * Имя токена по id, если токен виден текущему пользователю.
   */
  public tokenName(id: string): string | null {
    return this._tokens.value.find(token => token.id === id)?.name ?? null
  }

  /**
   * Загружает страницу истории ревизий документа (без снимков) и помечает правки
   * агента. Имя токена приходит от backend (`accessTokenName`); список токенов
   * загружается только как запасной источник, если имени нет, и его ошибка не
   * мешает показать историю.
   */
  public async loadDocumentRevisions(
    workspaceIdentity: string,
    collection: string,
    identity: string,
    owner: AgentAccessOwnerFilter,
    page: { limit: number, offset: number } = { limit: DOCUMENT_REVISIONS_PAGE_SIZE, offset: 0 },
  ): Promise<AgentAttributedRevisionPage> {
    const result = await this._adapter.listDocumentRevisions(workspaceIdentity, collection, identity, page)
    if (result.items.some(revision => revision.accessTokenId && !revision.accessTokenName)) {
      await this.ensureLoaded(owner).catch(() => undefined)
    }
    const items = result.items
      .map(revision => ({
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        operation: revision.operation,
        createdAt: revision.createdAt,
        createdBy: revision.createdBy,
        agent: revision.accessTokenId
          ? { tokenId: revision.accessTokenId, name: revision.accessTokenName ?? this.tokenName(revision.accessTokenId) }
          : null,
      }))
      .sort((left, right) => right.revisionNumber - left.revisionNumber)
    return { items, total: result.total }
  }

  /**
   * Сбрасывает проекции при смене backend или выходе.
   */
  public reset(): void {
    this._tokens.value = []
    this._maxTtlSeconds.value = null
    this._status.value = 'idle'
    this._errorCode.value = null
    this._owner.value = 'me'
    this._loading = null
  }
}

function errorCode(error: unknown): string {
  return error instanceof AgentAccessError && error.code ? error.code : 'unknown'
}
