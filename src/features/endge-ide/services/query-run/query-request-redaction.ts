import type { QueryExecutionRequest } from '@endge/core'

// Замена секретного значения в просмотре запроса.
export const QUERY_RUN_REDACTED = '***'

// Итоговый запрос Query для показа пользователю: секреты заменены.
export interface QueryRunRequestPreview {
  protocol: QueryExecutionRequest['protocol']
  method: string
  url: string
  headers: Record<string, string>
  params: Record<string, unknown>
  body: unknown
  operationName?: string
  timeoutMs?: number
  // Имена скрытых заголовков и параметров (для подписи в UI).
  redacted: string[]
}

// Имена, по которым заголовок или параметр считается секретом, даже если его задал автор Source.
const SECRET_NAME = /(?:^|[-_.])(?:authorization|auth|cookie|set-cookie|token|access[-_]?token|refresh[-_]?token|id[-_]?token|api[-_]?key|secret|client[-_]?secret|password|passwd|pwd|session|sessionid|signature|sig|credentials?|jwt|bearer|csrf|xsrf)(?:$|[-_.])/i

/**
 * Проверяет имя заголовка или query-параметра на признаки секрета.
 */
export function isSecretRequestName(name: string): boolean {
  // camelCase (`clientSecret`, `userPassword`) проверяется как `client-secret`.
  return SECRET_NAME.test(name.trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2'))
}

/**
 * Возвращает копию запроса без секретов: значения auth-заголовков и параметров,
 * а также заголовков, cookie, параметров URL и ключей тела (включая GraphQL
 * variables, на любой глубине) с «секретными» именами заменяются.
 * Схема авторизации (`Bearer`, `Basic`) сохраняется для наглядности.
 */
export function redactQueryRequest(request: QueryExecutionRequest): QueryRunRequestPreview {
  const redacted = new Set<string>()
  const authHeaders = new Set(request.authHeaders.map(name => name.toLowerCase()))
  const authParams = new Set(request.authParams)

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(request.headers)) {
    if (authHeaders.has(name.toLowerCase()) || isSecretRequestName(name)) {
      headers[name] = maskHeaderValue(value)
      redacted.add(name)
      continue
    }
    headers[name] = value
  }

  const params: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(request.params)) {
    if (authParams.has(name) || isSecretRequestName(name)) {
      params[name] = QUERY_RUN_REDACTED
      redacted.add(name)
      continue
    }
    params[name] = value
  }

  return {
    protocol: request.protocol,
    method: request.method,
    url: redactUrl(request.url, redacted),
    headers,
    params,
    body: readBody(request.body, redacted),
    operationName: request.operationName,
    timeoutMs: request.timeoutMs,
    redacted: [...redacted],
  }
}

function maskHeaderValue(value: string): string {
  const match = /^(Bearer|Basic|Token|Digest|ApiKey)\s+\S/i.exec(value.trim())
  return match ? `${match[1]} ${QUERY_RUN_REDACTED}` : QUERY_RUN_REDACTED
}

function redactUrl(url: string, redacted: Set<string>): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return url
  }
  let changed = false
  if (parsed.username || parsed.password) {
    parsed.username = parsed.username ? QUERY_RUN_REDACTED : ''
    parsed.password = parsed.password ? QUERY_RUN_REDACTED : ''
    redacted.add('userinfo')
    changed = true
  }
  for (const name of [...parsed.searchParams.keys()]) {
    if (isSecretRequestName(name)) {
      parsed.searchParams.set(name, QUERY_RUN_REDACTED)
      redacted.add(name)
      changed = true
    }
  }
  return changed ? parsed.toString() : url
}

function readBody(body: unknown, redacted: Set<string>): unknown {
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    const form: Record<string, string> = {}
    for (const [name, value] of body.entries()) {
      if (isSecretRequestName(name)) {
        form[name] = QUERY_RUN_REDACTED
        redacted.add(name)
        continue
      }
      form[name] = value
    }
    return form
  }
  if (typeof body === 'string') {
    // JSON-тело строкой: маскируется разобранная копия, иначе текст остаётся как есть.
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    }
    catch {
      return body
    }
    if (!parsed || typeof parsed !== 'object') {
      return body
    }
    const before = redacted.size
    const masked = redactJsonValue(parsed, '', redacted)
    return redacted.size === before ? body : JSON.stringify(masked)
  }
  return redactJsonValue(body, '', redacted)
}

// Копия JSON-значения: ключи с секретоподобными именами получают '***' целиком.
function redactJsonValue(value: unknown, path: string, redacted: Set<string>, depth = 0): unknown {
  if (!value || typeof value !== 'object' || depth > 32) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactJsonValue(item, `${path}[${index}]`, redacted, depth + 1))
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return value
  }
  const copy: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key
    if (item != null && isSecretRequestName(key)) {
      copy[key] = QUERY_RUN_REDACTED
      redacted.add(itemPath)
      continue
    }
    copy[key] = redactJsonValue(item, itemPath, redacted, depth + 1)
  }
  return copy
}
