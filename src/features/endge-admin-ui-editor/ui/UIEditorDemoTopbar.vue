<script setup lang="ts">
import {
  BellDot,
  Bug,
  Circle,
  Clock3,
  FolderKanban,
  GitBranch,
  HelpCircle,
  Languages,
  RefreshCcw,
  Tag,
  Waypoints,
} from 'lucide-vue-next'
import { computed } from 'vue'

import { useCurrentEnvironment, useCurrentLocale, useDomainStore } from '@endge/vue'
import { useProjectsStore } from '@/features/endge-ide/store/projects'

const domainStore = useDomainStore()
const projectsStore = useProjectsStore()
const { current: currentLocale } = useCurrentLocale()
const { current: currentEnvironment } = useCurrentEnvironment()

const AVAILABLE_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
]

const activeProjectLabel = computed(() => {
  const project = projectsStore.activeProject
  if (!project) {
    return 'No project'
  }
  return String(project.name ?? project.id ?? 'Untitled project')
})

const activeEnvironmentLabel = computed(() => {
  const currentEnvironmentId = currentEnvironment.value ?? 'dev'
  const activeEnvironment = domainStore.environments.find((item: { identity?: string, id?: string }) =>
    String(item.identity ?? item.id ?? '') === String(currentEnvironmentId),
  )
  if (!activeEnvironment) {
    return 'production'
  }
  return String(activeEnvironment.displayName ?? activeEnvironment.name ?? activeEnvironment.identity ?? activeEnvironment.id ?? 'production')
})

const activeLocaleLabel = computed(() => {
  const localeCode = String(currentLocale.value ?? 'en')
  return AVAILABLE_LOCALES.find(item => item.code === localeCode)?.label ?? localeCode
})

const leftItems = computed(() => [
  {
    id: 'environment',
    label: activeEnvironmentLabel.value,
    icon: Circle,
    iconClass: 'text-sky-500 fill-current',
    iconSizeClass: 'size-2',
  },
  {
    id: 'project',
    label: activeProjectLabel.value,
    icon: FolderKanban,
    iconClass: 'text-slate-500',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'branch',
    label: 'main',
    icon: GitBranch,
    iconClass: 'text-slate-500',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'version',
    label: 'Latest',
    icon: Tag,
    iconClass: 'text-slate-500',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'locale',
    label: activeLocaleLabel.value,
    icon: Languages,
    iconClass: 'text-slate-500',
    iconSizeClass: 'size-3.5',
  },
])

const rightItems = computed(() => [
  {
    id: 'status',
    label: 'No queries running',
    icon: Waypoints,
    iconClass: 'text-slate-400',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: Bug,
    iconClass: 'text-slate-500',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'refresh',
    label: '',
    icon: RefreshCcw,
    iconClass: 'text-slate-400',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'clock',
    label: '',
    icon: Clock3,
    iconClass: 'text-slate-400',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'help',
    label: '',
    icon: HelpCircle,
    iconClass: 'text-slate-400',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'alerts',
    label: '',
    icon: BellDot,
    iconClass: 'text-slate-400',
    iconSizeClass: 'size-3.5',
  },
])
</script>

<template>
  <div class="flex h-8 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white/88 px-3 text-[12px] text-slate-500 backdrop-blur">
    <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <div
        v-for="item in leftItems"
        :key="item.id"
        class="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-slate-100/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span class="truncate">{{ item.label }}</span>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <div
        v-for="item in rightItems"
        :key="item.id"
        class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-slate-100/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span v-if="item.label" class="truncate">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
