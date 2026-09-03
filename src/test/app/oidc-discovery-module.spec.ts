import type { OidcDiscoveryAdapter } from '@/app/domain/types/oidc-discovery.type'
import { describe, expect, it, vi } from 'vitest'
import { OidcDiscovery_Module } from '@/app/modules/OidcDiscovery_Module'

describe('oidcDiscovery_Module', () => {
  /** Не запускает transport без заданного issuer. */
  it('отклоняет пустой issuer до обращения к adapter', async () => {
    const adapter: OidcDiscoveryAdapter = { load: vi.fn() }
    const module = new OidcDiscovery_Module(adapter)

    await expect(module.check('')).rejects.toThrow('Укажите issuer')
    expect(adapter.load).not.toHaveBeenCalled()
  })

  /** Принимает discovery document только с обоими обязательными endpoints. */
  it('проверяет обязательные endpoints metadata', async () => {
    const adapter: OidcDiscoveryAdapter = {
      load: vi.fn(async () => ({ authorization_endpoint: 'https://id.test/auth' })),
    }
    const module = new OidcDiscovery_Module(adapter)

    await expect(module.check('https://id.test')).rejects.toThrow('token_endpoint')
  })
})
