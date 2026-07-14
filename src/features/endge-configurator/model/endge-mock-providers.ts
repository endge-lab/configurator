import { Endge, ENDGE_CORE_MOCK_PROVIDERS } from '@endge/core'

/** Регистрирует application-owned mock providers до сборки program artifacts. */
export function registerEndgeMockProviders(): void {
  const registeredRefs = new Set(Endge.mock.listProviders().map(provider => provider.ref))

  for (const provider of ENDGE_CORE_MOCK_PROVIDERS) {
    if (!registeredRefs.has(provider.ref)) {
      Endge.mock.registerProvider(provider)
    }
  }
}
