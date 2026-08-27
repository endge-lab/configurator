import { createRouter, createWebHistory } from 'vue-router'

import { Configurator } from '@/app/model/kernel/configurator'
import { getCanonicalLocalhostURL } from '@/features/endge-ide/model/auth/oidc-browser-url'
import { routes } from '@/router/routes.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Initial navigation является boot-барьером. Специальные bootstrap-состояния
// допускают mount приложения, но App перекрывает RouterView своим gate.
router.beforeEach(async (to) => {
  const canonicalURL = getCanonicalLocalhostURL()
  if (canonicalURL) {
    window.location.replace(canonicalURL)
    return false
  }
  if (to.name === 'oidc-popup-callback') {
    return true
  }
  const status = await Configurator.init()
  return status === 'ready'
    || status === 'authentication-required'
    || status === 'workspace-selection-required'
    || status === 'backend-connection-failed'
})

router.onError((error) => {
  console.error(`[Router] Navigation error: ${error instanceof Error ? error.message : String(error)}`)
})

export default router
