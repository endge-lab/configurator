/* eslint-disable perfectionist/sort-imports -- Configurator registers Endge plugins before UI modules are evaluated */
import { Configurator } from '@/app/Configurator'

import { installEndgeVueWarnHandler } from '@endge/ui-vue'
import { createApp } from 'vue'

import { configuratorSessionBindingKey } from '@/features/configurator-session'
import { getCanonicalLocalhostURL } from '@/features/endge-ide/services/auth/oidc-browser-url'
import '@/features/endge-ide/source-editor/adapters/monaco/configure-monaco-workers'
import { i18n } from '@/i18n'
import App from './App.vue'
import router from './router'
import 'reflect-metadata'
import './assets/main.css'
import '@endge/ui-vue-shadcn/vue-shadcn.css'
import '@endge/ui-vue/vue.css'
/* eslint-enable perfectionist/sort-imports */

// В dev приложение само отдаёт домен в Vite-плагин для кодогенерации в src/gen
if (import.meta.env.DEV) {
  import('virtual:endge-codegen-push')
}

const app = createApp(App)
installEndgeVueWarnHandler(app)

// setup должен завершиться до app.use(router), который запускает initial navigation.
Configurator.setup(app, router)

app.use(router)
app.use(i18n)

async function mountApplication(): Promise<void> {
  try {
    // Initial navigation запускает Configurator и является Endge boot-барьером.
    await router.isReady()
    const isOidcPopupCallback = router.currentRoute.value.name === 'oidc-popup-callback'
    if (!Configurator.isReady
      && !isOidcPopupCallback
      && Configurator.status !== 'authentication-required'
      && Configurator.status !== 'workspace-selection-required'
      && Configurator.status !== 'backend-connection-failed') {
      return
    }

    app.provide(configuratorSessionBindingKey, Configurator.sessionBinding)
    app.mount('#app')
  }
  catch (error: unknown) {
    if (getCanonicalLocalhostURL()) {
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
