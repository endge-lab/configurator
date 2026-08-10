/* eslint-disable perfectionist/sort-imports -- Endge plugins must be registered before context runtime is evaluated */
import '@/features/endge-ide/model/bootstrap/endge-runtime-plugins'
import '@/features/endge-ide/model/bootstrap/endge-renderer-plugins'

import type { ConfiguratorModules, ConfiguratorStatus } from '@/app/domain/types/configurator.type'
import type { ConfiguratorSessionBinding } from '@/features/configurator-session'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import {
  clearConfiguratorLoginRedirectGuard,
  startConfiguratorLogin,
} from '@/features/configurator-session'

import { createConfiguratorModules } from '@/app/model/config/modules.config'
import { VueErrorBoundary_Adapter } from '@/app/model/adapters/VueErrorBoundary_Adapter'
import { ServiceBackendDomain_Service } from '@/features/endge-ide/model/backend/ServiceBackendDomain_Service'
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
  private static _errorBoundary: VueErrorBoundary_Adapter | null = null

  private constructor() {}

  public static get isReady(): boolean {
    return this._status === 'ready'
  }

  public static get session() {
    return this._modules.session
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

  public static get branding() {
    return this._modules.branding
  }

  public static get questions() {
    return this._modules.questions
  }

  public static get layout() {
    return this._modules.layout
  }

  public static setup(app: App, router: Router): void {
    if (this._errorBoundary) {
      return
    }

    this._errorBoundary = new VueErrorBoundary_Adapter(app, router, this._modules.diagnostics)
    this._errorBoundary.setup()
    this._modules.branding.setup(app)
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
    await this._modules.session.logout()
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

  public static async reset(): Promise<void> {
    await EndgeIDE.reset()
    this._modules.i18n.reset()
    await this._modules.context.reset()
    this._modules.session.reset()
    this._modules.diagnostics.reset()
    this._modules.questions.reset()
    this._modules.layout.reset()
    this._status = 'idle'
  }

  public static async destroy(): Promise<void> {
    await this.reset()
    this._errorBoundary?.destroy()
    this._errorBoundary = null
    this._modules.chromeBridge.destroy()
    this._modules.branding.destroy()
  }

  private static async _initialize(): Promise<ConfiguratorStatus> {
    const sessionState = await this._modules.session.check()
    if (sessionState.status === 'unauthenticated') {
      this._startLoginOrThrow(sessionState.loginUrl)
      return 'redirecting'
    }
    if (sessionState.status === 'error') {
      throw new ConfiguratorBootstrapError(sessionState.code, sessionState.message)
    }
    if (sessionState.status !== 'authenticated') {
      throw new ConfiguratorBootstrapError('session_invalid_state', `Unexpected session state: ${sessionState.status}`)
    }

    clearConfiguratorLoginRedirectGuard()
    const backendConfig = getEndgeBackendConfig()
    const workspaceIdentity = String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
    const workspaceAccess = sessionState.session.workspaces.find(workspace => workspace.identity === workspaceIdentity)
    const role = sessionState.session.platformAdmin ? 'admin' : workspaceAccess?.role
    if (!role) {
      throw new ConfiguratorBootstrapError('workspace_forbidden', `Workspace access denied: ${workspaceIdentity}`)
    }

    const domainProvider = new ServiceBackendDomain_Service(
      backendConfig.serviceBackendURL,
      loginUrl => this._startLoginOrThrow(loginUrl),
      role !== 'viewer',
    )
    await this._modules.context.init({ backendConfig, domainProvider, workspaceRole: role })
    this._modules.i18n.init()
    return 'ready'
  }

  private static _startLoginOrThrow(loginUrl: string): void {
    const result = startConfiguratorLogin(loginUrl)
    if (!result.redirected) {
      throw new ConfiguratorBootstrapError(
        result.code ?? 'auth_redirect_failed',
        result.message ?? 'Configurator login redirect failed',
      )
    }
  }
}
