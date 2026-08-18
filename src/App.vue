<script setup lang="ts">
import 'vue-sonner/style.css'

import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { Configurator } from '@/app'
import EndgeAdapterRoot from '@/components/endge/EndgeAdapterRoot'
import layouts from '@/components/layouts'
import { Empty } from '@/components/layouts/empty'
import Questions from '@/components/Questions.vue'
import { Toaster } from '@/components/ui/sonner'
import AuthenticationRequiredGate from '@/features/backend-connections/ui/AuthenticationRequiredGate.vue'
import BackendConnectionFailureGate from '@/features/backend-connections/ui/BackendConnectionFailureGate.vue'
import WorkspaceSelectionGate from '@/features/backend-connections/ui/WorkspaceSelectionGate.vue'
import { isIDEPlainMode } from '@/features/endge-ide/model/config/endge-ide-debug-flags'
import EndgeIDEErrorView from '@/features/endge-ide/ui/error/EndgeIDEErrorView.vue'

const workspaceSelectionRequired = Configurator.status === 'workspace-selection-required'
const backendConnectionFailed = Configurator.status === 'backend-connection-failed'
const authenticationRequired = Configurator.status === 'authentication-required'

const route = useRoute()
const isOidcPopupCallback = computed(() => route.name === 'oidc-popup-callback')
const error = ref<Error | null>(null)
const errorInfo = ref<string>('')
const errorComponentName = ref<string>('')
const appLoadingText = 'Идет загрузка приложения...'
const fatalRenderGuard = Configurator.diagnostics.renderGuard

const currentLayout = computed(() => {
  if (fatalRenderGuard.value) {
    return Empty
  }
  if (isIDEPlainMode()) {
    return Empty
  }
  const layout = (route.meta.layout || 'empty') as keyof typeof layouts
  return layouts[layout] ?? Empty
})
const currentLayoutKey = computed(() => String(route.meta.layoutScope ?? route.meta.layout ?? 'empty'))

// Clear error on route change
watch(() => route.fullPath, () => {
  error.value = null
  errorInfo.value = ''
  errorComponentName.value = ''
  Configurator.diagnostics.reset()
})

// Capture errors from child components
onErrorCaptured((err, instance, info) => {
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
  console.error(`[Configurator] Vue error in ${componentName}: ${err instanceof Error ? err.message : String(err)} (${info})`)
  const capturedError = err instanceof Error ? err : new Error(String(err))
  const fatalState = Configurator.diagnostics.capture({
    err: capturedError,
    errorInfo: info,
    componentName,
    routePath: route.path,
    isEndgeIDE: route.meta.layoutScope === 'endge-ide',
  })

  error.value = fatalState?.error ?? capturedError
  errorInfo.value = fatalState?.errorInfo ?? info
  errorComponentName.value = fatalState?.componentName ?? componentName

  // Return false to prevent the error from propagating further
  return false
})
</script>

<template>
  <RouterView v-if="isOidcPopupCallback" />
  <AuthenticationRequiredGate v-else-if="authenticationRequired" />
  <BackendConnectionFailureGate v-else-if="backendConnectionFailed" />
  <WorkspaceSelectionGate v-else-if="workspaceSelectionRequired" />
  <EndgeAdapterRoot v-else root-key="shell" project="configurator" env="dev">
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
    <component :is="currentLayout" :key="currentLayoutKey">
      <EndgeIDEErrorView
        v-if="fatalRenderGuard || error"
        :error="fatalRenderGuard?.error ?? error"
        :error-info="fatalRenderGuard?.errorInfo ?? errorInfo"
        :component-name="fatalRenderGuard?.componentName ?? errorComponentName"
      />
      <RouterView v-else />
    </component>
  </EndgeAdapterRoot>

  <Toaster
    position="top-center"
    rich-colors
    :duration="5000"
  />
  <Questions />
</template>
