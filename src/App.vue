<script setup lang="ts">
import 'vue-sonner/style.css'

import { EndgeShell } from '@endge/vue'
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import layouts from '@/components/layouts'
import { Empty } from '@/components/layouts/empty'
import Questions from '@/components/Questions.vue'
import { Toaster } from '@/components/ui/sonner'
import { appRenderGuardState, captureAppRenderFailure, resetAppRenderGuard } from '@/features/@app/model/app/app-render-guard.ts'
import ErrorView from '@/features/@app/ui/pages/common/Error.vue'
import { isAdminPlainMode } from '@/features/endge-admin/model/core/endge-admin-debug-flags.ts'

const route = useRoute()
const error = ref<Error | null>(null)
const errorInfo = ref<string>('')
const errorComponentName = ref<string>('')
const appLoadingText = 'Идет загрузка приложения...'
const fatalRenderGuard = appRenderGuardState

const currentLayout = computed(() => {
  if (fatalRenderGuard.value) { return Empty }
  if (isAdminPlainMode()) { return Empty }
  const layout = (route.meta.layout || 'empty') as keyof typeof layouts
  return layouts[layout] ?? Empty
})

// Clear error on route change
watch(() => route.fullPath, () => {
  error.value = null
  errorInfo.value = ''
  errorComponentName.value = ''
  resetAppRenderGuard()
})

// Capture errors from child components
onErrorCaptured((err, instance, info) => {
  console.error('Error captured:', err)
  console.error('Component:', instance)
  console.error('Error info:', info)

  // Try to find the page component by traversing up the tree
  let current = instance
  let componentName = 'Unknown'

  while (current) {
    const name = current.$options?.name || current.$options?.__name
    if (name && !name.startsWith('_') && !['RouterView'].includes(name)) {
      componentName = name
      break
    }
    current = current.$parent
  }

  errorComponentName.value = componentName
  const capturedError = err instanceof Error ? err : new Error(String(err))
  const fatalState = captureAppRenderFailure({
    err: capturedError,
    errorInfo: info,
    componentName,
    routePath: route.path,
  })

  error.value = fatalState?.error ?? capturedError
  errorInfo.value = fatalState?.errorInfo ?? info
  errorComponentName.value = fatalState?.componentName ?? componentName

  // Return false to prevent the error from propagating further
  return false
})
</script>

<template>
  <EndgeShell project="configurator" env="dev">
    <!-- ГЛОБАЛЬНЫЙ СПИННЕР ПРИЛОЖЕНИЯ -->
    <template #spinner>
      <div class="fixed inset-0 z-[220] flex flex-col items-center justify-center gap-4 bg-slate-50/70 backdrop-blur-sm">
        <div class="size-14 animate-spin rounded-full border-[3px] border-slate-300 border-r-sky-400 border-t-sky-500" />
        <p class="text-sm font-medium text-slate-600">
          {{ appLoadingText }}
        </p>
      </div>
    </template>

    <!-- ЛОГИКА LAYOUT -->
    <component :is="currentLayout">
      <ErrorView
        v-if="fatalRenderGuard || error"
        :error="fatalRenderGuard?.error ?? error"
        :error-info="fatalRenderGuard?.errorInfo ?? errorInfo"
        :component-name="fatalRenderGuard?.componentName ?? errorComponentName"
      />
      <RouterView v-else />
    </component>
  </EndgeShell>

  <Toaster
    position="top-right"
    rich-colors
    :duration="5000"
  />
  <Questions />
</template>
