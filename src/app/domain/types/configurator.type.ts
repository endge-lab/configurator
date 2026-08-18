import type { ConfiguratorChromeBridge_Module } from '@/app/model/modules/chrome-bridge/ConfiguratorChromeBridge_Module'
import type { ConfiguratorContext_Module } from '@/app/model/modules/context/ConfiguratorContext_Module'
import type { ConfiguratorDiagnostics_Module } from '@/app/model/modules/diagnostics/ConfiguratorDiagnostics_Module'
import type { ConfiguratorI18n_Module } from '@/app/model/modules/i18n/ConfiguratorI18n_Module'
import type { Layout_Module } from '@/app/model/modules/layout/Layout_Module'
import type { Questions_Module } from '@/app/model/modules/questions/Questions_Module'
import type { BackendConnections_Module } from '@/features/backend-connections/model/BackendConnections_Module'
import type { ConfiguratorSession_Module } from '@/features/configurator-session'
import type { DomainVersions_Module } from '@/features/domain-version/model/DomainVersions_Module'

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
  domainVersions: DomainVersions_Module
  context: ConfiguratorContext_Module
  diagnostics: ConfiguratorDiagnostics_Module
  i18n: ConfiguratorI18n_Module
  chromeBridge: ConfiguratorChromeBridge_Module
  questions: Questions_Module
  layout: Layout_Module
}
