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
  SunMoon,
  Tag,
  Waypoints,
} from 'lucide-vue-next'
import { Endge } from '@endge/core'
import { computed, onScopeDispose, ref } from 'vue'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentEnvironment, useCurrentLocale, useCurrentTheme, useDomainStore } from '@endge/vue'
import { useProjectsStore } from '@/features/endge-ide/store/projects'

const domainStore = useDomainStore()
const projectsStore = useProjectsStore()
const { current: currentLocale, setCurrent: setCurrentLocale } = useCurrentLocale()
const { current: currentTheme, setCurrent: setCurrentTheme } = useCurrentTheme()
const { current: currentEnvironment } = useCurrentEnvironment()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableLocales = computed(() => {
  workspaceVersion.value
  return Endge.workspace.locales
})

const availableThemes = computed(() => {
  workspaceVersion.value
  return Endge.workspace.themes
})

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
  workspaceVersion.value
  const localeCode = Endge.workspace.normalizeLocale(currentLocale.value)
  return getLocaleDisplayLabel(localeCode)
})

function getLocaleDisplayLabel(localeCode: string): string {
  const locale = Endge.workspace.locales.find(item => item.code === localeCode)
  return String(locale?.displayName || locale?.shortLabel || localeCode)
}

function switchLocale(locale: string): void {
  setCurrentLocale(locale)
}

const activeThemeLabel = computed(() => {
  workspaceVersion.value
  const theme = Endge.workspace.normalizeTheme(currentTheme.value)
  return Endge.workspace.getThemeLabel(theme)
})

function switchTheme(theme: string): void {
  setCurrentTheme(theme)
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
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'branch',
    label: 'main',
    icon: GitBranch,
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
  {
    id: 'version',
    label: 'Latest',
    icon: Tag,
    iconClass: 'text-muted-foreground',
    iconSizeClass: 'size-3.5',
  },
])

const rightItems = computed(() => [
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
  {
    id: 'refresh',
    label: '',
    icon: RefreshCcw,
    iconClass: 'text-muted-foreground/80',
    iconSizeClass: 'size-3.5',
  },
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
])
</script>

<template>
  <div class="flex h-8 shrink-0 items-center justify-between border-t border-border/80 bg-background/88 px-3 text-[12px] text-muted-foreground backdrop-blur">
    <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <div
        v-for="item in leftItems"
        :key="item.id"
        class="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span class="truncate">{{ item.label }}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
          >
            <Languages class="size-3.5 text-muted-foreground" />
            <span class="font-medium text-foreground/80">{{ activeLocaleLabel }}</span>
            <ChevronsUpDown class="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-36"
          align="start"
          side="top"
          :side-offset="6"
        >
          <DropdownMenuItem
            v-for="locale in availableLocales"
            :key="locale.code"
            class="gap-2"
            :class="{ 'bg-accent': Endge.workspace.normalizeLocale(currentLocale) === locale.code }"
            @click="switchLocale(locale.code)"
          >
            <Check
              class="size-3.5"
              :class="Endge.workspace.normalizeLocale(currentLocale) === locale.code ? 'opacity-100' : 'opacity-0'"
            />
            <span>{{ getLocaleDisplayLabel(locale.code) }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
          >
            <SunMoon class="size-3.5 text-muted-foreground" />
            <span class="font-medium text-foreground/80">{{ activeThemeLabel }}</span>
            <ChevronsUpDown class="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-36"
          align="start"
          side="top"
          :side-offset="6"
        >
          <DropdownMenuItem
            v-for="theme in availableThemes"
            :key="theme.identity"
            class="gap-2"
            :class="{ 'bg-accent': Endge.workspace.normalizeTheme(currentTheme) === theme.identity }"
            @click="switchTheme(theme.identity)"
          >
            <Check
              class="size-3.5"
              :class="Endge.workspace.normalizeTheme(currentTheme) === theme.identity ? 'opacity-100' : 'opacity-0'"
            />
            <span>{{ theme.displayName || theme.identity }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <div
        v-for="item in rightItems"
        :key="item.id"
        class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
      >
        <component :is="item.icon" class="shrink-0" :class="[item.iconSizeClass, item.iconClass]" />
        <span v-if="item.label" class="truncate">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
