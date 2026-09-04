import { createRouter, createWebHistory } from 'vue-router'

import { Configurator } from '@/app/Configurator'
import { routes } from '@/app/router/routes.ts'
import { getCanonicalLocalhostURL } from '@/features/endge-ide/services/auth/oidc-browser-url'

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
    if (Configurator.isReady) {
      await Configurator.deactivateIDE()
    }
    return true
  }
  const status = await Configurator.init()
  if (status === 'ready') {
    if (to.meta.layoutScope === 'endge-ide') {
      await Configurator.activateIDE()
    }
    else {
      await Configurator.deactivateIDE()
    }
    return true
  }
  return status === 'authentication-required'
    || status === 'workspace-selection-required'
    || status === 'backend-connection-failed'
})

router.onError((error) => {
  console.error(`[Router] Navigation error: ${error instanceof Error ? error.message : String(error)}`)
})

export default router
