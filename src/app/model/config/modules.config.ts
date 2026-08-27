import type { ConfiguratorModules } from '@/app/domain/types/configurator.type'

import { BrowserNavigation_Adapter } from '@/app/model/adapters/BrowserNavigation_Adapter'
import { ConfiguratorChromeBridge_Adapter } from '@/app/model/adapters/ConfiguratorChromeBridge_Adapter'
import { ConfiguratorDiagnosticsStorage_Adapter } from '@/app/model/adapters/ConfiguratorDiagnosticsStorage_Adapter'
import { FetchOidcDiscovery_Adapter } from '@/app/model/adapters/oidc/FetchOidcDiscovery_Adapter'
import { CONFIGURATOR_DIAGNOSTICS_CONFIG } from '@/app/model/config/diagnostics.config'
import { ConfiguratorChromeBridge_Module } from '@/app/model/modules/chrome-bridge/ConfiguratorChromeBridge_Module'
import { ConfiguratorContext_Module } from '@/app/model/modules/context/ConfiguratorContext_Module'
import { ConfiguratorDiagnostics_Module } from '@/app/model/modules/diagnostics/ConfiguratorDiagnostics_Module'
import { ConfiguratorI18n_Module } from '@/app/model/modules/i18n/ConfiguratorI18n_Module'
import { Layout_Module } from '@/app/model/modules/layout/Layout_Module'
import { OidcDiscovery_Module } from '@/app/model/modules/oidc-discovery/OidcDiscovery_Module'
import { Questions_Module } from '@/app/model/modules/questions/Questions_Module'
import { BackendConnectionsHttp_Adapter } from '@/features/backend-connections/model/adapters/BackendConnectionsHttp_Adapter'
import { BackendVersionHttp_Adapter } from '@/features/backend-connections/model/adapters/BackendVersionHttp_Adapter'
import { BackendConnections_Module } from '@/features/backend-connections/model/BackendConnections_Module'
import { BackendVersions_Module } from '@/features/backend-connections/model/BackendVersions_Module'
import { ConfiguratorSessionHttp_Adapter } from '@/features/configurator-session/model/adapters/ConfiguratorSessionHttp_Adapter'
import { ConfiguratorSession_Module } from '@/features/configurator-session/model/ConfiguratorSession_Module'
import { DomainVersionHttp_Adapter } from '@/features/domain-version/model/adapters/DomainVersionHttp_Adapter'
import { DomainVersions_Module } from '@/features/domain-version/model/DomainVersions_Module'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'

/** Creates the single application-scoped module graph. */
export function createConfiguratorModules(): ConfiguratorModules {
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
        void import('@/features/endge-ide/model/kernel/endge-ide')
          .then(({ EndgeIDE }) => EndgeIDE.reset())
          .catch(() => undefined)
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
