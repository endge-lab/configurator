<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { Configurator } from '@/app/Configurator'
import layouts from '@/components/layouts'

import { Empty } from '@/components/layouts/empty'
import Questions from '@/components/Questions.vue'
import { Toaster } from '@/components/ui/sonner'
import AuthenticationRequiredGate from '@/features/backend-connections/ui/AuthenticationRequiredGate.vue'
import BackendConnectionFailureGate from '@/features/backend-connections/ui/BackendConnectionFailureGate.vue'
import BackendSelectionGate from '@/features/backend-connections/ui/BackendSelectionGate.vue'
import { isIDEPlainMode } from '@/features/endge-ide/config/endge-ide-debug-flags'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'
import { warnDebuggerReadOnly } from '@/features/endge-ide/tools/warn-debugger-read-only'
import EndgeDetachedApp from '@/features/endge-ide/ui/EndgeDetachedApp.vue'
import EndgeIDEErrorView from '@/features/endge-ide/ui/error/EndgeIDEErrorView.vue'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'
import 'vue-sonner/style.css'

const backendSelectionRequired = Configurator.status === 'backend-selection-required'
const backendConnectionFailed = Configurator.status === 'backend-connection-failed'
const authenticationRequired = Configurator.status === 'authentication-required'

const route = useRoute()
const context = useEndgeIDEContext()
const isOidcPopupCallback = computed(() => route.name === 'oidc-popup-callback')
const isContextSwitching = computed(() => context.isSwitching())
const hasActiveWorkspace = computed(() => Configurator.hasActiveWorkspace)
const detachedShell = computed(() => Endge.mode !== 'debugger' && !hasActiveWorkspace.value)
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

// Очистка ошибки при смене маршрута
watch(() => route.fullPath, () => {
  error.value = null
  errorInfo.value = ''
  errorComponentName.value = ''
  Configurator.diagnostics.reset()
})

// Перехват ошибок дочерних компонентов
onErrorCaptured((err, instance, info) => {
  if (warnDebuggerReadOnly(err)) {
    return false
  }
  // Поиск компонента страницы проходом вверх по дереву
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
  <BackendSelectionGate v-else-if="backendSelectionRequired" />
  <div v-else-if="isContextSwitching" class="fixed inset-0 z-[220] flex flex-col items-center justify-center gap-4 bg-slate-50/70 backdrop-blur-sm">
    <div class="size-14 animate-spin rounded-full border-[3px] border-slate-300 border-r-sky-400 border-t-sky-500" />
    <p class="text-sm font-medium text-slate-600">
      {{ appLoadingText }}
    </p>
  </div>
  <component :is="currentLayout" v-else-if="detachedShell" :key="currentLayoutKey">
    <EndgeIDEErrorView
      v-if="fatalRenderGuard || error"
      :error="fatalRenderGuard?.error ?? error"
      :error-info="fatalRenderGuard?.errorInfo ?? errorInfo"
      :component-name="fatalRenderGuard?.componentName ?? errorComponentName"
    />
    <EndgeDetachedApp v-else />
  </component>
  <template v-else-if="Endge.mode === 'debugger'">
    <EndgeIDEErrorView
      v-if="fatalRenderGuard || error"
      :error="fatalRenderGuard?.error ?? error"
      :error-info="fatalRenderGuard?.errorInfo ?? errorInfo"
      :component-name="fatalRenderGuard?.componentName ?? errorComponentName"
    />
    <RouterView v-else />
  </template>
  <EndgeAdapterRoot v-else root-key="shell">
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
