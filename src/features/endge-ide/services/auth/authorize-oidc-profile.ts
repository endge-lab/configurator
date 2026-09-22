import { Endge } from '@endge/core'

import { getConfiguratorOidcPopupCallbackURL } from '@/features/endge-ide/services/auth/oidc-browser-url'

/** Получает browser session выбранного OIDC profile по явному действию пользователя. */
export async function authorizeOidcProfile(profileIdentity: string): Promise<void> {
  const profile = Endge.auth.profiles.requireActive(profileIdentity)
  if (profile.adapterId !== 'oidc') {
    throw new Error(`Интерактивный вход для профиля ${profile.identity} не поддерживается`)
  }
  const callback = getConfiguratorOidcPopupCallbackURL()
  const source = Endge.auth.createOidcSessionSource(profile, {
    redirectUri: callback,
    popupRedirectUri: callback,
    postLogoutRedirectUri: new URL(callback).origin,
    flow: 'popup',
  })
  await source.loginPopup()
  Endge.auth.session.connect(profile.identity, source)
  await Endge.auth.session.ensureProfile(profile)
}
