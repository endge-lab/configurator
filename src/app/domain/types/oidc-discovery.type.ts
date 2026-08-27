/** Минимальные metadata, необходимые для проверки OIDC discovery. */
export interface OidcDiscoveryMetadata {
  authorization_endpoint?: unknown
  token_endpoint?: unknown
}

/** Контракт transport-адаптера OIDC discovery. */
export interface OidcDiscoveryAdapter {
  load(issuer: string): Promise<OidcDiscoveryMetadata>
}
