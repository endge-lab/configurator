import type { AgentAccessScope } from '@/features/agent-access/domain/types/agent-access.type'

/**
 * Данные для промпта агента. Шаблон намеренно на русском: это инструкция,
 * которую пользователь передаёт агенту, а не текст интерфейса Configurator.
 */
export interface AgentPromptInput {
  // Адрес backend текущего подключения Configurator вместе с префиксом пути.
  backendURL: string
  workspaceIdentity: string
  workspaceDisplayName?: string
  tokenName: string
  // Полный токен для копирования или замаскированный для предпросмотра.
  token: string
  scope: AgentAccessScope
  commit: boolean
  delete: boolean
  expiresAt: string
  // Адрес документации Endge (`VITE_DOCUMENTATION_URL`); отсутствует, если не задан.
  documentationURL?: string
}

// Разделы llms документации в порядке чтения.
export const AGENT_DOCUMENTATION_PATHS = [
  { path: '/llms.txt', label: 'Обзор и оглавление' },
  { path: '/llms-full/agents.txt', label: 'Работа агента с Endge' },
  { path: '/llms-full/reference.txt', label: 'Справочник Source' },
  { path: '/llms-full/api.txt', label: 'HTTP API backend' },
] as const

/**
 * Собирает ссылки на разделы llms относительно корня документации.
 */
export function agentDocumentationLinks(documentationURL: string | undefined): string[] {
  const base = documentationURL?.trim().replace(/\/+$/, '')
  if (!base) {
    return []
  }
  return AGENT_DOCUMENTATION_PATHS.map(entry => `${base}${entry.path}`)
}

/**
 * Собирает промпт агента: подключение, права, документацию и правила работы.
 */
export function buildAgentPrompt(input: AgentPromptInput): string {
  const backendURL = input.backendURL.trim().replace(/\/+$/, '')
  const apiURL = `${backendURL}/api/v1`
  const workspace = input.workspaceDisplayName && input.workspaceDisplayName !== input.workspaceIdentity
    ? `${input.workspaceIdentity} (${input.workspaceDisplayName})`
    : input.workspaceIdentity
  const links = agentDocumentationLinks(input.documentationURL)
  const canWrite = input.scope === 'write'

  const lines: string[] = [
    `Ты работаешь с Endge от имени пользователя через HTTP API backend. Токен «${input.tokenName}».`,
    '',
    '## Подключение',
    `- Backend: ${backendURL}`,
    `- API: ${apiURL}`,
    `- Workspace: ${workspace}. Передавай его в каждом запросе заголовком \`X-Endge-Workspace: ${input.workspaceIdentity}\`.`,
    `- Токен: ${input.token}`,
    '  Передавай его заголовком `Authorization: Bearer <токен>`. Не записывай токен в файлы репозитория, логи, коммиты и ответы.',
    `- Права: ${describeRights(input)}.`,
    `- Срок действия: до ${formatExpiry(input.expiresAt)}. После истечения (401 \`access_token_expired\`) попроси у пользователя новый токен.`,
    '',
    '## Документация',
  ]

  if (links.length) {
    lines.push('Прочитай перед работой, начиная с первой ссылки:')
    AGENT_DOCUMENTATION_PATHS.forEach((entry, index) => {
      lines.push(`- ${entry.label}: ${links[index]}`)
    })
  }
  else {
    lines.push(
      '- Адрес документации Endge в этом Configurator не настроен. Попроси у пользователя ссылку на документацию',
      '  (файлы `llms.txt`, `llms-full/agents.txt`, `llms-full/reference.txt`, `llms-full/api.txt`).',
      `- Описание API: ${backendURL}/swagger/openapi3.yaml (доступно, если backend запущен не в production).`,
    )
  }

  lines.push(
    '',
    '## Правила',
    `1. Документы читай через \`GET ${apiURL}/<коллекция>/<identity>\` (например, \`${apiURL}/queries/<identity>\`), номер ревизии бери из поля \`revision\` или заголовка \`ETag\`.`,
  )
  if (canWrite) {
    lines.push(
      '2. Изменяй документ только через `PATCH` с заголовком `If-Match: "<revision>"` прочитанной ревизии.',
      '3. При ответе `409` перечитай документ, заново примени свои правки к актуальной версии и повтори запрос. Не перезаписывай чужие изменения вслепую.',
      `4. Не создавай коммиты и релизы${input.commit ? '' : ' (токен этого и не разрешает)'} и не удаляй документы${input.delete ? '' : ' (токен этого и не разрешает)'} без явной просьбы пользователя.`,
      '5. Ответы `401`/`403` с кодом `access_token_*` не обходи: сообщи пользователю код и что ты пытался сделать.',
      '6. Backend не проверяет Source. После изменений перечисли изменённые документы и попроси пользователя открыть их в Configurator, чтобы проверить Source и диагностику.',
    )
  }
  else {
    lines.push(
      '2. Токен даёт только чтение: не пытайся изменять, коммитить или удалять документы. Предлагай изменения текстом, пользователь внесёт их сам.',
      '3. Ответы `401`/`403` с кодом `access_token_*` не обходи: сообщи пользователю код и что ты пытался сделать.',
    )
  }

  return `${lines.join('\n')}\n`
}

function describeRights(input: AgentPromptInput): string {
  if (input.scope === 'read') {
    return 'только чтение'
  }
  const commit = input.commit ? 'разрешены' : 'запрещены'
  const remove = input.delete ? 'разрешено' : 'запрещено'
  return `чтение и запись (не выше Editor); коммиты и релизы ${commit}; удаление ${remove}`
}

function formatExpiry(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
