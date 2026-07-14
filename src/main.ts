/* eslint-disable perfectionist/sort-imports -- renderer plugins must be registered before imports that read Endge modules */
import '@/features/endge-configurator/model/endge-renderer-plugins.ts'
import '@endge/vue/vue.css'
import '@endge/shadcn-vue/shadcn-vue.css'
import './assets/main.css'
import 'reflect-metadata'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { captureAppRenderFailure } from '@/features/endge-configurator/model/app-render-guard.ts'
import { EndgeConfigurator } from '@/features/endge-configurator/model/endge-configurator.ts'
import { installEndgeChromeBridge } from '@/features/endge-ide/tools/chrome-bridge'
/* eslint-enable perfectionist/sort-imports */

// В dev приложение само отдаёт домен в Vite-плагин для кодогенерации в src/gen
if (import.meta.env.DEV) {
  import('virtual:endge-codegen-push')
}

function isIgnorableBrowserError(raw: unknown): boolean {
  const message = String(raw ?? '').trim().toLowerCase()
  return message === 'resizeobserver loop completed with undelivered notifications.'
    || message === 'resizeobserver loop limit exceeded'
}

async function bootstrap(): Promise<void> {
  await EndgeConfigurator.init()

  const [appModule, routerModule, i18nModule, brandingModule] = await Promise.all([
    import('./App.vue'),
    import('./router'),
    import('@/i18n'),
    import('@/lib/branding.ts'),
  ])
  const router = routerModule.default
  const app = createApp(appModule.default)

  app.config.errorHandler = (err, instance, info) => {
    let componentName = 'Unknown'

    let current = instance
    while (current) {
      const name = current.$options?.name || current.$options?.__name
      if (name && !name.startsWith('_') && !['RouterView'].includes(name)) {
        componentName = name
        break
      }
      current = current.$parent
    }

    captureAppRenderFailure({
      err,
      errorInfo: String(info ?? ''),
      componentName,
      routePath: router.currentRoute.value.path,
    })

    console.error('[Vue errorHandler]', err, info, instance)
  }

  window.addEventListener('error', (event) => {
    if (isIgnorableBrowserError(event.message) || isIgnorableBrowserError(event.error?.message)) {
      event.preventDefault()
      return
    }

    captureAppRenderFailure({
      err: event.error ?? new Error(event.message),
      errorInfo: 'window.error',
      componentName: 'Window',
      routePath: router.currentRoute.value.path,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMessage = event.reason instanceof Error ? event.reason.message : event.reason
    if (isIgnorableBrowserError(reasonMessage)) {
      event.preventDefault()
      return
    }

    captureAppRenderFailure({
      err: event.reason,
      errorInfo: 'window.unhandledrejection',
      componentName: 'Promise',
      routePath: router.currentRoute.value.path,
    })
  })

  app.use(createPinia())
  app.use(router)
  app.use(i18nModule.i18n)
  app.use(brandingModule.branding)

  installEndgeChromeBridge()
  app.mount('#app')
}

void bootstrap().catch((error) => {
  console.error('[Bootstrap] Failed to load Endge from Payload', error)
})
