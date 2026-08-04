/** Build-time backend mode Configurator. */
export type EndgeBackendMode = 'payload' | 'service-backend'

/** Immutable конфигурация legacy Payload режима. */
export interface EndgePayloadBackendConfig {
  mode: 'payload'
  payloadBaseURL: string
  payloadSecret: string
}

/** Immutable конфигурация нового service backend режима. */
export interface EndgeServiceBackendConfig {
  mode: 'service-backend'
  serviceBackendURL: string
}

export type EndgeBackendConfig = EndgePayloadBackendConfig | EndgeServiceBackendConfig
