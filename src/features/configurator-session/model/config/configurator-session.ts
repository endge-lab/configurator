/** Session-scoped защита от бесконечного callback/login redirect. */
export const CONFIGURATOR_LOGIN_REDIRECT_GUARD_KEY = 'endge:configurator-login-redirect'

/** Время, в течение которого повторный 401 считается неуспешным callback. */
export const CONFIGURATOR_LOGIN_REDIRECT_GUARD_MS = 2 * 60 * 1000
