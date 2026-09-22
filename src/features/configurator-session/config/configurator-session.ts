/** Session-scoped защита от бесконечного callback/login redirect. */
export const CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY_PREFIX = 'endge:configurator-login-redirect:v2'

/** Время, в течение которого повторный 401 считается неуспешным callback. */
export const CONFIGURATOR_LOGIN_REDIRECT_GUARD_MS = 2 * 60 * 1000
