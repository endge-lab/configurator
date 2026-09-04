<script setup lang="ts">
import type { App } from '@/components/layouts/main/index.ts'

import { ChevronsUpDown, Settings2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const { isMobile } = useSidebar()
const { t } = useI18n()

const apps = ref<App[]>([
  {
    name: 'App switcher coming soon',
    href: '#',
  },
])
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg">
              <Settings2 class="size-6" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">
                {{ t('app.title') }}
              </span>
              <span class="truncate text-xs">{{ t('app.description') }}</span>
            </div>
            <ChevronsUpDown class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="4"
        >
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            {{ t('nav.apps.title') }}
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(app, index) in apps"
            :key="index"
            class="gap-2 p-2"
          >
            <div class="flex size-6 items-center justify-center rounded-sm border">
              <Settings2 class="size-3.5 shrink-0" />
            </div>
            {{ app.name }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
