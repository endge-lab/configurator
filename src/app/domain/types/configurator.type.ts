import type { ConfiguratorChromeBridge_Module } from '@/app/modules/ConfiguratorChromeBridge_Module'
import type { ConfiguratorContext_Module } from '@/app/modules/ConfiguratorContext_Module'
import type { ConfiguratorDiagnostics_Module } from '@/app/modules/ConfiguratorDiagnostics_Module'
import type { ConfiguratorI18n_Module } from '@/app/modules/ConfiguratorI18n_Module'
import type { Layout_Module } from '@/app/modules/Layout_Module'
import type { OidcDiscovery_Module } from '@/app/modules/OidcDiscovery_Module'
import type { Questions_Module } from '@/app/modules/Questions_Module'
import type { BackendConnections_Module } from '@/features/backend-connections/modules/BackendConnections_Module'
import type { BackendVersions_Module } from '@/features/backend-connections/modules/BackendVersions_Module'
import type { ConfiguratorSession_Module } from '@/features/configurator-session'
import type { DomainVersions_Module } from '@/features/domain-version/DomainVersions_Module'

export type ConfiguratorStatus
  = | 'authentication-required'
    | 'backend-connection-failed'
    | 'ready'
    | 'redirecting'
    | 'workspace-selection-required'

export interface ConfiguratorAuthenticationRequirement {
  backendURL: string
  loginUrl: string
}

export interface ConfiguratorBackendConnectionFailure {
  backendURL: string
  code: string
  message: string
}

export interface ConfiguratorModules {
  session: ConfiguratorSession_Module
  connections: BackendConnections_Module
  backendVersions: BackendVersions_Module
  domainVersions: DomainVersions_Module
  context: ConfiguratorContext_Module
  diagnostics: ConfiguratorDiagnostics_Module
  i18n: ConfiguratorI18n_Module
  chromeBridge: ConfiguratorChromeBridge_Module
  questions: Questions_Module
  layout: Layout_Module
  oidcDiscovery: OidcDiscovery_Module
}
