<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { BackendConnection } from '@/features/backend-connections'

import { ChevronsUpDown, Server } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBackendConnections, useBackendVersions } from '@/features/backend-connections'
import DomainVersionBadge from '@/features/domain-version/ui/DomainVersionBadge.vue'
import { useDomainVersions } from '@/features/domain-version/ui/use-domain-versions'

defineProps<{
  contentClass?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()

const { catalog, activeBackendURL, isPrimaryActive } = useBackendConnections()
const { state: backendVersionState, refresh: refreshBackendVersion, refreshMany: refreshBackendVersions } = useBackendVersions()
const { state: domainVersionState, refreshMany } = useDomainVersions()
const open = ref(false)
const activeConnectionName = computed(() =>
  catalog.value?.items.find(connection => connection.baseUrl === activeBackendURL.value)?.name
  ?? (isPrimaryActive.value ? 'Основной' : activeBackendURL.value),
)
const activeConnectionLabel = computed(() => formatConnectionName(activeConnectionName.value, activeBackendURL.value))

function formatConnectionName(name: string, backendURL: string): string {
  const state = backendVersionState(backendURL)
  return state.status === 'ready' ? `${name} (${state.value.version})` : name
}

function switchBackend(baseURL: string): void {
  Configurator.connections.switchBackend(baseURL)
}

function targetFor(connection: BackendConnection) {
  const workspace = Configurator.connections.readWorkspaceFor(connection.baseUrl)
  return workspace ? { backendURL: connection.baseUrl, workspace } : null
}

function workspaceFor(connection: BackendConnection): string {
  return targetFor(connection)?.workspace ?? 'workspace не выбран'
}

function statusFor(connection: BackendConnection) {
  return domainVersionState(targetFor(connection))
}

async function refreshStatuses(force = false): Promise<void> {
  const targets = (catalog.value?.items ?? [])
    .map(targetFor)
    .filter(target => target != null)
  await refreshMany(targets, force)
}

watch(activeBackendURL, (backendURL) => {
  void refreshBackendVersion(backendURL)
}, { immediate: true })

watch([open, catalog], ([isOpen, currentCatalog]) => {
  if (isOpen && currentCatalog) {
    void refreshBackendVersions(currentCatalog.items.map(connection => connection.baseUrl), true)
    void refreshStatuses(true)
  }
})
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="sm" class="gap-2 px-2 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground">
          <span class="max-w-64 truncate text-xs font-medium" :title="activeBackendURL">
            {{ activeConnectionLabel }}
          </span>
          <ChevronsUpDown class="size-4 text-muted-foreground" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="contentClass ?? 'w-[34rem] max-w-[calc(100vw-1rem)] rounded-lg'"
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
          class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-2"
          :class="activeBackendURL === connection.baseUrl ? 'bg-accent text-accent-foreground' : ''"
          @click="switchBackend(connection.baseUrl)"
        >
          <div class="flex min-w-0 items-start gap-3">
            <Server class="mt-0.5 size-4 shrink-0" :class="connection.primary ? 'text-primary' : 'text-orange-500'" />
            <div class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium">{{ formatConnectionName(connection.name, connection.baseUrl) }}</span>
              <span class="block truncate font-mono text-[10px] text-muted-foreground">{{ connection.baseUrl }}</span>
              <span class="block truncate text-[10px] text-muted-foreground">{{ workspaceFor(connection) }}</span>
            </div>
          </div>
          <DomainVersionBadge class="self-center" :state="statusFor(connection)" />
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
