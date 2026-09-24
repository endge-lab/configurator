import type { EndgeBackendConfig } from '@/features/endge-ide/domain/types/endge-backend.type'

import { BackendConnectionStorage, normalizeBackendURL } from '@/features/backend-connections/services/backend-connection-storage'

/**
 * Ошибка некорректной build-time конфигурации backend.
 */
export class EndgeBackendConfigurationError extends Error {
  public readonly code = 'backend_configuration_invalid'

  public constructor(message: string) {
    super(message)
    this.name = 'EndgeBackendConfigurationError'
  }
}

// Возвращает необязательное стартовое подключение из build-time env.
export function getDefaultBackendURL(): string | null {
  const value = String(import.meta.env.VITE_ENDGE_SERVICE_BACKEND_URL ?? '').trim()
  return value ? normalizeHTTPURL(value) : null
}

// Возвращает transport-конфигурацию явно выбранного backend.
export function getEndgeBackendConfig(): EndgeBackendConfig {
  const activeBackendURL = new BackendConnectionStorage().readActiveBackend()
  if (!activeBackendURL) {
    throw new EndgeBackendConfigurationError('Backend connection is not selected')
  }
  return {
    serviceBackendURL: activeBackendURL,
    activeBackendURL,
  }
}

function normalizeHTTPURL(value: string): string {
  try {
    return normalizeBackendURL(value)
  }
  catch {
    throw new EndgeBackendConfigurationError('VITE_ENDGE_SERVICE_BACKEND_URL must be empty or a valid http/https URL')
  }
}
