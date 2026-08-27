/* eslint-disable perfectionist/sort-imports -- Endge plugins must be registered before context runtime is evaluated */
import '@/features/endge-ide/model/bootstrap/endge-runtime-plugins'
import '@/features/endge-ide/model/bootstrap/endge-renderer-plugins'

import type {
  ConfiguratorAuthenticationRequirement,
  ConfiguratorBackendConnectionFailure,
  ConfiguratorModules,
  ConfiguratorStatus,
} from '@/app/domain/types/configurator.type'
import type { ConfiguratorWorkspaceAccess } from '@/features/configurator-session/domain/types/configurator-session.type'
import type { ConfiguratorSessionBinding } from '@/features/configurator-session/ui/configurator-session-context'
import type { AccessControlModule } from '@/features/access-control'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { ConfiguratorSessionHttp_Adapter } from '@/features/configurator-session/model/adapters/ConfiguratorSessionHttp_Adapter'
import { createAccessControlModule } from '@/features/access-control'
import { clearConfiguratorBrowserState } from '@/features/configurator-session/tools/clear-configurator-browser-state'
import {
  clearConfiguratorLoginRedirectGuard,
  startConfiguratorLogin,
} from '@/features/configurator-session/tools/start-configurator-login'
import { resolveConfiguratorWorkspace } from '@/features/backend-connections/model/resolve-configurator-workspace'

import { createConfiguratorModules } from '@/app/model/config/modules.config'
import { VueErrorBoundary_Adapter } from '@/app/model/adapters/VueErrorBoundary_Adapter'
import { ServiceBackendDomainHttp_Adapter } from '@/features/endge-ide/model/backend/adapters/ServiceBackendDomainHttp_Adapter'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
/* eslint-enable perfectionist/sort-imports */

export class ConfiguratorBootstrapError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ConfiguratorBootstrapError'
  }
}

/** Application-scoped federation and the only owner of Configurator boot. */
export class Configurator {
  private static readonly _modules: ConfiguratorModules = createConfiguratorModules()
  private static _initialization: Promise<ConfiguratorStatus> | null = null
  private static _status: 'idle' | ConfiguratorStatus = 'idle'
  private static _authenticationRequirement: ConfiguratorAuthenticationRequirement | null = null
  private static _backendConnectionFailure: ConfiguratorBackendConnectionFailure | null = null
  private static _errorBoundary: VueErrorBoundary_Adapter | null = null
  private static _accessControl: AccessControlModule | null = null

  private constructor() {}

  public static get isReady(): boolean {
    return this._status === 'ready'
  }

  public static get session() {
    return this._modules.session
  }

  public static get connections() {
    return this._modules.connections
  }

  public static get backendVersions() {
    return this._modules.backendVersions
  }

  public static get domainVersions() {
    return this._modules.domainVersions
  }

  public static get status(): 'idle' | ConfiguratorStatus {
    return this._status
  }

  public static get workspaceSelection(): readonly ConfiguratorWorkspaceAccess[] {
    const state = this._modules.session.state
    return state.status === 'authenticated'
      ? state.session.workspaces.filter(workspace => workspace.active)
      : []
  }

  public static get backendConnectionFailure(): ConfiguratorBackendConnectionFailure | null {
    return this._backendConnectionFailure
  }

  public static get authenticationRequirement(): ConfiguratorAuthenticationRequirement | null {
    return this._authenticationRequirement
  }

  public static get context() {
    return this._modules.context
  }

  public static get diagnostics() {
    return this._modules.diagnostics
  }

  public static get i18n() {
    return this._modules.i18n
  }

  public static get questions() {
    return this._modules.questions
  }

  public static get layout() {
    return this._modules.layout
  }

  public static get oidcDiscovery() {
    return this._modules.oidcDiscovery
  }

  /** Возвращает application-scoped access-control module для активного backend. */
  public static get accessControl(): AccessControlModule {
    this._accessControl ??= createAccessControlModule(this._modules.connections.activeBackendURL)
    return this._accessControl
  }

  public static setup(app: App, router: Router): void {
    if (this._errorBoundary) {
      return
    }

    this._errorBoundary = new VueErrorBoundary_Adapter(app, router, this._modules.diagnostics)
    this._errorBoundary.setup()
    this._modules.chromeBridge.setup()
    EndgeIDE.setup(this._modules.context)
  }

  /** Checks session and starts Endge once for the initial router navigation. */
  public static async init(): Promise<ConfiguratorStatus> {
    if (this._status !== 'idle') {
      return this._status
    }

    if (!this._initialization) {
      this._initialization = this._initialize()
        .then((status) => {
          this._status = status
          return status
        })
        .finally(() => {
          this._initialization = null
        })
    }

    return this._initialization
  }

  public static get sessionBinding(): ConfiguratorSessionBinding {
    return {
      module: this._modules.session,
      logout: () => this.logout(),
    }
  }

  public static async logout(): Promise<void> {
    try {
      await this._modules.session.logout()
    }
    finally {
      clearConfiguratorBrowserState()
    }
    const state = await this._modules.session.check()
    if (state.status === 'unauthenticated') {
      this._startLoginOrThrow(state.loginUrl)
      return
    }
    if (state.status === 'error') {
      throw new ConfiguratorBootstrapError(state.code, state.message)
    }
    throw new ConfiguratorBootstrapError('logout_failed', 'Backend session remained authenticated after logout')
  }

  public static retryAuthentication(): void {
    const requirement = this._authenticationRequirement
    if (!requirement) {
      return
    }
    clearConfiguratorLoginRedirectGuard(requirement.backendURL)
    this._startLoginOrThrow(requirement.loginUrl, requirement.backendURL)
  }

  public static async reset(): Promise<void> {
    await EndgeIDE.reset()
    this._modules.i18n.reset()
    await this._modules.context.reset()
    this._modules.session.reset()
    this._modules.diagnostics.reset()
    this._modules.questions.reset()
    this._modules.layout.reset()
    this._accessControl = null
    this._authenticationRequirement = null
    this._backendConnectionFailure = null
    this._status = 'idle'
  }

  public static async destroy(): Promise<void> {
    await this.reset()
    this._errorBoundary?.destroy()
    this._errorBoundary = null
    this._modules.chromeBridge.destroy()
  }

  private static async _initialize(): Promise<ConfiguratorStatus> {
    this._authenticationRequirement = null
    this._backendConnectionFailure = null
    const backendConfig = getEndgeBackendConfig()
    if (!this._modules.connections.isPrimaryActive) {
      const primarySession = await new ConfiguratorSessionHttp_Adapter(backendConfig.primaryBackendURL).check()
      if (primarySession.status === 'unauthenticated') {
        return this._startLoginOrRequire(primarySession.loginUrl, backendConfig.primaryBackendURL)
      }
      if (primarySession.status !== 'authenticated') {
        return this._connectionFailed(
          backendConfig.primaryBackendURL,
          primarySession.status === 'error' ? primarySession.code : 'primary_session_unavailable',
          primarySession.status === 'error'
            ? primarySession.message
            : 'Primary backend session is unavailable',
        )
      }
      clearConfiguratorLoginRedirectGuard(backendConfig.primaryBackendURL)
      try {
        const catalog = await this._modules.connections.load()
        if (!this._modules.connections.hasActiveConnection(catalog)) {
          this._modules.connections.fallbackToPrimary()
          return 'redirecting'
        }
      }
      catch (error) {
        const value = error as { code?: string, message?: string }
        return this._connectionFailed(
          backendConfig.primaryBackendURL,
          value.code ?? 'backend_catalog_unavailable',
          value.message ?? 'Backend connection catalog is unavailable',
        )
      }
    }

    const sessionState = await this._modules.session.check()
    if (sessionState.status === 'unauthenticated') {
      return this._startLoginOrRequire(sessionState.loginUrl, backendConfig.activeBackendURL)
    }
    if (sessionState.status === 'error') {
      if (!this._modules.connections.isPrimaryActive) {
        return this._connectionFailed(
          backendConfig.activeBackendURL,
          sessionState.code,
          sessionState.message,
        )
      }
      throw new ConfiguratorBootstrapError(sessionState.code, sessionState.message)
    }
    if (sessionState.status !== 'authenticated') {
      throw new ConfiguratorBootstrapError('session_invalid_state', `Unexpected session state: ${sessionState.status}`)
    }

    clearConfiguratorLoginRedirectGuard(backendConfig.activeBackendURL)
    if (this._modules.connections.isPrimaryActive) {
      try {
        await this._modules.connections.load()
      }
      catch (error) {
        const value = error as { code?: string, message?: string }
        throw new ConfiguratorBootstrapError(
          value.code ?? 'backend_catalog_unavailable',
          value.message ?? 'Backend connection catalog is unavailable',
        )
      }
    }

    const storedWorkspace = this._modules.connections.readWorkspace()
    const workspaceSeed = String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
    const workspaceAccess = resolveConfiguratorWorkspace(
      sessionState.session.workspaces,
      storedWorkspace,
      workspaceSeed,
    )
    if (!workspaceAccess) {
      return 'workspace-selection-required'
    }
    if (storedWorkspace !== workspaceAccess.identity) {
      this._modules.connections.seedWorkspace(workspaceAccess.identity)
    }
    const workspaceIdentity = workspaceAccess.identity
    const role = sessionState.session.platformAdmin ? 'admin' : workspaceAccess?.role
    if (!role) {
      throw new ConfiguratorBootstrapError('workspace_forbidden', `Workspace access denied: ${workspaceIdentity}`)
    }

    const domainProvider = new ServiceBackendDomainHttp_Adapter(
      backendConfig.serviceBackendURL,
      loginUrl => this._startLoginOrThrow(loginUrl),
      role !== 'viewer',
    )
    await this._modules.context.init({ backendConfig, domainProvider, workspaceRole: role, workspaceIdentity })
    this._modules.i18n.init()
    return 'ready'
  }

  private static _connectionFailed(backendURL: string, code: string, message: string): ConfiguratorStatus {
    this._backendConnectionFailure = { backendURL, code, message }
    return 'backend-connection-failed'
  }

  private static _startLoginOrRequire(loginUrl: string, backendURL: string): ConfiguratorStatus {
    const result = startConfiguratorLogin(loginUrl, backendURL)
    if (result.redirected) {
      return 'redirecting'
    }
    if (result.code === 'auth_redirect_loop') {
      this._authenticationRequirement = { backendURL, loginUrl }
      return 'authentication-required'
    }
    throw new ConfiguratorBootstrapError(
      result.code ?? 'auth_redirect_failed',
      result.message ?? 'Configurator login redirect failed',
    )
  }

  private static _startLoginOrThrow(loginUrl: string, backendURL = this._modules.connections.activeBackendURL): void {
    const result = startConfiguratorLogin(loginUrl, backendURL)
    if (!result.redirected) {
      throw new ConfiguratorBootstrapError(
        result.code ?? 'auth_redirect_failed',
        result.message ?? 'Configurator login redirect failed',
      )
    }
  }
}
