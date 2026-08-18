import type { ConfiguratorModules } from '@/app/domain/types/configurator.type'

import { CONFIGURATOR_DIAGNOSTICS_CONFIG } from '@/app/model/config/diagnostics.config'
import { ConfiguratorChromeBridge_Module } from '@/app/model/modules/chrome-bridge/ConfiguratorChromeBridge_Module'
import { ConfiguratorContext_Module } from '@/app/model/modules/context/ConfiguratorContext_Module'
import { ConfiguratorDiagnostics_Module } from '@/app/model/modules/diagnostics/ConfiguratorDiagnostics_Module'
import { ConfiguratorI18n_Module } from '@/app/model/modules/i18n/ConfiguratorI18n_Module'
import { Layout_Module } from '@/app/model/modules/layout/Layout_Module'
import { Questions_Module } from '@/app/model/modules/questions/Questions_Module'
import { BackendConnections_Module } from '@/features/backend-connections/model/BackendConnections_Module'
import { BackendConnections_Service } from '@/features/backend-connections/model/BackendConnections_Service'
import { ConfiguratorSession_Module } from '@/features/configurator-session/model/ConfiguratorSession_Module'
import { ConfiguratorSession_Service } from '@/features/configurator-session/model/ConfiguratorSession_Service'
import { DomainVersion_Service } from '@/features/domain-version/model/DomainVersion_Service'
import { DomainVersions_Module } from '@/features/domain-version/model/DomainVersions_Module'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'

/** Creates the single application-scoped module graph. */
export function createConfiguratorModules(): ConfiguratorModules {
  const backendConfig = getEndgeBackendConfig()
  const connections = new BackendConnections_Module(
    backendConfig.primaryBackendURL,
    new BackendConnections_Service(backendConfig.primaryBackendURL),
  )

  return {
    connections,
    domainVersions: new DomainVersions_Module(new DomainVersion_Service()),
    session: new ConfiguratorSession_Module(
      new ConfiguratorSession_Service(connections.activeBackendURL),
    ),
    context: new ConfiguratorContext_Module(),
    diagnostics: new ConfiguratorDiagnostics_Module(
      CONFIGURATOR_DIAGNOSTICS_CONFIG,
      () => {
        void import('@/features/endge-ide/model/kernel/endge-ide')
          .then(({ EndgeIDE }) => EndgeIDE.reset())
          .catch(() => undefined)
      },
    ),
    i18n: new ConfiguratorI18n_Module(),
    chromeBridge: new ConfiguratorChromeBridge_Module(),
    questions: new Questions_Module(),
    layout: new Layout_Module(),
  }
}
