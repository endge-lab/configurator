/** Возвращает callback зарегистрированного OIDC client, канонизируя loopback как localhost. */
export function getConfiguratorOidcPopupCallbackURL(origin: string = location.origin): string {
  const parsed = new URL(origin)
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]')
    parsed.hostname = 'localhost'
  return new URL('/auth/oidc/popup-callback', parsed.origin).href
}

/** Returns the same application URL on localhost so PKCE state and callback share one origin. */
export function getCanonicalLocalhostURL(href: string = location.href): string | null {
  const parsed = new URL(href)
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== '[::1]')
    return null
  parsed.hostname = 'localhost'
  return parsed.href
}
