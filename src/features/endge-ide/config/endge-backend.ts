import type { EndgeBackendConfig } from '@/features/endge-ide/domain/types/endge-backend.type'

import { BackendConnectionStorage, normalizeBackendURL } from '@/features/backend-connections/services/backend-connection-storage'

/** Ошибка некорректной build-time конфигурации backend. */
export class EndgeBackendConfigurationError extends Error {
  public readonly code = 'backend_configuration_invalid'

  public constructor(message: string) {
    super(message)
    this.name = 'EndgeBackendConfigurationError'
  }
}

/** Читает обязательный primary URL и локально выбранный target. */
export function getEndgeBackendConfig(): EndgeBackendConfig {
  const primaryBackendURL = normalizeHTTPURL(
    requiredEnv('VITE_ENDGE_SERVICE_BACKEND_URL', import.meta.env.VITE_ENDGE_SERVICE_BACKEND_URL),
  )
  const activeBackendURL = new BackendConnectionStorage().readActiveBackend(primaryBackendURL)
  return {
    serviceBackendURL: activeBackendURL,
    primaryBackendURL,
    activeBackendURL,
  }
}

function requiredEnv(name: string, value: unknown): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new EndgeBackendConfigurationError(`${name} is required`)
  }
  return normalized
}

function normalizeHTTPURL(value: string): string {
  try {
    return normalizeBackendURL(value)
  }
  catch {
    throw new EndgeBackendConfigurationError('VITE_ENDGE_SERVICE_BACKEND_URL must be a valid http/https URL')
  }
}
