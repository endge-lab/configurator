/* eslint-disable perfectionist/sort-imports -- Endge plugins must be registered before context runtime is evaluated */
import './endge-runtime-plugins'
import './endge-renderer-plugins'

import {
  clearConfiguratorLoginRedirectGuard,
  ConfiguratorSession_Module,
  ConfiguratorSession_Service,
  startConfiguratorLogin,
} from '@/features/configurator-session'
import { ServiceBackendDomain_Service } from '@/features/endge-ide/model/backend/ServiceBackendDomain_Service'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'
import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'
/* eslint-enable perfectionist/sort-imports */

let configuratorSessionModule: ConfiguratorSession_Module | null = null

/** Typed bootstrap error, сохраняющий стабильный code для будущего error UI. */
export class EndgeIDEBootstrapError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'EndgeIDEBootstrapError'
  }
}

/** Boots the Endge engine and establishes the initial IDE execution context. */
export async function bootstrapEndgeIDE(): Promise<boolean> {
  const backendConfig = getEndgeBackendConfig()
  configuratorSessionModule = new ConfiguratorSession_Module(
    new ConfiguratorSession_Service(backendConfig.serviceBackendURL),
  )
  const sessionState = await configuratorSessionModule.check()
  if (sessionState.status === 'unauthenticated') {
    startLoginOrThrow(sessionState.loginUrl)
    return false
  }
  if (sessionState.status === 'error') {
    throw new EndgeIDEBootstrapError(sessionState.code, sessionState.message)
  }
  if (sessionState.status !== 'authenticated') {
    throw new EndgeIDEBootstrapError('session_invalid_state', `Unexpected session state: ${sessionState.status}`)
  }

  clearConfiguratorLoginRedirectGuard()
  const workspaceIdentity = String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
  const workspaceAccess = sessionState.session.workspaces.find(workspace => workspace.identity === workspaceIdentity)
  const role = sessionState.session.platformAdmin ? 'admin' : workspaceAccess?.role
  if (!role) {
    throw new EndgeIDEBootstrapError('workspace_forbidden', `Workspace access denied: ${workspaceIdentity}`)
  }
  const domainProvider = new ServiceBackendDomain_Service(
    backendConfig.serviceBackendURL,
    startLoginOrThrow,
    role !== 'viewer',
  )
  await EndgeIDEContext.init({ backendConfig, domainProvider, workspaceRole: role })
  return true
}

/** Возвращает session owner только в service-backend режиме. */
export function getConfiguratorSessionModule(): ConfiguratorSession_Module | null {
  return configuratorSessionModule
}

/** Отзывает developer session и начинает новый backend-owned login flow. */
export async function logoutConfiguratorSession(): Promise<void> {
  const sessionModule = configuratorSessionModule
  if (!sessionModule) {
    throw new EndgeIDEBootstrapError('session_not_configured', 'Configurator session is not configured')
  }

  await sessionModule.logout()
  const state = await sessionModule.check()
  if (state.status === 'unauthenticated') {
    startLoginOrThrow(state.loginUrl)
    return
  }
  if (state.status === 'error') {
    throw new EndgeIDEBootstrapError(state.code, state.message)
  }
  throw new EndgeIDEBootstrapError('logout_failed', 'Backend session remained authenticated after logout')
}

function startLoginOrThrow(loginUrl: string): void {
  const result = startConfiguratorLogin(loginUrl)
  if (!result.redirected) {
    throw new EndgeIDEBootstrapError(
      result.code ?? 'auth_redirect_failed',
      result.message ?? 'Configurator login redirect failed',
    )
  }
}
