<script setup lang="ts">
import type {
  BackendVersionState,
  ConnectedServiceVersion,
} from '@/features/backend-connections/domain/types/backend-version.type'

import { Bot, Boxes, Loader2, MonitorCog, Server } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'
import { useBackendVersions } from '@/features/backend-connections/ui/use-backend-versions'

type ServiceVersionRowStatus = 'available' | 'loading' | 'unavailable'

interface ServiceVersionRow {
  key: string
  kind: 'backend' | 'configurator' | 'service'
  label: string
  service?: string
  version?: string
  env?: string
  details?: string
  status: ServiceVersionRowStatus
}

const { t } = useI18n()
const { activeBackendURL } = useBackendConnections()
const { state, refresh } = useBackendVersions()
const openState = ref(false)
const isRefreshing = ref(false)
const configuratorVersion = __APP_VERSION__

const backendState = computed(() => state(activeBackendURL.value))
const rows = computed<ServiceVersionRow[]>(() => [
  {
    key: 'configurator',
    kind: 'configurator',
    label: t('help.serviceVersions.configurator'),
    version: configuratorVersion,
    details: t('help.serviceVersions.localApplication'),
    status: 'available',
  },
  backendRow(backendState.value),
  ...connectedServiceRows(backendState.value),
])

function backendRow(currentState: BackendVersionState): ServiceVersionRow {
  if (currentState.status === 'ready') {
    return {
      key: 'backend',
      kind: 'backend',
      label: t('help.serviceVersions.backend'),
      service: currentState.value.service,
      version: currentState.value.version,
      env: currentState.value.env,
      details: activeBackendURL.value,
      status: 'available',
    }
  }

  return {
    key: 'backend',
    kind: 'backend',
    label: t('help.serviceVersions.backend'),
    details: currentState.status === 'error'
      ? backendErrorLabel(currentState.code)
      : activeBackendURL.value,
    status: currentState.status === 'error' ? 'unavailable' : 'loading',
  }
}

function connectedServiceRows(currentState: BackendVersionState): ServiceVersionRow[] {
  if (currentState.status !== 'ready') {
    return []
  }

  return currentState.value.services.map(service => ({
    key: `service:${service.service}`,
    kind: 'service',
    label: connectedServiceLabel(service),
    service: service.service,
    version: service.version,
    env: service.env,
    details: service.service,
    status: service.status,
  }))
}

function connectedServiceLabel(service: ConnectedServiceVersion): string {
  return isAIWorkbench(service.service)
    ? t('help.serviceVersions.aiWorkbench')
    : service.service
}

function isAIWorkbench(service: string | undefined): boolean {
  return service === 'service_ai_workbench' || service === 'service-ai-workbench'
}

function backendErrorLabel(code: string): string {
  return code === 'unsupported'
    ? t('help.serviceVersions.unsupported')
    : t('help.serviceVersions.backendUnavailable')
}

function statusLabel(status: ServiceVersionRowStatus): string {
  if (status === 'loading') {
    return t('help.serviceVersions.loading')
  }
  return status === 'available'
    ? t('help.serviceVersions.available')
    : t('help.serviceVersions.unavailable')
}

function versionLabel(version: string): string {
  return `v${version}`
}

function environmentLabel(environment: string): string {
  return `· ${environment}`
}

async function loadVersions(): Promise<void> {
  if (isRefreshing.value) {
    return
  }
  isRefreshing.value = true
  try {
    await refresh(activeBackendURL.value, true)
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
    <DialogContent class="overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader class="border-b bg-muted/35 px-6 py-5 text-left">
        <DialogTitle class="flex items-center gap-2">
          <Boxes class="size-4 text-sky-500" />
          {{ t('help.serviceVersions.title') }}
          <Loader2 v-if="isRefreshing" class="ml-auto size-4 animate-spin text-muted-foreground" />
        </DialogTitle>
        <DialogDescription>
          {{ t('help.serviceVersions.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[55vh] space-y-2 overflow-y-auto px-6 py-5">
        <div
          v-for="row in rows"
          :key="row.key"
          class="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3"
        >
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <MonitorCog v-if="row.kind === 'configurator'" class="size-4" />
            <Server v-else-if="row.kind === 'backend'" class="size-4" />
            <Bot v-else-if="isAIWorkbench(row.service)" class="size-4" />
            <Boxes v-else class="size-4" />
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ row.label }}
            </p>
            <p v-if="row.details" class="mt-1 truncate font-mono text-[11px] text-muted-foreground" :title="row.details">
              {{ row.details }}
            </p>
          </div>

          <div class="shrink-0 text-right">
            <p v-if="row.version" class="font-mono text-sm font-semibold tabular-nums">
              {{ versionLabel(row.version) }}
            </p>
            <p v-else-if="row.status === 'available'" class="text-xs text-muted-foreground">
              {{ t('help.serviceVersions.versionUnknown') }}
            </p>
            <div class="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 v-if="row.status === 'loading'" class="size-3 animate-spin" />
              <span
                v-else
                class="size-1.5 rounded-full"
                :class="row.status === 'available' ? 'bg-emerald-500' : 'bg-destructive'"
              />
              <span>{{ statusLabel(row.status) }}</span>
              <span v-if="row.env">{{ environmentLabel(row.env) }}</span>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
