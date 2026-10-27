import { describe, expect, it } from 'vitest'

import { agentDocumentationLinks, buildAgentPrompt } from '@/features/agent-access/services/agent-prompt'
import { maskAgentToken } from '@/features/agent-access/services/agent-token-mask'

const FAKE_TOKEN = 'endge_pat_FAKEfake0000000000000000000000000000000000000'

const BASE_INPUT = {
  backendURL: 'https://endge.example.test/backend/',
  workspaceIdentity: 'afl',
  workspaceDisplayName: 'АФЛ',
  tokenName: 'Codex: инспектор рейса',
  token: FAKE_TOKEN,
  scope: 'write' as const,
  commit: false,
  delete: false,
  expiresAt: '2026-11-02T10:00:00Z',
  documentationURL: 'https://docs.example.test/endge/',
}

describe('шаблон промпта агента', () => {
  it('собирает полный промпт записи: адрес с префиксом, workspace, токен, права, срок, ссылки llms и правила', () => {
    expect(buildAgentPrompt(BASE_INPUT)).toBe(`Ты работаешь с Endge от имени пользователя через HTTP API backend. Токен «Codex: инспектор рейса».

## Подключение
- Backend: https://endge.example.test/backend
- API: https://endge.example.test/backend/api/v1
- Workspace: afl (АФЛ). Передавай его в каждом запросе заголовком \`X-Endge-Workspace: afl\`.
- Токен: ${FAKE_TOKEN}
  Передавай его заголовком \`Authorization: Bearer <токен>\`. Не записывай токен в файлы репозитория, логи, коммиты и ответы.
- Права: чтение и запись (не выше Editor); коммиты и релизы запрещены; удаление запрещено.
- Срок действия: до 2026-11-02 10:00 UTC. После истечения (401 \`access_token_expired\`) попроси у пользователя новый токен.

## Документация
Прочитай перед работой, начиная с первой ссылки:
- Ядро для агента: правила, ошибки, авторинг Source и все HTTP-операции: https://docs.example.test/endge/llms-agent.txt
- Оглавление: части API (llms-full/api/<группа>.txt), Source по типам (llms-full/reference/<тип>.txt) и страницы: https://docs.example.test/endge/llms.txt
- Сквозные сценарии с запросами и ответами: https://docs.example.test/endge/agents/scenarios.md
- Коды ошибок: смысл и что делать: https://docs.example.test/endge/agents/errors.md

## Правила
1. Документы читай через \`GET https://endge.example.test/backend/api/v1/<коллекция>/<identity>\` (например, \`https://endge.example.test/backend/api/v1/queries/<identity>\`), номер ревизии бери из поля \`revision\` или заголовка \`ETag\`.
2. Изменяй документ только через \`PATCH\` с заголовком \`If-Match: "<revision>"\` прочитанной ревизии.
3. При ответе \`409\` перечитай документ, заново примени свои правки к актуальной версии и повтори запрос. Не перезаписывай чужие изменения вслепую.
4. Не создавай коммиты и релизы (токен этого и не разрешает) и не удаляй документы (токен этого и не разрешает) без явной просьбы пользователя.
5. Ответы \`401\`/\`403\` с кодом \`access_token_*\` не обходи: сообщи пользователю код и что ты пытался сделать.
6. Backend не проверяет Source. После изменений перечисли изменённые документы и попроси пользователя открыть их в Configurator, чтобы проверить Source и диагностику.
`)
  })

  it('для токена с флагами сохраняет правило «не без просьбы», но не пишет, что токен запрещает', () => {
    const prompt = buildAgentPrompt({ ...BASE_INPUT, commit: true, delete: true })

    expect(prompt).toContain('- Права: чтение и запись (не выше Editor); коммиты и релизы разрешены; удаление разрешено.')
    expect(prompt).toContain('4. Не создавай коммиты и релизы и не удаляй документы без явной просьбы пользователя.')
  })

  it('для токена чтения запрещает изменения и не упоминает PATCH', () => {
    const prompt = buildAgentPrompt({ ...BASE_INPUT, scope: 'read' })

    expect(prompt).toContain('- Права: только чтение.')
    expect(prompt).toContain('2. Токен даёт только чтение')
    expect(prompt).not.toContain('PATCH')
  })

  it('без адреса документации даёт понятный fallback и ссылку на OpenAPI backend', () => {
    const prompt = buildAgentPrompt({ ...BASE_INPUT, documentationURL: undefined })

    expect(prompt).toContain('Адрес документации Endge в этом Configurator не настроен')
    expect(prompt).toContain('- Описание API: https://endge.example.test/backend/swagger/openapi3.yaml')
    expect(prompt).not.toContain('llms.txt:')
    expect(agentDocumentationLinks('  ')).toEqual([])
  })

  it('предпросмотр с маской не содержит секрет', () => {
    const preview = buildAgentPrompt({ ...BASE_INPUT, token: maskAgentToken(FAKE_TOKEN) })

    expect(preview).not.toContain(FAKE_TOKEN)
    expect(preview).toContain('- Токен: endge_pat_FAKEfake••••••••••••')
  })
})
