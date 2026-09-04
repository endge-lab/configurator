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
import { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'
import { useBackendVersions } from '@/features/backend-connections/ui/use-backend-versions'
import DomainVersionBadge from '@/features/domain-version/ui/DomainVersionBadge.vue'
import { useDomainVersions } from '@/features/domain-version/ui/use-domain-versions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

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
const { catalog } = useBackendConnections()
const { state: backendVersionState, refreshMany: refreshBackendVersions } = useBackendVersions()
const { state: domainVersionState, refreshMany: refreshDomainVersions } = useDomainVersions()
const openState = ref(false)
const isRefreshing = ref(false)
const configuratorVersion = __APP_VERSION__

const rows = computed<ServiceVersionRow[]>(() => [
  {
    key: 'configurator',
    label: t('help.serviceVersions.configurator'),
    version: configuratorVersion,
    status: 'available',
  },
  ...(catalog.value?.items ?? []).flatMap(backendRows),
])

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
  if (currentState.status !== 'ready') {
    return []
  }

  return currentState.value.services.map(service => ({
    key: `service:${connection.id}:${service.service}`,
    label: connectedServiceLabel(service),
    version: service.version,
    status: service.status,
    nested: true,
  }))
}

function connectedServiceLabel(service: ConnectedServiceVersion): string {
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
        <div class="max-h-[55vh] divide-y overflow-y-auto px-5 py-2">
          <div
            v-for="row in rows"
            :key="row.key"
            class="flex min-h-10 items-center gap-3 py-2.5"
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
        </div>
      </TooltipProvider>
    </DialogContent>
  </Dialog>
</template>
