<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Check, ChevronsUpDown, Server } from 'lucide-vue-next'

import { Configurator } from '@/app'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBackendConnections } from '@/features/backend-connections'

defineProps<{
  contentClass?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()

const { catalog, activeBackendURL } = useBackendConnections()

function switchBackend(baseURL: string): void {
  Configurator.connections.switchBackend(baseURL)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="sm" class="gap-2 px-2 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground">
          <span class="max-w-64 truncate font-mono text-xs font-medium" :title="activeBackendURL">
            {{ activeBackendURL }}
          </span>
          <ChevronsUpDown class="size-4 text-muted-foreground" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="contentClass ?? 'w-64 rounded-lg'"
      :align="align ?? 'start'"
      :side="side"
      :side-offset="sideOffset ?? 4"
    >
      <DropdownMenuLabel class="text-xs text-muted-foreground">
        Подключения
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem
          v-for="connection in catalog?.items ?? []"
          :key="connection.id"
          class="cursor-pointer gap-3"
          :class="activeBackendURL === connection.baseUrl ? 'bg-accent text-accent-foreground' : ''"
          @click="switchBackend(connection.baseUrl)"
        >
          <Server class="size-4 shrink-0" :class="connection.primary ? 'text-primary' : 'text-orange-500'" />
          <div class="min-w-0 flex-1">
            <span class="block truncate font-mono text-xs">{{ connection.baseUrl }}</span>
            <span class="block text-[10px] text-muted-foreground">{{ connection.primary ? 'Основной' : 'Удалённый backend' }}</span>
          </div>
          <Check v-if="activeBackendURL === connection.baseUrl" class="size-4 shrink-0 text-emerald-500" />
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
