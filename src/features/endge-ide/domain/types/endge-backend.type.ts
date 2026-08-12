/** Immutable конфигурация primary и выбранного target backend Configurator. */
export interface EndgeBackendConfig {
  serviceBackendURL: string
  primaryBackendURL: string
  activeBackendURL: string
}
