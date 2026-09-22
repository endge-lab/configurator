import { describe, expect, it } from 'vitest'

import { getCanonicalLocalhostURL, getConfiguratorOidcPopupCallbackURL } from '@/features/endge-ide/services/auth/oidc-browser-url'

describe('проверка URL callback OIDC в Configurator', () => {
  it('приводит числовые loopback origins к localhost', () => {
    expect(getConfiguratorOidcPopupCallbackURL('http://127.0.0.1:5173'))
      .toBe('http://localhost:5173/auth/oidc/popup-callback')
    expect(getConfiguratorOidcPopupCallbackURL('https://configurator.example.test'))
      .toBe('https://configurator.example.test/auth/oidc/popup-callback')
  })

  it('канонизирует полный URL приложения перед запуском PKCE', () => {
    expect(getCanonicalLocalhostURL('http://127.0.0.1:5173/project?id=1#preview'))
      .toBe('http://localhost:5173/project?id=1#preview')
    expect(getCanonicalLocalhostURL('https://configurator.example.test/project')).toBeNull()
  })
})
