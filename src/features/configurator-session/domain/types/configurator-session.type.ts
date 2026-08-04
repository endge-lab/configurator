/** Разработчик, авторизованный для работы в Configurator. */
export interface ConfiguratorDeveloper {
  id: string
  providerId: string
  subject: string
  issuer: string
  username?: string
  displayName?: string
  active: boolean
}

/** Workspace, доступный текущему разработчику. */
export interface ConfiguratorWorkspaceAccess {
  id: string
  identity: string
  displayName: string
  active: boolean
}

/** Безопасный snapshot developer session без token и JWT claims. */
export interface ConfiguratorSession {
  developer: ConfiguratorDeveloper
  platformAdmin: boolean
  workspaces: ConfiguratorWorkspaceAccess[]
}

export type ConfiguratorSessionState
  = | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'authenticated', session: ConfiguratorSession }
    | { status: 'unauthenticated', loginUrl: string }
    | { status: 'error', code: string, message: string }

/** Сетевой порт developer session. */
export interface ConfiguratorSessionService {
  check: () => Promise<ConfiguratorSessionState>
  logout: () => Promise<void>
}

export interface ConfiguratorLoginRedirectResult {
  redirected: boolean
  code?: 'auth_redirect_loop' | 'auth_login_url_invalid'
  message?: string
}
