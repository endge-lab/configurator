<script setup lang="ts">
import type { DomainSectionType } from '@endge/core'

import { ComponentType, DomainSectionType as DomainSection, Endge } from '@endge/core'
import { computed } from 'vue'
import { Archive, ExternalLink, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { ref } from 'vue'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import {
  launchPulseRuntimeFromEntity,
  pulseRequiresBasePath,
  pulseStatusDotClass,
  pulseMockHosts,
  pulseStatusLabel,
  type PulseMockResource,
  clearPulseSelection,
  selectPulseHost,
} from '@/features/endge-ide/model/pulse/pulse.mock.ts'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import type { PulseMockHost } from '@/features/endge-ide/model/pulse/pulse.mock.ts'

const props = withDefaults(defineProps<{
  openInTabOnSelect?: boolean
}>(), {
  openInTabOnSelect: false,
})

interface PulseHostTreeItem {
  host: PulseMockHost
  depth: number
}

const hosts = computed(() => pulseMockHosts.value)
const visibilityMode = ref<'active' | 'deleted'>('active')
const visibleHosts = computed(() =>
  hosts.value.filter(host =>
    visibilityMode.value === 'deleted'
      ? host.status === 'deleted'
      : host.status !== 'deleted',
  ),
)
const hostTreeItems = computed<PulseHostTreeItem[]>(() => {
  const byParent = new Map<string | null, PulseMockHost[]>()
  const roots: PulseMockHost[] = []
  const allHosts = visibleHosts.value
  const existingIds = new Set(allHosts.map(host => host.id))

  for (const host of allHosts) {
    const parentId = host.parentId && existingIds.has(host.parentId) ? host.parentId : null
    if (!parentId) {
      roots.push(host)
      continue
    }

    byParent.set(parentId, [...(byParent.get(parentId) ?? []), host])
  }

  const ordered: PulseHostTreeItem[] = []
  const visited = new Set<string>()

  const visit = (host: PulseMockHost, depth: number) => {
    if (visited.has(host.id))
      return
    visited.add(host.id)
    ordered.push({ host, depth })

    for (const child of byParent.get(host.id) ?? [])
      visit(child, depth + 1)
  }

  for (const root of roots)
    visit(root, 0)

  for (const host of allHosts) {
    if (!visited.has(host.id))
      visit(host, 0)
  }

  return ordered
})
const visibilityButtonTooltip = computed(() =>
  visibilityMode.value === 'deleted'
    ? 'Показать активные runtime-сущности'
    : 'Показать архив удалённых runtime-сущностей',
)
const headerTitle = computed(() =>
  visibilityMode.value === 'deleted' ? 'Удалённые Runtime-сущности' : 'Runtime-сущности',
)
const launchDialogOpen = ref(false)
const launchBasePath = ref('')
const pendingEntity = ref<{ id: string | number; sectionType: DomainSectionType } | null>(null)

const droppableSections = [
  DomainSection.Project,
  DomainSection.View,
  DomainSection.Page,
  DomainSection.Query,
  DomainSection.Store,
  DomainSection.Action,
  DomainSection.Component,
] as DomainSectionType[]

function openHost(hostId: string): void {
  selectPulseHost(hostId, 'details')
  if (props.openInTabOnSelect)
    EndgeIDE.tabs.openPulseTab()
}

function toggleVisibilityMode(): void {
  visibilityMode.value = visibilityMode.value === 'deleted' ? 'active' : 'deleted'
}

function rootIcon(hostType: string): string {
  if (hostType === 'query')
    return 'ti ti-database-search text-blue-500 text-sm'
  if (hostType === 'table')
    return 'ti ti-table text-green-500 text-sm'
  if (hostType === 'component')
    return 'ti ti-box text-violet-500 text-sm'

  const icon = EndgeIDE.tabs.getDocumentIcon(hostType as any)
  return icon
    .replace('text-2xl', 'text-sm')
    .replace('text-xl', 'text-sm')
}

function groupIcon(group: 'resources' | 'subscriptions' | 'bindings' | 'contracts'): string {
  if (group === 'resources')
    return 'ti ti-hierarchy-2'
  if (group === 'subscriptions')
    return 'ti ti-route-2'
  if (group === 'bindings')
    return 'ti ti-link'
  return 'ti ti-file-description'
}

function groupTitle(group: 'resources' | 'subscriptions' | 'bindings' | 'contracts'): string {
  if (group === 'resources')
    return 'RAPH-ноды и runtime-ресурсы'
  if (group === 'subscriptions')
    return 'Каналы runtime'
  if (group === 'bindings')
    return 'Event bindings'
  return 'Event contracts'
}

function groupHint(group: 'resources' | 'subscriptions' | 'bindings' | 'contracts'): string {
  if (group === 'resources')
    return 'Внутренние сущности host: raph-node, scope, meta и другие runtime-ресурсы.'
  if (group === 'subscriptions')
    return 'Каналы взаимодействия host: event-bus, raph, external и направление потока.'
  if (group === 'bindings')
    return 'Декларативные реакции, связанные с host.'
  return 'Контракты событий, доступные для host.'
}

function runtimeResources(host: { resources: PulseMockResource[] }): PulseMockResource[] {
  return host.resources.filter(resource =>
    resource.kind !== 'behavior-binding'
    && resource.kind !== 'contract'
    && resource.kind !== 'event-subscription',
  )
}

function resourceIcon(resource: PulseMockResource): string {
  if (resource.kind === 'raph-node')
    return 'ti ti-vector'
  if (resource.kind === 'event-subscription')
    return 'ti ti-antenna-bars-5'
  if (resource.kind === 'behavior-binding')
    return 'ti ti-link'
  if (resource.kind === 'contract')
    return 'ti ti-file-description'
  return 'ti ti-braces'
}

function openDomainEntity(hostId: string): void {
  const host = hosts.value.find(item => item.id === hostId)
  if (!host) {
    toast.warning('Не удалось открыть сущность', {
      description: `Runtime host "${hostId}" не найден.`,
    })
    return
  }

  const identity = String(host.entityIdentity ?? '').trim()
  if (!identity) {
    toast.warning('Не удалось открыть сущность', {
      description: 'У runtime host отсутствует entityIdentity.',
    })
    return
  }

  const entityType = String(host.entityType ?? '').trim()
  if (!entityType) {
    toast.warning('Не удалось открыть сущность', {
      description: 'У runtime host отсутствует entityType.',
    })
    return
  }

  if (entityType === 'project' || entityType === 'view' || entityType === 'page' || entityType === 'action') {
    EndgeIDE.tabs.openDocument(identity, entityType as any)
    return
  }

  if (entityType === 'table') {
    EndgeIDE.tabs.openDocument(identity, ComponentType.Table as any)
    return
  }

  if (entityType === 'query') {
    const query = Endge.domain.getQuery(identity)
    const queryType = String(query?.type ?? '').trim()
    if (!queryType) {
      toast.warning('Не удалось открыть query', {
        description: `Не удалось определить тип запроса для "${identity}".`,
      })
      return
    }
    EndgeIDE.tabs.openDocument(identity, queryType as any)
    return
  }

  if (entityType === 'store') {
    EndgeIDE.tabs.openDocument(identity, DomainSection.Store as any)
    return
  }

  if (entityType === 'component') {
    const component = Endge.domain.getComponent(identity)
    const componentType = String(component?.type ?? '').trim()
    if (!componentType || componentType === ComponentType.Component) {
      toast.warning('Не удалось открыть component', {
        description: `Для типа "${componentType || 'component'}" нет отдельного редактора.`,
      })
      return
    }
    EndgeIDE.tabs.openDocument(identity, componentType as any)
    return
  }

  toast.warning('Не удалось открыть сущность', {
    description: `Тип "${entityType}" пока не поддержан.`,
  })
}

function destroyRuntimeHost(hostId: string): void {
  const host = hosts.value.find(item => item.id === hostId)
  if (!host) {
    toast.warning('Не удалось удалить runtime', {
      description: `Runtime host "${hostId}" не найден.`,
    })
    return
  }

  if (host.status === 'deleted') {
    Endge.runtime.removeDeletedRuntimeHostSnapshot(hostId)
    clearPulseSelection()
    toast.success('Runtime удалён окончательно', {
      description: `Snapshot "${host.title}" удалён из архива.`,
    })
    return
  }

  Endge.runtime.destroyRuntimeTree(hostId)
  toast.success('Runtime удалён', {
    description: `Удалён runtime host "${host.title}" и его дочерние сущности.`,
  })
}

function clearDeletedRuntimeHosts(): void {
  Endge.runtime.clearDeletedRuntimeHostSnapshots()
  clearPulseSelection()
  toast.success('Архив очищен', {
    description: 'Список удалённых runtime-сущностей очищен.',
  })
}

function handleEntityDrop(payload: { id: string | number; sectionType: DomainSectionType }): void {
  if (pulseRequiresBasePath(payload.sectionType)) {
    pendingEntity.value = payload
    launchBasePath.value = ''
    launchDialogOpen.value = true
    return
  }

  const res = launchPulseRuntimeFromEntity(payload)
  if (!res.ok) {
    toast.error('Не удалось запустить runtime', { description: res.message })
    return
  }
  toast.success('Runtime запущен', { description: res.message })
}

function confirmLaunchWithBasePath(): void {
  const payload = pendingEntity.value
  if (!payload)
    return

  const res = launchPulseRuntimeFromEntity(payload, {
    basePath: launchBasePath.value,
  })
  if (!res.ok) {
    toast.error('Не удалось запустить runtime', { description: res.message })
    return
  }

  launchDialogOpen.value = false
  pendingEntity.value = null
  launchBasePath.value = ''
  toast.success('Runtime запущен', { description: res.message })
}

function cancelLaunchDialog(): void {
  launchDialogOpen.value = false
  pendingEntity.value = null
  launchBasePath.value = ''
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-b px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">{{ headerTitle }}</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                :variant="visibilityMode === 'deleted' ? 'destructive' : 'outline'"
                size="icon"
                class="size-7"
                :class="visibilityMode === 'deleted'
                  ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                  : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'"
                @click="toggleVisibilityMode"
              >
                <Archive class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ visibilityButtonTooltip }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <TooltipProvider>
        <div class="space-y-2 p-2">
          <details
            v-for="item in hostTreeItems"
            :key="item.host.id"
            class="overflow-hidden rounded-lg border bg-card"
            :style="{ marginLeft: `${item.depth * 16}px` }"
          >
            <summary class="cursor-pointer list-none px-2 py-1.5 hover:bg-muted/20">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <i :class="rootIcon(item.host.entityType)" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {{ item.host.entityType }} runtime-host
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="truncate text-sm font-medium text-left hover:underline"
                          @click.stop="openHost(item.host.id)"
                        >
                          {{ item.host.title }}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{{ item.host.description }}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div class="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {{ item.host.runtimeType }} • {{ item.host.id }}
                  </div>
                </div>

                <div
                  class="flex items-center gap-1"
                >
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span
                        class="size-2.5 rounded-full shrink-0"
                        :class="pulseStatusDotClass(item.host.status)"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ pulseStatusLabel(item.host.status) }}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-6"
                        @click.stop="openDomainEntity(item.host.id)"
                      >
                        <ExternalLink class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Открыть связанную доменную сущность
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-6 text-red-600 hover:text-red-700"
                        @click.stop="destroyRuntimeHost(item.host.id)"
                      >
                        <Trash2 class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Удалить runtime host и дочерние сущности
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </summary>

            <div class="border-t bg-muted/10 px-2 py-2">
              <div class="space-y-1">
                <details class="rounded-md border bg-background/80">
                  <summary class="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/20">
                    <i :class="groupIcon('resources')" class="text-xs text-muted-foreground" />
                    <span class="font-medium">{{ groupTitle('resources') }}</span>
                    <span class="ml-auto text-muted-foreground">{{ runtimeResources(item.host).length }}</span>
                  </summary>
                  <div class="px-2 pt-1 text-[10px] text-muted-foreground">
                    {{ groupHint('resources') }}
                  </div>
                  <div class="space-y-1 border-t px-2 py-1.5">
                    <div
                      v-for="resource in runtimeResources(item.host)"
                      :key="resource.id"
                      class="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/20"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <i :class="resourceIcon(resource)" class="text-xs" />
                        </TooltipTrigger>
                        <TooltipContent>{{ resource.subtitle }}</TooltipContent>
                      </Tooltip>
                      <span class="truncate">{{ resource.title }}</span>
                    </div>
                  </div>
                </details>

                <details class="rounded-md border bg-background/80">
                  <summary class="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/20">
                    <i :class="groupIcon('subscriptions')" class="text-xs text-muted-foreground" />
                    <span class="font-medium">{{ groupTitle('subscriptions') }}</span>
                    <span class="ml-auto text-muted-foreground">{{ item.host.subscriptions.length }}</span>
                  </summary>
                  <div class="px-2 pt-1 text-[10px] text-muted-foreground">
                    {{ groupHint('subscriptions') }}
                  </div>
                  <div class="space-y-1 border-t px-2 py-1.5">
                    <div
                      v-for="subscription in item.host.subscriptions"
                      :key="subscription.id"
                      class="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/20"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <i :class="resourceIcon(subscription)" class="text-xs" />
                        </TooltipTrigger>
                        <TooltipContent>{{ subscription.subtitle }}</TooltipContent>
                      </Tooltip>
                      <span class="truncate">{{ subscription.title }}</span>
                    </div>
                  </div>
                </details>

                <details class="rounded-md border bg-background/80">
                  <summary class="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/20">
                    <i :class="groupIcon('bindings')" class="text-xs text-muted-foreground" />
                    <span class="font-medium">{{ groupTitle('bindings') }}</span>
                    <span class="ml-auto text-muted-foreground">{{ item.host.bindings.length }}</span>
                  </summary>
                  <div class="px-2 pt-1 text-[10px] text-muted-foreground">
                    {{ groupHint('bindings') }}
                  </div>
                  <div class="space-y-1 border-t px-2 py-1.5">
                    <div
                      v-for="binding in item.host.bindings"
                      :key="binding.id"
                      class="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/20"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <i :class="resourceIcon(binding)" class="text-xs" />
                        </TooltipTrigger>
                        <TooltipContent>{{ binding.subtitle }}</TooltipContent>
                      </Tooltip>
                      <span class="truncate">{{ binding.title }}</span>
                    </div>
                  </div>
                </details>

                <details class="rounded-md border bg-background/80">
                  <summary class="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/20">
                    <i :class="groupIcon('contracts')" class="text-xs text-muted-foreground" />
                    <span class="font-medium">{{ groupTitle('contracts') }}</span>
                    <span class="ml-auto text-muted-foreground">{{ item.host.contracts.length }}</span>
                  </summary>
                  <div class="px-2 pt-1 text-[10px] text-muted-foreground">
                    {{ groupHint('contracts') }}
                  </div>
                  <div class="space-y-1 border-t px-2 py-1.5">
                    <div
                      v-for="contract in item.host.contracts"
                      :key="contract.id"
                      class="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/20"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <i :class="resourceIcon(contract)" class="text-xs" />
                        </TooltipTrigger>
                        <TooltipContent>{{ contract.subtitle }}</TooltipContent>
                      </Tooltip>
                      <span class="truncate">{{ contract.title }}</span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </details>
        </div>
      </TooltipProvider>
    </ScrollArea>

    <div class="border-t p-2 shrink-0">
      <Button
        v-if="visibilityMode === 'deleted'"
        class="w-full"
        @click="clearDeletedRuntimeHosts"
      >
        Удалить все
      </Button>

      <DomainEntityDropTarget
        v-else
        :accept-section-types="droppableSections"
        hint-text="Перетащите сущность, чтобы запустить runtime"
        @entity-drop="handleEntityDrop"
      >
        <div class="rounded border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
          Drop zone: Project / View / Page / Query / Action / Component
        </div>
      </DomainEntityDropTarget>
    </div>
  </div>

  <Dialog v-model:open="launchDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Параметры запуска runtime</DialogTitle>
      </DialogHeader>
      <div class="space-y-2 py-2">
        <div class="text-sm text-muted-foreground">
          Для component/table runtime требуется `basePath`.
        </div>
        <Input
          v-model="launchBasePath"
          placeholder="Например: queries.schedule"
          @keydown.enter="confirmLaunchWithBasePath"
        />
      </div>
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="cancelLaunchDialog">
          Отменить
        </Button>
        <Button @click="confirmLaunchWithBasePath">
          Запустить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
