import type { IntegrationDisposer } from '@endge/integration-api'

import { ConfiguratorIntegrationHost } from '@/features/endge-ide/model/integrations/configurator-integration-host'

/** Starts the external test registry only in development or its explicit build mode. */
export async function startTestConfiguratorIntegrations(): Promise<IntegrationDisposer> {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test-integrations') {
    return () => undefined
  }

  const { default: modules } = await import('virtual:endge-test-integrations')
  const host = new ConfiguratorIntegrationHost(modules)
  return host.start()
}
