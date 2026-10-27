// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentAccessError, AgentAccessHttp_Adapter } from '@/features/agent-access/adapters/AgentAccessHttp_Adapter'
import { AgentAccess_Module } from '@/features/agent-access/AgentAccess_Module'
import { agentAccessErrorKey, canIssueAgentCommit } from '@/features/agent-access/services/agent-access-errors'
import {
  isExpiryPresetAvailable,
  resolveAgentTokenExpiry,
} from '@/features/agent-access/services/agent-token-expiry'
import { maskAgentToken } from '@/features/agent-access/services/agent-token-mask'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { copyTextToClipboard } from '@/shared/tools/clipboard'

const SECRET = `endge_pat_Ab3dE6gH${'x'.repeat(35)}`

function tokenPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-1',
    owner: { id: 'user-1', username: 'egor' },
    workspaceIdentity: 'afl',
    workspaceDisplayName: 'АФЛ',
    name: 'Codex: инспектор',
    scope: 'write',
    commit: false,
    delete: false,
    tokenPrefix: 'endge_pat_Ab3dE6gH',
    status: 'active',
    createdAt: '2026-10-26T10:00:00Z',
    expiresAt: '2026-10-27T10:00:00Z',
    ...overrides,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Поддельный backend персональных токенов: хранит выпущенные токены в памяти.
 */
function fakeBackend(options: { withTokenNames?: boolean } = {}) {
  const tokens = [tokenPayload({ id: 'token-old', name: 'Старый', status: 'expired' })]
  const names = options.withTokenNames
  const revisions = [
    { id: 'rev-1', revisionNumber: 1, operation: 'create', createdAt: '2026-10-26T09:00:00Z', createdBy: { id: 'user-1', username: 'egor' } },
    { id: 'rev-2', revisionNumber: 2, operation: 'update', createdAt: '2026-10-26T11:00:00Z', createdBy: { id: 'user-1', username: 'egor' }, accessTokenId: 'token-1', ...(names ? { accessTokenName: 'Codex: инспектор' } : {}) },
    { id: 'rev-3', revisionNumber: 3, operation: 'update', createdAt: '2026-10-26T12:00:00Z', createdBy: { id: 'user-2' }, accessTokenId: 'token-foreign-123456', ...(names ? { accessTokenName: 'Чужой агент' } : {}) },
  ]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://backend.test/prefix', '')
    if (path.startsWith('/api/v1/access-tokens?owner=')) {
      return json({ items: tokens, maxTtlSeconds: 2592000 })
    }
    if (path === '/api/v1/access-tokens' && init.method === 'POST') {
      const input = JSON.parse(String(init.body))
      if (input.scope === 'read' && (input.commit || input.delete)) {
        return json({ code: 'access_token_flags_require_write', message: 'flags' }, 400)
      }
      const accessToken = tokenPayload({ ...input, workspaceIdentity: input.workspaceIdentity })
      tokens.unshift(accessToken)
      return json({ token: SECRET, accessToken }, 201)
    }
    if (path.startsWith('/api/v1/access-tokens/') && init.method === 'DELETE') {
      return new Response(null, { status: 204 })
    }
    if (path.startsWith('/api/v1/domain/documents/queries/flight-inspector/revisions?')) {
      const query = new URL(url).searchParams
      const offset = Number(query.get('offset') ?? 0)
      const limit = Number(query.get('limit') ?? revisions.length)
      const ordered = [...revisions].reverse()
      return json({ items: ordered.slice(offset, offset + limit), total: revisions.length, limit, offset })
    }
    return json({ code: 'not_found', message: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, tokens }
}

describe('сервис персональных токенов агента', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('выпускает токен cookie-сессией по адресу с префиксом и не хранит секрет в модуле', async () => {
    const { fetchMock } = fakeBackend()
    const module = new AgentAccess_Module(new AgentAccessHttp_Adapter('https://backend.test/prefix/'))
    await module.refresh('me')

    const created = await module.create({
      workspaceIdentity: 'afl',
      name: 'Codex: инспектор',
      scope: 'write',
      commit: false,
      delete: false,
      expiresAt: '2026-10-27T10:00:00.000Z',
    })

    expect(created.token).toBe(SECRET)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://backend.test/prefix/api/v1/access-tokens')
    expect(init).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include', cache: 'no-store' }))
    expect(JSON.parse(String(init?.body))).toEqual({
      workspaceIdentity: 'afl',
      name: 'Codex: инспектор',
      scope: 'write',
      commit: false,
      delete: false,
      expiresAt: '2026-10-27T10:00:00.000Z',
    })
    expect(module.tokens.value.map(token => token.name)).toEqual(['Codex: инспектор', 'Старый'])
    expect(module.maxTtlSeconds.value).toBe(2592000)
    expect(JSON.stringify(module.tokens.value)).not.toContain(SECRET)
  })

  it('загружает все токены для Platform Admin, отзывает токен и отражает статус', async () => {
    const { fetchMock } = fakeBackend()
    const module = new AgentAccess_Module(new AgentAccessHttp_Adapter('https://backend.test/prefix'))

    await module.refresh('all')
    await module.create({ workspaceIdentity: 'afl', name: 'A', scope: 'read', commit: false, delete: false, expiresAt: '2026-10-27T10:00:00Z' })
    await module.revoke('token-1')

    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.test/prefix/api/v1/access-tokens?owner=all')
    expect(fetchMock.mock.calls[2][0]).toBe('https://backend.test/prefix/api/v1/access-tokens/token-1')
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: 'DELETE' }))
    expect(module.tokens.value.find(token => token.id === 'token-1')?.status).toBe('revoked')
    expect(module.activeCount.value).toBe(0)
  })

  it('передаёт код ошибки backend и сопоставляет его с ключом каталога', async () => {
    fakeBackend()
    const module = new AgentAccess_Module(new AgentAccessHttp_Adapter('https://backend.test/prefix'))

    const error = await module.create({ workspaceIdentity: 'afl', name: 'A', scope: 'read', commit: true, delete: false, expiresAt: '2026-10-27T10:00:00Z' })
      .catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(AgentAccessError)
    expect((error as AgentAccessError).code).toBe('access_token_flags_require_write')
    expect(agentAccessErrorKey(error)).toBe('agentAccess.errors.flagsRequireWrite')
    expect(agentAccessErrorKey(new Error('boom'))).toBe('agentAccess.errors.unknown')
    expect(agentAccessErrorKey('access_token_owner_admin_required')).toBe('agentAccess.errors.commitRequiresAdmin')
  })

  it('каждый код ошибки backend токенов имеет сообщение в каталогах ru и en', () => {
    const codes = [
      'access_token_expiry_required',
      'access_token_expiry_invalid',
      'access_token_expiry_too_long',
      'access_token_flags_require_write',
      'access_token_scope_invalid',
      'access_token_name_invalid',
      'access_token_description_invalid',
      'access_token_scope_exceeds_role',
      'access_token_owner_admin_required',
      'access_token_not_found',
      'workspace_not_found',
      'workspace_forbidden',
      'platform_admin_required',
      'service_backend_unavailable',
    ]
    const read = (catalog: Record<string, unknown>, key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], catalog)
    for (const code of codes) {
      const key = agentAccessErrorKey(code)
      expect(key, code).not.toBe('agentAccess.errors.unknown')
      expect(typeof read(ru, key), `ru ${key}`).toBe('string')
      expect(typeof read(en, key), `en ${key}`).toBe('string')
    }
    expect(typeof read(ru, 'agentAccess.errors.unknown')).toBe('string')
    expect(typeof read(en, 'agentAccess.errors.unknown')).toBe('string')
  })

  it('allows the commit flag only for Workspace Admin and Platform Admin', () => {
    expect(canIssueAgentCommit('admin', false)).toBe(true)
    expect(canIssueAgentCommit('editor', true)).toBe(true)
    expect(canIssueAgentCommit('editor', false)).toBe(false)
    expect(canIssueAgentCommit('viewer', false)).toBe(false)
    expect(canIssueAgentCommit(null, false)).toBe(false)
  })

  it('помечает ревизии агента именем токена, а чужой токен — коротким id', async () => {
    const { fetchMock } = fakeBackend()
    const module = new AgentAccess_Module(new AgentAccessHttp_Adapter('https://backend.test/prefix'))
    await module.create({ workspaceIdentity: 'afl', name: 'Codex: инспектор', scope: 'write', commit: false, delete: false, expiresAt: '2026-10-27T10:00:00Z' })

    const page = await module.loadDocumentRevisions('afl', 'queries', 'flight-inspector', 'me')

    const revisionCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/revisions'))
    expect((revisionCall?.[1]?.headers as Record<string, string>)['X-Endge-Workspace']).toBe('afl')
    expect(String(revisionCall?.[0])).toContain('/revisions?snapshot=false&limit=50&offset=0')
    expect(page.total).toBe(3)
    expect(page.items.map(revision => [revision.revisionNumber, revision.agent])).toEqual([
      [3, { tokenId: 'token-foreign-123456', name: null }],
      [2, { tokenId: 'token-1', name: 'Codex: инспектор' }],
      [1, null],
    ])
  })

  it('берёт имя токена из accessTokenName и грузит историю страницами без списка токенов', async () => {
    const { fetchMock } = fakeBackend({ withTokenNames: true })
    const module = new AgentAccess_Module(new AgentAccessHttp_Adapter('https://backend.test/prefix'))

    const first = await module.loadDocumentRevisions('afl', 'queries', 'flight-inspector', 'me', { limit: 2, offset: 0 })
    const second = await module.loadDocumentRevisions('afl', 'queries', 'flight-inspector', 'me', { limit: 2, offset: 2 })

    expect(first.items.map(revision => revision.agent?.name ?? null)).toEqual(['Чужой агент', 'Codex: инспектор'])
    expect(first.total).toBe(3)
    expect(second.items.map(revision => revision.revisionNumber)).toEqual([1])
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/access-tokens'))).toBe(false)
  })

  it('считает срок по пресетам и проверяет свой срок по пределу backend', () => {
    const now = new Date('2026-10-26T10:00:00Z')
    const day = resolveAgentTokenExpiry('1d', '', now, 2592000)

    expect(day.ok && day.expiresAt.toISOString()).toBe('2026-10-27T10:00:00.000Z')
    expect(resolveAgentTokenExpiry('7d', '', now, 86400)).toEqual({ ok: false, reason: 'tooLong' })
    expect(isExpiryPresetAvailable('7d', 86400)).toBe(false)
    expect(isExpiryPresetAvailable('1d', 86400)).toBe(true)
    expect(resolveAgentTokenExpiry('custom', '', now, null)).toEqual({ ok: false, reason: 'required' })
    expect(resolveAgentTokenExpiry('custom', 'не дата', now, null)).toEqual({ ok: false, reason: 'invalid' })
    expect(resolveAgentTokenExpiry('custom', '2026-10-26T10:00:30Z', now, null)).toEqual({ ok: false, reason: 'tooSoon' })
    expect(resolveAgentTokenExpiry('custom', '2026-12-26T10:00:00Z', now, 2592000)).toEqual({ ok: false, reason: 'tooLong' })
  })

  it('маскирует токен до публичного префикса', () => {
    expect(maskAgentToken(SECRET)).toBe('endge_pat_Ab3dE6gH••••••••••••')
    expect(maskAgentToken(SECRET)).not.toContain('xxx')
    expect(maskAgentToken('')).toBe('')
    expect(maskAgentToken('short')).toBe('sh••••••••••••')
  })

  it('копирует через Clipboard API, а при отказе — через запасной способ', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

    await expect(copyTextToClipboard(SECRET)).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith(SECRET)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()

    writeText.mockResolvedValueOnce(undefined)
    execCommand.mockClear()
    await expect(copyTextToClipboard('text')).resolves.toBe(true)
    expect(execCommand).not.toHaveBeenCalled()
  })
})
