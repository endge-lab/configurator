import type { ConfiguratorLoginRedirectResult } from '@/features/configurator-session/domain/types/configurator-session.type'

import {
  CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY_PREFIX,
  CONFIGURATOR_LOGIN_REDIRECT_GUARD_MS,
} from '@/features/configurator-session/config/configurator-session'

/** Удаляет redirect guard после успешного восстановления session. */
export function clearConfiguratorLoginRedirectGuard(backendURL: string): void {
  try {
    window.sessionStorage.removeItem(redirectGuardKey(backendURL))
  }
  catch {
    // Storage может быть запрещён политикой браузера; session продолжает работать без guard.
  }
}

/** Запускает backend-owned login flow, сохраняя текущий Configurator URL. */
export function startConfiguratorLogin(loginUrl: string, backendURL: string): ConfiguratorLoginRedirectResult {
  const now = Date.now()
  const guardKey = redirectGuardKey(backendURL)
  try {
    const previous = Number(window.sessionStorage.getItem(guardKey))
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
    window.sessionStorage.setItem(guardKey, String(now))
  }
  catch {
    // Redirect остаётся доступен без sessionStorage.
  }
  window.location.assign(target.toString())
  return { redirected: true }
}

function redirectGuardKey(backendURL: string): string {
  let origin = String(backendURL ?? '').trim()
  try {
    origin = new URL(origin).origin
  }
  catch {
    // Некорректный URL будет отдельно отклонён login flow.
  }
  return `${CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY_PREFIX}:${encodeURIComponent(origin)}`
}
