import type { DomainSectionType } from '@endge/core'
import type { RuntimeHostSnapshot } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, ref } from 'vue'

import {
  configuratorPreviewAppScope,
  configuratorPreviewMeta,
} from '@/features/endge-ide/model/preview-runtime/preview-runtime.ts'

export type PulseStatus = 'active' | 'idle' | 'deleted' | 'error'

export interface PulseMockResource {
  id: string
  kind: 'raph-node' | 'event-subscription' | 'behavior-binding' | 'contract' | 'scope' | 'meta'
  title: string
  subtitle: string
  payload?: Record<string, unknown>
}

export interface PulseMockHost {
  id: string
  basePath: string
  appScopeId: string
  appScopeRootPath: string
  parentId: string | null
  title: string
  entityIdentity: string
  entityType: string
  runtimeType: string
  status: PulseStatus
  uptime: string
  description: string
  tags: string[]
  meta: Record<string, unknown>
  context: Record<string, unknown>
  resources: PulseMockResource[]
  subscriptions: PulseMockResource[]
  bindings: PulseMockResource[]
  contracts: PulseMockResource[]
}

interface PulseTelemetryPoint {
  hosts: number
  raphNodes: number
  bindings: number
  subscriptions: number
}

const pulseHostSnapshots = ref<RuntimeHostSnapshot[]>([])
const pulseTelemetry = ref<PulseTelemetryPoint[]>([])
let pulseSyncTimer: ReturnType<typeof setInterval> | null = null
let pulseSyncConsumers = 0
const pulseNow = ref<number>(Date.now())

export const pulseSelectedHostId = ref<string>('')
export const pulseActiveTab = ref<'overview' | 'details' | 'diagnostics'>('overview')

export function setPulseActiveTab(tab: 'overview' | 'details' | 'diagnostics'): void {
  pulseActiveTab.value = tab
}

export const pulseMockHosts = computed<PulseMockHost[]>(() => {
  return pulseHostSnapshots.value.map(host => toPulseHost(host, pulseNow.value))
})

export const pulseSelectedHost = computed<PulseMockHost | null>(() => {
  return pulseMockHosts.value.find(host => host.id === pulseSelectedHostId.value) ?? null
})

export const pulseSummary = computed(() => {
  const hosts = pulseMockHosts.value.length
  const active = pulseMockHosts.value.filter(host => host.status === 'active').length
  const raphNodes = pulseMockHosts.value.reduce((acc, host) => {
    return acc + host.resources.filter(resource => resource.kind === 'raph-node').length
  }, 0)
  const bindings = pulseMockHosts.value.reduce((acc, host) => acc + host.bindings.length, 0)
  const subscriptions = pulseMockHosts.value.reduce((acc, host) => acc + host.subscriptions.length, 0)
  const contracts = pulseMockHosts.value.reduce((acc, host) => acc + host.contracts.length, 0)

  return {
    hosts,
    active,
    raphNodes,
    bindings,
    subscriptions,
    contracts,
  }
})

export const pulseBindingChannel = computed(() => {
  const total = Math.max(
    pulseSummary.value.bindings + pulseSummary.value.subscriptions + pulseSummary.value.contracts,
    1,
  )
  const resolve = Math.round((pulseSummary.value.contracts / total) * 100)
  const run = Math.round((pulseSummary.value.bindings / total) * 100)
  const error = Math.max(0, 100 - resolve - run)

  return [
    { name: 'resolve', value: resolve },
    { name: 'run', value: run },
    { name: 'error', value: error },
  ]
})

export const pulsePhaseLoad = computed(() => {
  const hosts = pulseMockHosts.value
  const total = Math.max(hosts.length, 1)
  const groups = [
    { phase: 'table', count: hosts.filter(host => host.runtimeType.includes('table')).length },
    { phase: 'query', count: hosts.filter(host => host.runtimeType.includes('query')).length },
    { phase: 'action', count: hosts.filter(host => host.runtimeType.includes('action')).length },
    { phase: 'other', count: hosts.filter(host => !host.runtimeType.includes('table') && !host.runtimeType.includes('query') && !host.runtimeType.includes('action')).length },
  ]

  return groups.map(group => ({
    phase: group.phase,
    load: Math.round((group.count / total) * 100),
  }))
})

export const pulseTimeline = computed(() => {
  const points = pulseTelemetry.value
  return {
    labels: points.map((_, index) => `-${(points.length - index - 1) * 5}s`),
    raphNps: points.map(point => point.raphNodes),
    bindingsRps: points.map(point => point.bindings),
    busEps: points.map(point => point.subscriptions),
  }
})

export function selectPulseHost(hostId: string, tab: 'overview' | 'details' = 'details'): void {
  const normalized = String(hostId ?? '').trim()
  if (!normalized)
    return
  pulseSelectedHostId.value = normalized
  pulseActiveTab.value = tab
}

export function showPulseOverview(): void {
  pulseActiveTab.value = 'overview'
}

export function clearPulseSelection(): void {
  pulseSelectedHostId.value = ''
}

export function startPulseRuntimeSync(): void {
  pulseSyncConsumers += 1
  refreshPulseRuntimeData()
  if (pulseSyncTimer)
    return

  pulseSyncTimer = setInterval(() => {
    refreshPulseRuntimeData()
  }, 5000)
}

export function stopPulseRuntimeSync(): void {
  pulseSyncConsumers = Math.max(0, pulseSyncConsumers - 1)
  if (pulseSyncConsumers > 0)
    return
  if (!pulseSyncTimer)
    return

  clearInterval(pulseSyncTimer)
  pulseSyncTimer = null
}

export function pulseRequiresBasePath(sectionType: DomainSectionType): boolean {
  return sectionType === 'component'
}

export function launchPulseRuntimeFromEntity(
  payload: { id: string | number; sectionType: DomainSectionType },
  options: { basePath?: string } = {},
): {
  ok: boolean
  message: string
  hostId?: string
  requiresBasePath?: boolean
} {
  const id = payload.id
  const sectionType = payload.sectionType
  const basePath = String(options.basePath ?? '').trim()

  if (sectionType === 'component' && !basePath) {
    return {
      ok: false,
      requiresBasePath: true,
      message: 'Для запуска component/table runtime требуется basePath.',
    }
  }

  let model: unknown = null
  let executeMeta: Record<string, unknown> = configuratorPreviewMeta()

  if (sectionType === 'project')
    model = Endge.domain.getProject(id)
  else if (sectionType === 'view')
    model = Endge.domain.getView(id)
  else if (sectionType === 'page')
    model = Endge.domain.getPage(id)
  else if (sectionType === 'query')
    model = Endge.domain.getQuery(id)
  else if (sectionType === 'store')
    model = Endge.domain.getStore(id)
  else if (sectionType === 'action')
    model = Endge.domain.getAction(id)
  else if (sectionType === 'component') {
    model = Endge.domain.getComponent(id)
    executeMeta = { ...executeMeta, basePath }
  }
  else {
    return {
      ok: false,
      message: `Секция "${sectionType}" пока не поддерживает runtime-запуск из Pulse.`,
    }
  }

  if (!model) {
    return {
      ok: false,
      message: `Сущность "${String(id)}" не найдена в домене.`,
    }
  }

  const host = configuratorPreviewAppScope.execute(model as any, { meta: executeMeta })
  if (!host) {
    return {
      ok: false,
      message: 'Runtime host не был создан. Проверьте входные параметры.',
    }
  }

  startPulseRuntimeSync()
  selectPulseHost(host.id, 'details')

  return {
    ok: true,
    hostId: host.id,
    message: `Runtime host "${host.id}" запущен.`,
  }
}

export function pulseStatusLabel(status: PulseStatus): string {
  if (status === 'active')
    return 'Активен'
  if (status === 'idle')
    return 'Ожидает'
  if (status === 'deleted')
    return 'Удалён'
  return 'Ошибка'
}

export function pulseStatusDotClass(status: PulseStatus): string {
  if (status === 'active')
    return 'bg-emerald-500'
  if (status === 'idle')
    return 'bg-amber-400'
  return 'bg-red-500'
}

function refreshPulseRuntimeData(): void {
  pulseNow.value = Date.now()
  const snapshot = Endge.runtime.snapshot()
  const deletedHosts = Array.isArray((snapshot as { deletedHosts?: RuntimeHostSnapshot[] }).deletedHosts)
    ? (snapshot as { deletedHosts?: RuntimeHostSnapshot[] }).deletedHosts ?? []
    : []
  pulseHostSnapshots.value = [
    ...snapshot.hosts,
    ...deletedHosts,
  ]

  const point: PulseTelemetryPoint = {
    hosts: pulseHostSnapshots.value.length,
    raphNodes: pulseHostSnapshots.value.reduce((acc, host) => acc + host.resources.filter(item => item.kind === 'raph-node').length, 0),
    bindings: pulseHostSnapshots.value.reduce((acc, host) => acc + host.resources.filter(item => item.kind === 'behavior-binding').length, 0),
    subscriptions: pulseHostSnapshots.value.reduce((acc, host) => acc + host.channels.filter(item => item.kind === 'event-bus' || item.kind === 'external').length, 0),
  }

  const next = [...pulseTelemetry.value, point]
  pulseTelemetry.value = next.slice(-12)
}

function toPulseHost(host: RuntimeHostSnapshot, now: number): PulseMockHost {
  const resources: PulseMockResource[] = host.resources.map(resource => ({
    id: resource.id,
    kind: mapResourceKind(resource.kind),
    title: resource.title,
    subtitle: resource.subtitle ?? String(resource.kind),
    payload: resource.payload,
  }))
  const subscriptions: PulseMockResource[] = host.channels.map(channel => ({
    id: channel.id,
    kind: 'event-subscription',
    title: channel.name,
    subtitle: `${channel.kind} / ${channel.direction}${channel.subtitle ? ` / ${channel.subtitle}` : ''}`,
  }))
  const bindings = resources.filter(resource => resource.kind === 'behavior-binding')
  const contracts = resources.filter(resource => resource.kind === 'contract')

  const title = host.title || host.entityIdentity || host.id
  const description = typeof host.meta.description === 'string'
    ? host.meta.description
    : `Runtime host для ${host.entityType} (${host.entityIdentity})`

  return {
    id: host.id,
    basePath: host.basePath,
    appScopeId: String(host.meta.appScopeId ?? 'app'),
    appScopeRootPath: String(host.meta.appScopeRootPath ?? 'runtime'),
    parentId: host.parentId,
    title,
    entityIdentity: host.entityIdentity,
    entityType: host.entityType,
    runtimeType: host.runtimeType,
    status: mapPulseStatus(host.status),
    uptime: formatUptime(host.createdAt, now),
    description,
    tags: [
      ...(host.meta.mode === 'preview' ? ['preview'] : []),
      `scope:${String(host.meta.appScopeId ?? 'app')}`,
      host.entityType,
      host.runtimeType,
      `resources:${resources.length}`,
      `channels:${host.channels.length}`,
    ],
    meta: host.meta,
    context: host.context,
    resources,
    subscriptions,
    bindings,
    contracts,
  }
}

function mapPulseStatus(status: string): PulseStatus {
  if (status === 'active')
    return 'active'
  if (status === 'error')
    return 'error'
  if (status === 'destroyed')
    return 'deleted'
  return 'idle'
}

function mapResourceKind(kind: string): PulseMockResource['kind'] {
  if (kind === 'raph-node')
    return 'raph-node'
  if (kind === 'behavior-binding')
    return 'behavior-binding'
  if (kind === 'contract')
    return 'contract'
  if (kind === 'scope')
    return 'scope'
  return 'meta'
}

function formatUptime(createdAt: number, now: number): string {
  const deltaMs = Math.max(0, now - createdAt)
  const totalSec = Math.floor(deltaMs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0)
    return `${h}h ${m}m ${s}s`
  if (m > 0)
    return `${m}m ${s}s`
  return `${s}s`
}
