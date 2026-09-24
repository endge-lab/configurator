export const ACTIVE_BACKEND_STORAGE_KEY = 'endge:configurator:active-backend-url:v1'
export const ACTIVE_WORKSPACE_STORAGE_KEY_PREFIX = 'endge:configurator:active-workspace:v1'
export const LOCAL_BACKEND_CONNECTIONS_STORAGE_KEY = 'endge:configurator:backend-connections:v1'

export interface LocalBackendConnection {
  name: string
  baseUrl: string
}

// Нормализует backend URL одинаково для env, каталога и browser storage.
export function normalizeBackendURL(value: unknown): string {
  const raw = String(value ?? '').trim()
  let url: URL
  try {
    url = new URL(raw)
  }
  catch {
    throw new Error('Backend URL must be an absolute URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Backend URL must use http or https')
  }
  const authority = raw.match(/^[a-z][a-z\d+.-]*:\/\/([^/]*)/i)?.[1] ?? ''
  if (url.username || url.password || authority.includes('@') || raw.includes('?') || raw.includes('#')) {
    throw new Error('Backend URL must not contain userinfo, query or fragment')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/+$/, '')
}

export function workspaceStorageKey(backendURL: string): string {
  return `${ACTIVE_WORKSPACE_STORAGE_KEY_PREFIX}:${encodeURIComponent(normalizeBackendURL(backendURL))}`
}

/**
 * Browser persistence repository. Повреждённые значения никогда не восстанавливаются.
 */
export class BackendConnectionStorage {
  public readActiveBackend(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const stored = window.localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)
      return stored ? normalizeBackendURL(stored) : null
    }
    catch {
      return null
    }
  }

  public writeActiveBackend(backendURL: string): void {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(ACTIVE_BACKEND_STORAGE_KEY, normalizeBackendURL(backendURL))
    }
    catch {
      // После reload выбор снова потребуется, если storage недоступен.
    }
  }

  public removeActiveBackend(): void {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.removeItem(ACTIVE_BACKEND_STORAGE_KEY)
    }
    catch {
      // Следующий bootstrap продолжит использовать текущий URL до reload.
    }
  }

  public readLocalConnections(): LocalBackendConnection[] {
    if (typeof window === 'undefined') {
      return []
    }
    try {
      const raw = window.localStorage.getItem(LOCAL_BACKEND_CONNECTIONS_STORAGE_KEY)
      if (!raw) {
        return []
      }
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return []
      }
      const byURL = new Map<string, LocalBackendConnection>()
      for (const value of parsed) {
        if (!isRecord(value)) {
          continue
        }
        const name = String(value.name ?? '').trim()
        if (!name) {
          continue
        }
        try {
          const baseUrl = normalizeBackendURL(value.baseUrl)
          if (!byURL.has(baseUrl)) {
            byURL.set(baseUrl, { name, baseUrl })
          }
        }
        catch {
          // Повреждённая запись не становится доступным target.
        }
      }
      return [...byURL.values()]
    }
    catch {
      return []
    }
  }

  public writeLocalConnection(connection: LocalBackendConnection): void {
    if (typeof window === 'undefined') {
      return
    }
    const baseUrl = normalizeBackendURL(connection.baseUrl)
    const values = this.readLocalConnections().filter(item => item.baseUrl !== baseUrl)
    values.push({ name: connection.name.trim(), baseUrl })
    try {
      window.localStorage.setItem(LOCAL_BACKEND_CONNECTIONS_STORAGE_KEY, JSON.stringify(values))
    }
    catch {
      // Подключение останется недоступным после reload, если storage недоступен.
    }
  }

  public removeLocalConnection(backendURL: string): void {
    if (typeof window === 'undefined') {
      return
    }
    const baseUrl = normalizeBackendURL(backendURL)
    try {
      const values = this.readLocalConnections().filter(item => item.baseUrl !== baseUrl)
      window.localStorage.setItem(LOCAL_BACKEND_CONNECTIONS_STORAGE_KEY, JSON.stringify(values))
    }
    catch {
      // Недоступный storage не изменяет текущую in-memory проекцию владельца.
    }
  }

  public readWorkspace(backendURL: string): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      return normalizeIdentity(window.localStorage.getItem(workspaceStorageKey(backendURL)))
    }
    catch {
      return null
    }
  }

  public writeWorkspace(backendURL: string, workspaceIdentity: string): void {
    const identity = normalizeIdentity(workspaceIdentity)
    if (typeof window === 'undefined' || !identity) {
      return
    }
    try {
      window.localStorage.setItem(workspaceStorageKey(backendURL), identity)
    }
    catch {
      // Выбор остаётся доступным в текущем bootstrap, но reload вернёт chooser.
    }
  }

  public removeWorkspace(backendURL: string): void {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.removeItem(workspaceStorageKey(backendURL))
    }
    catch {
      // При недоступном storage bootstrap всё равно проверит серверный список.
    }
  }
}

// Возвращает target namespace для browser state без зависимости от application kernel.
export function currentTargetStorageNamespace(workspaceIdentity?: string): string {
  let backend = 'detached'
  try {
    backend = new BackendConnectionStorage().readActiveBackend() ?? 'detached'
  }
  catch {
    // Build/test окружение без backend env получает изолированный detached namespace.
  }
  const workspace = String(
    workspaceIdentity
    ?? new BackendConnectionStorage().readWorkspace(backend)
    ?? import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY
    ?? 'detached',
  ).trim() || 'detached'
  return [backend, workspace].map(value => encodeURIComponent(value)).join(':')
}

export function currentActiveBackendURL(): string {
  const namespace = currentTargetStorageNamespace()
  return decodeURIComponent(namespace.split(':')[0] ?? 'detached')
}
function normalizeIdentity(value: unknown): string | null {
  const identity = String(value ?? '').trim()
  return identity || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
