<script setup lang="ts">
import {
  BellDot,
  Bug,
  Check,
  ChevronsUpDown,
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentEnvironment, useCurrentLocale, useDomainStore } from '@endge/vue'
import { useProjectsStore } from '@/features/endge-ide/store/projects'

const domainStore = useDomainStore()
const projectsStore = useProjectsStore()
const { current: currentLocale, setCurrent: setCurrentLocale } = useCurrentLocale()
const { current: currentEnvironment } = useCurrentEnvironment()

const AVAILABLE_LOCALES = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'ru', label: 'Русский', shortLabel: 'RU' },
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
  return AVAILABLE_LOCALES.find(item => item.code === localeCode)?.shortLabel ?? localeCode
})

function switchLocale(locale: string): void {
  setCurrentLocale(locale)
}

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

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-slate-100/90"
          >
            <Languages class="size-3.5 text-slate-500" />
            <span class="font-medium text-slate-600">{{ activeLocaleLabel }}</span>
            <ChevronsUpDown class="size-3 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-36"
          align="start"
          side="top"
          :side-offset="6"
        >
          <DropdownMenuItem
            v-for="locale in AVAILABLE_LOCALES"
            :key="locale.code"
            class="gap-2"
            :class="{ 'bg-accent': (currentLocale ?? 'en') === locale.code }"
            @click="switchLocale(locale.code)"
          >
            <Check
              class="size-3.5"
              :class="(currentLocale ?? 'en') === locale.code ? 'opacity-100' : 'opacity-0'"
            />
            <span>{{ locale.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
