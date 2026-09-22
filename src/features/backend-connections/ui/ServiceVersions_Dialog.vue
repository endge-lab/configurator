<script setup lang="ts">
import type {
  BackendConnection,
} from '@/features/backend-connections/domain/types/backend-connection.type'
import type {
  BackendVersionState,
  ConnectedServiceVersion,
} from '@/features/backend-connections/domain/types/backend-version.type'
import type {
  DomainVersionTarget,
  DomainVersionTargetState,
} from '@/features/domain-version/domain/types/domain-version.type'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'
import { useBackendVersions } from '@/features/backend-connections/ui/use-backend-versions'
import DomainVersionBadge from '@/features/domain-version/ui/DomainVersionBadge.vue'
import { useDomainVersions } from '@/features/domain-version/ui/use-domain-versions'

type ServiceVersionRowStatus = 'available' | 'loading' | 'unavailable'

interface ServiceVersionRow {
  key: string
  label: string
  version?: string
  status: ServiceVersionRowStatus
  nested?: boolean
  domainState?: DomainVersionTargetState
}

const { t } = useI18n()
const { activeBackendURL, catalog } = useBackendConnections()
const { state: backendVersionState, refreshMany: refreshBackendVersions } = useBackendVersions()
const { state: domainVersionState, refreshMany: refreshDomainVersions } = useDomainVersions()
const openState = ref(false)
const isRefreshing = ref(false)
const activeEnvironment = ref(activeBackendURL.value)
const configuratorVersion = __APP_VERSION__

const configuratorRow = computed<ServiceVersionRow>(() => ({
  key: 'configurator',
  label: t('help.serviceVersions.configurator'),
  version: configuratorVersion,
  status: 'available',
}))

function backendRows(connection: BackendConnection): ServiceVersionRow[] {
  const currentState = backendVersionState(connection.baseUrl)
  const backend: ServiceVersionRow = {
    key: `backend:${connection.id}`,
    label: connection.name,
    version: currentState.status === 'ready' ? currentState.value.version : undefined,
    status: currentState.status === 'error'
      ? 'unavailable'
      : currentState.status === 'ready' ? 'available' : 'loading',
    domainState: domainVersionState(domainTargetFor(connection)),
  }
  return [backend, ...connectedServiceRows(connection, currentState)]
}

function domainTargetFor(connection: BackendConnection): DomainVersionTarget | null {
  const workspace = Configurator.connections.readWorkspaceFor(connection.baseUrl)
  return workspace ? { backendURL: connection.baseUrl, workspace } : null
}

function connectedServiceRows(
  connection: BackendConnection,
  currentState: BackendVersionState,
): ServiceVersionRow[] {
  const services: ConnectedServiceVersion[] = currentState.status === 'ready'
    ? [...currentState.value.services]
    : []
  if (!services.some(service => service.service === 'service_mock_generator')) {
    services.push({ service: 'service_mock_generator', status: 'unavailable' })
  }

  return services.map(service => ({
    key: `service:${connection.id}:${service.service}`,
    label: connectedServiceLabel(service),
    version: service.version,
    status: currentState.status === 'idle' || currentState.status === 'loading'
      ? 'loading' as const
      : service.status,
    nested: true,
  }))
}

function connectedServiceLabel(service: ConnectedServiceVersion): string {
  if (service.service === 'service_mock_generator') {
    return t('help.serviceVersions.mockGenerator')
  }
  return isAIWorkbench(service.service)
    ? t('help.serviceVersions.aiWorkbench')
    : service.service
}

function isAIWorkbench(service: string): boolean {
  return service === 'service_ai_workbench' || service === 'service-ai-workbench'
}

function statusLabel(status: ServiceVersionRowStatus): string {
  if (status === 'loading') {
    return t('help.serviceVersions.loading')
  }
  return status === 'available'
    ? t('help.serviceVersions.available')
    : t('help.serviceVersions.unavailable')
}

function statusDotClass(status: ServiceVersionRowStatus): string {
  if (status === 'loading') {
    return 'animate-pulse bg-muted-foreground/45'
  }
  return status === 'available' ? 'bg-emerald-500' : 'bg-destructive'
}

function versionLabel(version: string | undefined): string {
  return version ? `v${version}` : '—'
}

async function loadVersions(): Promise<void> {
  if (isRefreshing.value) {
    return
  }
  isRefreshing.value = true
  try {
    const connections = catalog.value?.items ?? []
    const domainTargets = connections
      .map(domainTargetFor)
      .filter(target => target != null)
    await Promise.allSettled([
      refreshBackendVersions(connections.map(connection => connection.baseUrl), true),
      refreshDomainVersions(domainTargets, true),
    ])
  }
  finally {
    isRefreshing.value = false
  }
}

function open(): void {
  const connections = catalog.value?.items ?? []
  activeEnvironment.value = connections.some(connection => connection.baseUrl === activeBackendURL.value)
    ? activeBackendURL.value
    : connections[0]?.baseUrl ?? ''
  openState.value = true
  void loadVersions()
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="overflow-hidden p-0 sm:max-w-lg">
      <DialogHeader class="border-b bg-muted/35 px-5 py-4 text-left">
        <DialogTitle>
          {{ t('help.serviceVersions.title') }}
        </DialogTitle>
      </DialogHeader>

      <TooltipProvider>
        <div class="border-b px-5 py-2">
          <div
            class="flex min-h-10 items-center gap-3 py-2.5"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  role="status"
                  tabindex="0"
                  class="inline-flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  :aria-label="statusLabel(configuratorRow.status)"
                >
                  <span class="size-2 rounded-full" :class="statusDotClass(configuratorRow.status)" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {{ statusLabel(configuratorRow.status) }}
              </TooltipContent>
            </Tooltip>

            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              {{ configuratorRow.label }}
            </span>
            <span class="shrink-0 font-mono text-sm font-semibold tabular-nums">
              {{ versionLabel(configuratorRow.version) }}
            </span>
          </div>
        </div>

        <Tabs v-if="catalog?.items.length" v-model="activeEnvironment" class="gap-0">
          <div class="overflow-x-auto border-b px-5 py-3">
            <TabsList class="w-max justify-start">
              <TabsTrigger
                v-for="connection in catalog.items"
                :key="connection.id"
                :value="connection.baseUrl"
              >
                {{ connection.name }}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            v-for="connection in catalog.items"
            :key="connection.id"
            :value="connection.baseUrl"
            class="m-0 max-h-[55vh] overflow-y-auto px-5 py-2"
          >
            <div
              v-for="row in backendRows(connection)"
              :key="row.key"
              class="flex min-h-10 items-center gap-3 border-b py-2.5 last:border-b-0"
              :class="row.nested ? 'pl-7' : ''"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <span
                    role="status"
                    tabindex="0"
                    class="inline-flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    :aria-label="statusLabel(row.status)"
                  >
                    <span class="size-2 rounded-full" :class="statusDotClass(row.status)" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {{ statusLabel(row.status) }}
                </TooltipContent>
              </Tooltip>

              <span
                class="min-w-0 flex-1 truncate text-sm"
                :class="row.nested ? 'font-normal text-muted-foreground' : 'font-medium'"
              >
                {{ row.label }}
              </span>
              <DomainVersionBadge
                v-if="row.domainState"
                class="shrink-0"
                :state="row.domainState"
              />
              <span class="shrink-0 font-mono text-sm font-semibold tabular-nums">
                {{ versionLabel(row.version) }}
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </TooltipProvider>
    </DialogContent>
  </Dialog>
</template>
