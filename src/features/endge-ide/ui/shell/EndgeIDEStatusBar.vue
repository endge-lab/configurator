<script setup lang="ts">
import { BellDot, GitBranch, RefreshCcw, Tag } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { useEndgeIDEContext } from '@/features/endge-ide/model/context/use-endge-ide-context'
import EnvironmentSwitcher from '@/features/endge-ide/ui/context/EnvironmentSwitcher.vue'
import LocaleSwitcher from '@/features/endge-ide/ui/context/LocaleSwitcher.vue'
import ProjectSwitcher from '@/features/endge-ide/ui/context/ProjectSwitcher.vue'
import TenantSwitcher from '@/features/endge-ide/ui/context/TenantSwitcher.vue'
import ThemeSwitcher from '@/features/endge-ide/ui/context/ThemeSwitcher.vue'

const context = useEndgeIDEContext()
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
