/* eslint-disable perfectionist/sort-imports -- Configurator registers Endge plugins before UI modules are evaluated */
import type { ApplicationLoaderHandle } from '@/features/application-loader/services/application-loader'

import { Configurator } from '@/app/Configurator'

import { installEndgeVueWarnHandler } from '@endge/ui-vue'
import { createApp } from 'vue'

import { configuratorSessionBindingKey } from '@/features/configurator-session'
import { getCanonicalLocalhostURL } from '@/features/endge-ide/services/auth/oidc-browser-url'
import { readApplicationLoaderMinimumDuration } from '@/features/application-loader/config/application-loader'
import { startApplicationLoader } from '@/features/application-loader/services/application-loader'
import '@/features/endge-ide/source-editor/adapters/monaco/configure-monaco-workers'
import { i18n } from '@/i18n'
import App from './App.vue'
import router from './router'
import 'reflect-metadata'
import './assets/main.css'
import '@vue-flow/core/dist/style.css'
import '@endge/ui-vue-shadcn/vue-shadcn.css'
import '@endge/ui-vue/vue.css'
/* eslint-enable perfectionist/sort-imports */

const app = createApp(App)
installEndgeVueWarnHandler(app)

// setup должен завершиться до app.use(router), который запускает initial navigation.
Configurator.setup(app, router)

function shouldShowApplicationLoader(): boolean {
  if (getCanonicalLocalhostURL()) {
    return false
  }

  const initialLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const routeName = router.resolve(initialLocation).name
  return routeName === 'configurator' || routeName === 'debugger'
}

async function mountApplicationLoader(): Promise<ApplicationLoaderHandle | undefined> {
  const minimumDuration = readApplicationLoaderMinimumDuration(import.meta.env)
  if (!minimumDuration || !shouldShowApplicationLoader()) {
    return undefined
  }

  return startApplicationLoader({
    minimumDuration,
    statusLabel: i18n.global.t('applicationLoader.loadingWorkspace'),
    versionLabel: i18n.global.t('uiText.text2da600bf'),
  })
}

async function mountApplication(): Promise<void> {
  let applicationLoader: ApplicationLoaderHandle | undefined

  try {
    applicationLoader = await mountApplicationLoader()

    app.use(router)
    app.use(i18n)

    // Initial navigation запускает Configurator и является Endge boot-барьером.
    await router.isReady()
    const isOidcPopupCallback = router.currentRoute.value.name === 'oidc-popup-callback'
    if (!Configurator.isReady
      && !isOidcPopupCallback
      && Configurator.status !== 'authentication-required'
      && Configurator.status !== 'backend-selection-required'
      && Configurator.status !== 'backend-connection-failed') {
      applicationLoader?.unmount()
      return
    }

    await applicationLoader?.minimumDurationElapsed
    applicationLoader?.unmount()

    app.provide(configuratorSessionBindingKey, Configurator.sessionBinding)
    app.mount('#app')
  }
  catch (error: unknown) {
    applicationLoader?.unmount()
    if (getCanonicalLocalhostURL() || Configurator.status === 'redirecting') {
      return
    }
    console.error(`[App] Application bootstrap failed: ${error instanceof Error ? error.message : String(error)}`)
    const root = document.getElementById('app')
    if (root) {
      root.textContent = 'Не удалось запустить приложение'
    }
  }
}

void mountApplication()
