import type { OidcDiscoveryAdapter, OidcDiscoveryMetadata } from '@/app/domain/types/oidc-discovery.type'

/** Загружает OIDC discovery metadata через browser fetch. */
export class FetchOidcDiscovery_Adapter implements OidcDiscoveryAdapter {
  /** Запрашивает discovery document и проверяет HTTP-статус. */
  public async load(issuer: string): Promise<OidcDiscoveryMetadata> {
    const response = await fetch(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`)
    if (!response.ok) {
      throw new Error(`Discovery ответил HTTP ${response.status}`)
    }
    return response.json() as Promise<OidcDiscoveryMetadata>
  }
}
