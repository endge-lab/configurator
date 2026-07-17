<script setup lang="ts">
import {
  BellDot,
  Bug,
  Clock3,
  GitBranch,
  HelpCircle,
  RefreshCcw,
  Tag,
  Waypoints,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { useConfiguratorContext } from '@/features/endge-configurator/model/use-configurator-context'
import EnvironmentSwitcher from '@/features/endge-ide/ui/section/header/EnvironmentSwitcher.vue'
import LocaleSwitcher from '@/features/endge-ide/ui/section/header/LocaleSwitcher.vue'
import ProjectSwitcher from '@/features/endge-ide/ui/section/header/ProjectSwitcher.vue'
import TenantSwitcher from '@/features/endge-ide/ui/section/header/TenantSwitcher.vue'
import ThemeSwitcher from '@/features/endge-ide/ui/section/header/ThemeSwitcher.vue'

const context = useConfiguratorContext()

const leftItems = [
  {
    id: 'branch',
    label: 'main',
    icon: GitBranch,
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'version',
    label: 'latest',
    icon: Tag,
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
]

const rightPrimaryItems = [
  {
    id: 'status',
    label: 'No queries running',
    icon: Waypoints,
    iconClass: 'text-muted-foreground/80',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: Bug,
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
]

const rightUtilityItems = [
  {
    id: 'clock',
    label: '',
    icon: Clock3,
    iconClass: 'text-muted-foreground/80',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'help',
    label: '',
    icon: HelpCircle,
    iconClass: 'text-muted-foreground/80',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'alerts',
    label: '',
    icon: BellDot,
    iconClass: 'text-muted-foreground/80',
    iconSizeClass: 'size-3.5',
  },
]

async function reloadDomain(): Promise<void> {
  try {
    await context.reloadCurrentContext()
    toast.success('Домен полностью перезагружен', {
      description: 'Данные заново загружены с сервера и скомпилированы.',
    })
  }
  catch (error: any) {
    toast.error('Не удалось перезагрузить домен', {
      description: String(error?.message ?? error),
    })
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

      <div
        v-for="item in leftItems"
        :key="item.id"
        class="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span class="truncate">{{ item.label }}</span>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <div
        v-for="item in rightPrimaryItems"
        :key="item.id"
        class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span v-if="item.label" class="truncate">{{ item.label }}</span>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-md px-1.5 py-0.5 transition hover:bg-muted/90 disabled:cursor-wait disabled:opacity-50"
        :disabled="context.isSwitching()"
        title="Полностью перезагрузить домен с сервера и перекомпилировать"
        aria-label="Полностью перезагрузить домен"
        @click="reloadDomain"
      >
        <RefreshCcw class="size-3.5 text-muted-foreground/80" :class="{ 'animate-spin': context.isSwitching() }" />
      </button>
      <div
        v-for="item in rightUtilityItems"
        :key="item.id"
        class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span v-if="item.label" class="truncate">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.footer-context-switchers :deep([data-slot="button"]) {
  font-size: inherit;
  line-height: inherit;
}
</style>
