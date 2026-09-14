import type { ConfiguratorConnection } from '@endge/core'

/** Подключение другой вкладки с признаками для списка присутствия. */
export interface ConfiguratorPresenceConnection extends ConfiguratorConnection {
  isOwnAccount: boolean
  initials: string
}
