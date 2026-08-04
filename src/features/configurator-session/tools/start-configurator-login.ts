import type { ConfiguratorLoginRedirectResult } from '@/features/configurator-session/domain/types/configurator-session.type'

import {
  CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY,
  CONFIGURATOR_LOGIN_REDIRECT_GUARD_MS,
} from '@/features/configurator-session/model/config/configurator-session'

/** Удаляет redirect guard после успешного восстановления session. */
export function clearConfiguratorLoginRedirectGuard(): void {
  try {
    window.sessionStorage.removeItem(CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY)
  }
  catch {
    // Storage может быть запрещён политикой браузера; session продолжает работать без guard.
  }
}

/** Запускает backend-owned login flow, сохраняя текущий Configurator URL. */
export function startConfiguratorLogin(loginUrl: string): ConfiguratorLoginRedirectResult {
  const now = Date.now()
  try {
    const previous = Number(window.sessionStorage.getItem(CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY))
    if (Number.isFinite(previous) && now - previous < CONFIGURATOR_LOGIN_REDIRECT_GUARD_MS) {
      return {
        redirected: false,
        code: 'auth_redirect_loop',
        message: 'Configurator session was not restored after login callback',
      }
    }
  }
  catch {
    // Storage guard недоступен; backend state/nonce всё равно защищают login transaction.
  }

  let target: URL
  try {
    target = new URL(loginUrl, window.location.origin)
  }
  catch {
    return { redirected: false, code: 'auth_login_url_invalid', message: 'Backend returned invalid loginUrl' }
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return { redirected: false, code: 'auth_login_url_invalid', message: 'Backend returned unsupported loginUrl' }
  }

  target.searchParams.set('returnTo', window.location.href)
  try {
    window.sessionStorage.setItem(CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY, String(now))
  }
  catch {
    // Redirect остаётся доступен без sessionStorage.
  }
  window.location.assign(target.toString())
  return { redirected: true }
}
