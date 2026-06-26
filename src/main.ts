import '@endge/vue/vue.css'
import './assets/main.css'
import 'reflect-metadata'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { captureAppRenderFailure } from '@/features/@app/model/app/app-render-guard.ts'
import { i18n } from '@/i18n'
import { branding } from '@/lib/branding.ts'
import { installEndgeChromeBridge } from '@/features/endge-admin/tools/chrome-bridge'

// В dev приложение само отдаёт домен в Vite-плагин для кодогенерации в src/gen
if (import.meta.env.DEV) {
  import('virtual:endge-codegen-push')
}

import App from './App.vue'
import router from './router'

const app = createApp(App)

function isIgnorableBrowserError(raw: unknown): boolean {
  const message = String(raw ?? '').trim().toLowerCase()
  return message === 'resizeobserver loop completed with undelivered notifications.'
    || message === 'resizeobserver loop limit exceeded'
}

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
app.use(i18n)
app.use(branding)

installEndgeChromeBridge()

app.mount('#app')
