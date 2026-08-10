import type { ConfiguratorModules } from '@/app/domain/types/configurator.type'

import { CONFIGURATOR_DIAGNOSTICS_CONFIG } from '@/app/model/config/diagnostics.config'
import { ConfiguratorBranding_Module } from '@/app/model/modules/branding/ConfiguratorBranding_Module'
import { ConfiguratorChromeBridge_Module } from '@/app/model/modules/chrome-bridge/ConfiguratorChromeBridge_Module'
import { ConfiguratorContext_Module } from '@/app/model/modules/context/ConfiguratorContext_Module'
import { ConfiguratorDiagnostics_Module } from '@/app/model/modules/diagnostics/ConfiguratorDiagnostics_Module'
import { ConfiguratorI18n_Module } from '@/app/model/modules/i18n/ConfiguratorI18n_Module'
import { Layout_Module } from '@/app/model/modules/layout/Layout_Module'
import { Questions_Module } from '@/app/model/modules/questions/Questions_Module'
import { ConfiguratorSession_Module, ConfiguratorSession_Service } from '@/features/configurator-session'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'

/** Creates the single application-scoped module graph. */
export function createConfiguratorModules(): ConfiguratorModules {
  const backendConfig = getEndgeBackendConfig()
  const branding = new ConfiguratorBranding_Module()

  return {
    session: new ConfiguratorSession_Module(
      new ConfiguratorSession_Service(backendConfig.serviceBackendURL),
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
    i18n: new ConfiguratorI18n_Module(branding.value),
    chromeBridge: new ConfiguratorChromeBridge_Module(),
    branding,
    questions: new Questions_Module(),
    layout: new Layout_Module(),
  }
}
