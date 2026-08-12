export const ACTIVE_BACKEND_STORAGE_KEY = 'endge:configurator:active-backend-url:v1'
export const ACTIVE_WORKSPACE_STORAGE_KEY_PREFIX = 'endge:configurator:active-workspace:v1'

/** Нормализует backend URL одинаково для env, каталога и browser storage. */
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

/** Возвращает target namespace для browser state без зависимости от application kernel. */
export function currentTargetStorageNamespace(workspaceIdentity?: string): string {
  let backend = 'detached'
  try {
    const primary = normalizeBackendURL(import.meta.env.VITE_ENDGE_SERVICE_BACKEND_URL)
    backend = new BackendConnectionStorage().readActiveBackend(primary)
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

/** Browser persistence repository. Повреждённые значения никогда не восстанавливаются. */
export class BackendConnectionStorage {
  public readActiveBackend(primaryBackendURL: string): string {
    const primary = normalizeBackendURL(primaryBackendURL)
    if (typeof window === 'undefined') {
      return primary
    }
    try {
      const stored = window.localStorage.getItem(ACTIVE_BACKEND_STORAGE_KEY)
      const active = stored ? normalizeBackendURL(stored) : primary
      window.localStorage.setItem(ACTIVE_BACKEND_STORAGE_KEY, active)
      return active
    }
    catch {
      this.writeActiveBackend(primary)
      return primary
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
      // Bootstrap продолжит работу с in-memory primary, если storage недоступен.
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
}

function normalizeIdentity(value: unknown): string | null {
  const identity = String(value ?? '').trim()
  return identity || null
}
