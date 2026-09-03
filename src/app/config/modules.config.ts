import type { ConfiguratorModules } from '@/app/domain/types/configurator.type'

import { BrowserNavigation_Adapter } from '@/app/adapters/BrowserNavigation_Adapter'
import { ConfiguratorChromeBridge_Adapter } from '@/app/adapters/ConfiguratorChromeBridge_Adapter'
import { ConfiguratorDiagnosticsStorage_Adapter } from '@/app/adapters/ConfiguratorDiagnosticsStorage_Adapter'
import { FetchOidcDiscovery_Adapter } from '@/app/adapters/oidc/FetchOidcDiscovery_Adapter'
import { CONFIGURATOR_DIAGNOSTICS_CONFIG } from '@/app/config/diagnostics.config'
import { ConfiguratorChromeBridge_Module } from '@/app/modules/ConfiguratorChromeBridge_Module'
import { ConfiguratorContext_Module } from '@/app/modules/ConfiguratorContext_Module'
import { ConfiguratorDiagnostics_Module } from '@/app/modules/ConfiguratorDiagnostics_Module'
import { ConfiguratorI18n_Module } from '@/app/modules/ConfiguratorI18n_Module'
import { Layout_Module } from '@/app/modules/Layout_Module'
import { OidcDiscovery_Module } from '@/app/modules/OidcDiscovery_Module'
import { Questions_Module } from '@/app/modules/Questions_Module'
import { BackendConnectionsHttp_Adapter } from '@/features/backend-connections/adapters/BackendConnectionsHttp_Adapter'
import { BackendVersionHttp_Adapter } from '@/features/backend-connections/adapters/BackendVersionHttp_Adapter'
import { BackendConnections_Module } from '@/features/backend-connections/modules/BackendConnections_Module'
import { BackendVersions_Module } from '@/features/backend-connections/modules/BackendVersions_Module'
import { ConfiguratorSessionHttp_Adapter } from '@/features/configurator-session/adapters/ConfiguratorSessionHttp_Adapter'
import { ConfiguratorSession_Module } from '@/features/configurator-session/ConfiguratorSession_Module'
import { DomainVersionHttp_Adapter } from '@/features/domain-version/adapters/DomainVersionHttp_Adapter'
import { DomainVersions_Module } from '@/features/domain-version/DomainVersions_Module'
import { getEndgeBackendConfig } from '@/features/endge-ide/config/endge-backend'

/** Creates the single application-scoped module graph. */
export function createConfiguratorModules(resetEndgeIDE: () => Promise<void>): ConfiguratorModules {
  const backendConfig = getEndgeBackendConfig()
  const connections = new BackendConnections_Module(
    backendConfig.primaryBackendURL,
    new BackendConnectionsHttp_Adapter(backendConfig.primaryBackendURL),
    undefined,
    () => new BrowserNavigation_Adapter().reload(),
  )

  return {
    connections,
    backendVersions: new BackendVersions_Module(new BackendVersionHttp_Adapter()),
    domainVersions: new DomainVersions_Module(new DomainVersionHttp_Adapter()),
    session: new ConfiguratorSession_Module(
      new ConfiguratorSessionHttp_Adapter(connections.activeBackendURL),
    ),
    context: new ConfiguratorContext_Module(),
    diagnostics: new ConfiguratorDiagnostics_Module(
      CONFIGURATOR_DIAGNOSTICS_CONFIG,
      () => {
        void resetEndgeIDE().catch(() => undefined)
      },
      new ConfiguratorDiagnosticsStorage_Adapter(),
    ),
    i18n: new ConfiguratorI18n_Module(),
    chromeBridge: new ConfiguratorChromeBridge_Module(new ConfiguratorChromeBridge_Adapter()),
    questions: new Questions_Module(),
    layout: new Layout_Module(),
    oidcDiscovery: new OidcDiscovery_Module(new FetchOidcDiscovery_Adapter()),
  }
}
