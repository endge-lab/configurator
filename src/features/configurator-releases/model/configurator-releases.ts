import { Endge } from '@endge/core'

import { ConfiguratorReleasesHttp_Adapter } from '@/features/configurator-releases/model/adapters/ConfiguratorReleasesHttp_Adapter'
import { ConfiguratorReleases_Module } from '@/features/configurator-releases/model/ConfiguratorReleases_Module'
import { getEndgeBackendConfig } from '@/features/endge-ide/model/config/endge-backend'

export const configuratorReleases = new ConfiguratorReleases_Module(
  new ConfiguratorReleasesHttp_Adapter(
    getEndgeBackendConfig().serviceBackendURL,
    () => Endge.workspace.current.identity,
  ),
)
