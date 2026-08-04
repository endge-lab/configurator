import type { EndgeBackendConfig, EndgeBackendMode } from '@/features/endge-ide/domain/types/endge-backend.type'

/** Ошибка некорректной build-time конфигурации backend. */
export class EndgeBackendConfigurationError extends Error {
  public readonly code = 'backend_configuration_invalid'

  public constructor(message: string) {
    super(message)
    this.name = 'EndgeBackendConfigurationError'
  }
}

/** Читает и строго валидирует build-time backend mode Configurator. */
export function getEndgeBackendConfig(): EndgeBackendConfig {
  const mode = String(import.meta.env.VITE_ENDGE_BACKEND_ADAPTER || 'payload').trim() as EndgeBackendMode
  if (mode === 'payload') {
    return {
      mode,
      payloadBaseURL: requiredEnv('VITE_PAYLOAD_BASE_URL', import.meta.env.VITE_PAYLOAD_BASE_URL),
      payloadSecret: requiredEnv('VITE_PAYLOAD_SECRET', import.meta.env.VITE_PAYLOAD_SECRET),
    }
  }
  if (mode === 'service-backend') {
    requiredEnv('VITE_ENDGE_WORKSPACE_IDENTITY', import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY)
    return {
      mode,
      serviceBackendURL: normalizeHTTPURL(
        requiredEnv('VITE_ENDGE_SERVICE_BACKEND_URL', import.meta.env.VITE_ENDGE_SERVICE_BACKEND_URL),
      ),
    }
  }
  throw new EndgeBackendConfigurationError(`Unknown VITE_ENDGE_BACKEND_ADAPTER: ${mode}`)
}

function requiredEnv(name: string, value: unknown): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new EndgeBackendConfigurationError(`${name} is required`)
  }
  return normalized
}

function normalizeHTTPURL(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new EndgeBackendConfigurationError('VITE_ENDGE_SERVICE_BACKEND_URL must be a valid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EndgeBackendConfigurationError('VITE_ENDGE_SERVICE_BACKEND_URL must use http or https')
  }
  return url.toString().replace(/\/+$/, '')
}
