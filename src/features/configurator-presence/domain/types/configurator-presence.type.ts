import type { ConfiguratorConnection } from '@endge/core'

/** Активное подключение Configurator с признаками для списка присутствия. */
export interface ConfiguratorPresenceConnection extends ConfiguratorConnection {
  isCurrentInstance: boolean
  isOwnAccount: boolean
  initials: string
}
