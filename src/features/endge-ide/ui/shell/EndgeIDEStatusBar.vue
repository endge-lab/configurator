<script setup lang="ts">
import { BellDot, DatabaseZap, GitBranch, RefreshCcw, Tag } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useEndgeIDEContext } from '@/features/endge-ide/model/context/use-endge-ide-context'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import EnvironmentSwitcher from '@/features/endge-ide/ui/context/EnvironmentSwitcher.vue'
import LocaleSwitcher from '@/features/endge-ide/ui/context/LocaleSwitcher.vue'
import ProjectSwitcher from '@/features/endge-ide/ui/context/ProjectSwitcher.vue'
import TenantSwitcher from '@/features/endge-ide/ui/context/TenantSwitcher.vue'
import ThemeSwitcher from '@/features/endge-ide/ui/context/ThemeSwitcher.vue'

const context = useEndgeIDEContext()
const isMockEnabled = computed(() => context.isMockEnabled())
const isDataModeOverridden = computed(() => context.isDataModeOverridden())
const isChangingDataMode = ref(false)
const mockLabel = 'mock'
const mockModeTitle = computed(() => {
  const source = isDataModeOverridden.value ? 'Configurator override' : 'Workspace default'
  return isMockEnabled.value
    ? `Mock data enabled (${source}). External queries are not executed.`
    : `Live data enabled (${source}). Queries may call real services.`
})
const leftItems = [
  { id: 'branch', label: 'main', icon: GitBranch },
  { id: 'version', label: 'latest', icon: Tag },
]
async function reloadDomain(): Promise<void> {
  try {
    await context.reloadCurrentContext()
    toast.success('Домен полностью перезагружен', { description: 'Данные заново загружены с сервера и скомпилированы.' })
  }
  catch (error: any) {
    toast.error('Не удалось перезагрузить домен', { description: String(error?.message ?? error) })
  }
}

async function toggleMockMode(): Promise<void> {
  if (isChangingDataMode.value || context.isSwitching()) {
    return
  }

  isChangingDataMode.value = true
  if (isDataModeOverridden.value) {
    context.clearDataModeOverride()
  }
  else {
    context.setMockEnabled(!isMockEnabled.value)
  }
  const enabled = context.isMockEnabled()
  try {
    await EndgeIDE.runtimePreview.restartForDataModeChange()
    toast.success(enabled ? 'Mock-данные включены' : 'Live-данные включены', {
      description: isDataModeOverridden.value
        ? 'Используется локальное переопределение конфигуратора.'
        : 'Восстановлен режим данных из Workspace.',
    })
  }
  catch (error) {
    toast.error('Режим данных изменён, но preview не удалось перезапустить', {
      description: String(error instanceof Error ? error.message : error),
    })
  }
  finally {
    isChangingDataMode.value = false
  }
}
</script>

<template>
  <div class="flex h-8 shrink-0 items-center justify-between border-t border-border/80 bg-background/88 px-3 text-[12px] text-muted-foreground backdrop-blur">
    <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <div class="footer-context-switchers flex shrink-0 items-center gap-1.5">
        <TenantSwitcher />
        <ProjectSwitcher />
        <EnvironmentSwitcher />
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
      <div v-for="item in leftItems" :key="item.id" class="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5">
        <component :is="item.icon" class="size-3.5 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90 disabled:cursor-wait disabled:opacity-50"
        :class="isMockEnabled && 'bg-primary/15 text-primary'"
        :disabled="context.isSwitching() || isChangingDataMode"
        :aria-pressed="isMockEnabled"
        :title="mockModeTitle"
        @click="toggleMockMode"
      >
        <DatabaseZap class="size-3.5 shrink-0" />
        <span>{{ mockLabel }}</span>
      </button>
      <button type="button" class="inline-flex items-center rounded-md px-1.5 py-0.5 transition hover:bg-muted/90 disabled:cursor-wait disabled:opacity-50" :disabled="context.isSwitching()" title="Полностью перезагрузить домен" @click="reloadDomain">
        <RefreshCcw class="size-3.5" :class="{ 'animate-spin': context.isSwitching() }" />
      </button>
      <BellDot class="size-3.5 mx-1" />
    </div>
  </div>
</template>

<style scoped>
.footer-context-switchers :deep([data-slot="dropdown-menu-trigger"]) {
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
}
</style>
