import { Endge } from '@endge/core'

import { ConfiguratorReleases_Module } from '@/features/configurator-releases/model/ConfiguratorReleases_Module'
import { ConfiguratorReleases_Service } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'

export const configuratorReleases = new ConfiguratorReleases_Module(
  new ConfiguratorReleases_Service(
    getEndgeBackendConfig().serviceBackendURL,
    () => Endge.workspace.current.identity,
  ),
)
