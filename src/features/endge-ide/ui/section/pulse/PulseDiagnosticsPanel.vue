<script setup lang="ts">
/**
 * Панель «Логи / Трейсы»: три проекции (трейсы с раскрытием, таблица, таймлайн), фильтры и сортировка.
 */
import { Activity, BarChart3, ChevronDown, ChevronRight, List, Play, Square, Table } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import type { DiagnosticsSeverityNumber } from '@endge/core'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  diagnosticsRegisterEntries,
  clearRegister,
  type DiagnosticsRegisterEntry,
} from '@/features/endge-ide/model/pulse/diagnostics-register.ts'

const MAX_RECORDS = 800

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
const ALL_LEVELS: Level[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
const ALL_KINDS = ['log', 'span']
const ALL_CHANNELS = ['runtime', 'domain', 'query', 'events']

interface DisplayRecord {
  id: number
  ts: number
  level: Level
  kind: string
  channel: string
  name: string
  traceId: string
  spanId?: string
  parentSpanId?: string
  durMs?: number
  message?: string
  value?: number
  unit?: string
  tabId?: string
}

/** Преобразует OTel severity number в компактный уровень presentation layer. */
function severityLevel(severityNumber: DiagnosticsSeverityNumber): Level {
  const levels: Record<DiagnosticsSeverityNumber, Level> = {
    1: 'trace',
    5: 'debug',
    9: 'info',
    13: 'warn',
    17: 'error',
    21: 'fatal',
  }
  return levels[severityNumber]
}

/** Проецирует core record из подключённой вкладки в локальную UI-модель. */
function entryToDisplayRecord(entry: DiagnosticsRegisterEntry): DisplayRecord {
  const r = entry.record
  if (r.signal === 'log') {
    return {
      id: r.id,
      ts: r.timestamp,
      level: severityLevel(r.severityNumber),
      kind: 'log',
      channel: r.scope.name,
      name: r.eventName ?? r.body,
      traceId: r.traceId ?? '',
      spanId: r.spanId,
      message: r.body,
      tabId: entry.tabId,
    }
  }
  return {
    id: r.id,
    ts: r.startTimestamp,
    level: r.status.code === 'error' ? 'error' : 'info',
    kind: 'span',
    channel: r.scope.name,
    name: r.name,
    traceId: r.traceId,
    spanId: r.spanId,
    parentSpanId: r.parentSpanId,
    durMs: r.durationMs,
    message: r.status.message,
    tabId: entry.tabId,
  }
}

/** Источник записей: из регистры канала или mock. */
const sourceRecords = computed<DisplayRecord[]>(() => {
  const entries = diagnosticsRegisterEntries.value
  if (entries.length > 0)
    return entries.map(entryToDisplayRecord)
  return mockRecords.value
})

const isFromRegister = computed(() => diagnosticsRegisterEntries.value.length > 0)

const nextId = ref(14)
const mockRecords = ref<DisplayRecord[]>([
  { id: 1, ts: 1000, level: 'info', kind: 'span', channel: 'runtime', name: 'domain.compile', traceId: 'tr-1', spanId: 'sp-1', durMs: 150 },
  { id: 2, ts: 1020, level: 'debug', kind: 'log', channel: 'domain', name: 'binding.resolved', message: 'Query flights bound', traceId: 'tr-1', spanId: 'sp-1' },
  { id: 3, ts: 1050, level: 'info', kind: 'span', channel: 'query', name: 'build-request', traceId: 'tr-1', spanId: 'sp-2', parentSpanId: 'sp-1', durMs: 70 },
  { id: 4, ts: 1200, level: 'info', kind: 'span', channel: 'runtime', name: 'query.run', traceId: 'tr-2', spanId: 'sp-3', durMs: 160 },
  { id: 5, ts: 1210, level: 'info', kind: 'span', channel: 'query', name: 'execute', traceId: 'tr-2', spanId: 'sp-4', parentSpanId: 'sp-3', durMs: 140 },
  { id: 6, ts: 1400, level: 'warn', kind: 'log', channel: 'events', name: 'slow-render', message: 'Render > 100ms', traceId: 'tr-3' },
])

const mockCounters = computed(() => {
  const records = sourceRecords.value
  const byKind: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  for (const r of records) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    if (r.channel) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
  }
  return {
    totalRecords: records.length,
    droppedByPolicy: 0,
    droppedByCapacity: 0,
    activeExporters: 0,
    openTraces: 0,
    openSpans: 0,
    recordsByKind: byKind,
    recordsByChannel: byChannel,
  }
})

const mockPolicy = { enabled: true, levelThreshold: 'info' as const, sampleRate: 1, maxRecords: 10_000, exportersEnabled: false }

const streamActive = ref(false)
let streamTimer: ReturnType<typeof setInterval> | null = null

const TRACE_NAMES = ['domain.compile', 'query.run', 'runtime.execute', 'flow.step']
const CHANNELS = ['runtime', 'domain', 'query', 'events']
const SPAN_NAMES = ['build-request', 'execute', 'hydrate', 'render', 'parse']
const EVENT_NAMES = ['binding.resolved', 'request.sent', 'response.received', 'cache.hit', 'slow-render']
const EVENT_MESSAGES = ['OK', 'Completed', 'Render > 50ms', 'Cache miss', 'Retry']
const LEVELS: DisplayRecord['level'][] = ['trace', 'debug', 'info', 'warn', 'error']

/** Возвращает случайный элемент непустого mock-массива. */
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]! }
function rndId(): string { return Math.random().toString(36).slice(2, 10) }

function appendRecord(record: DisplayRecord): void {
  const list = mockRecords.value
  const next = list.length >= MAX_RECORDS ? list.slice(-MAX_RECORDS + 1) : [...list]
  record.id = nextId.value++
  record.ts = Date.now()
  next.push(record)
  mockRecords.value = next
}

function emitRandomEvent(): void {
  const traceId = `tr-${rndId()}`
  const channel = pick(CHANNELS)
  const level = pick(LEVELS)
  const traceName = pick(TRACE_NAMES)
  const rootSpanId = `sp-${rndId()}`
  const numSpans = Math.floor(Math.random() * 3) + 1
  let parentSpanId: string | undefined = rootSpanId
  for (let i = 0; i < numSpans; i++) {
    const spanId = `sp-${rndId()}`
    const spanName = pick(SPAN_NAMES)
    if (Math.random() > 0.5) appendRecord({ id: 0, ts: 0, level: 'debug', kind: 'log', channel, name: pick(EVENT_NAMES), message: pick(EVENT_MESSAGES), traceId, spanId })
    appendRecord({ id: 0, ts: 0, level, kind: 'span', channel, name: spanName, traceId, spanId, parentSpanId, durMs: Math.round(20 + Math.random() * 150) })
    parentSpanId = spanId
  }
  appendRecord({ id: 0, ts: 0, level, kind: 'span', channel, name: traceName, traceId, spanId: rootSpanId, durMs: Math.round(50 + Math.random() * 200) })
}

function startStream(): void {
  if (streamActive.value) return
  streamActive.value = true
  streamTimer = setInterval(() => emitRandomEvent(), 400 + Math.random() * 600)
}

function stopStream(): void {
  streamActive.value = false
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null }
}

onBeforeUnmount(() => stopStream())

/** Фильтры: пустой массив = показывать все */
const filterLevels = ref<Level[]>([])
const filterKinds = ref<string[]>([])
const filterChannels = ref<string[]>([])
const searchText = ref('')
const sortBy = ref<'ts' | 'level' | 'kind' | 'channel' | 'name' | 'durMs'>('ts')
const sortDir = ref<'asc' | 'desc'>('desc')
const expandedTraceIds = ref<Set<string>>(new Set())

function toggleTraceExpanded(traceId: string): void {
  const next = new Set(expandedTraceIds.value)
  if (next.has(traceId)) next.delete(traceId)
  else next.add(traceId)
  expandedTraceIds.value = next
}

function toggleLevel(lev: Level, checked: boolean): void {
  if (checked) {
    const arr = filterLevels.value
    filterLevels.value = arr.includes(lev) ? arr : arr.length === 0 ? [lev] : [...arr, lev]
  } else {
    const next = filterLevels.value.length === 0 ? ALL_LEVELS.filter(l => l !== lev) : filterLevels.value.filter(x => x !== lev)
    filterLevels.value = next.length === ALL_LEVELS.length ? [] : next
  }
}

function toggleChannel(ch: string, checked: boolean): void {
  if (checked) {
    const arr = filterChannels.value
    filterChannels.value = arr.includes(ch) ? arr : arr.length === 0 ? [ch] : [...arr, ch]
  } else {
    const next = filterChannels.value.length === 0 ? ALL_CHANNELS.filter(c => c !== ch) : filterChannels.value.filter(x => x !== ch)
    filterChannels.value = next.length === ALL_CHANNELS.length ? [] : next
  }
}

function toggleKind(k: string, checked: boolean): void {
  if (checked) {
    const arr = filterKinds.value
    filterKinds.value = arr.includes(k) ? arr : [...arr, k]
  } else {
    const next = filterKinds.value.length === 0 ? ALL_KINDS.filter(x => x !== k) : filterKinds.value.filter(x => x !== k)
    filterKinds.value = next.length === ALL_KINDS.length ? [] : next
  }
}

function matchRecord(r: DisplayRecord): boolean {
  if (filterLevels.value.length > 0 && !filterLevels.value.includes(r.level)) return false
  if (filterKinds.value.length > 0 && !filterKinds.value.includes(r.kind)) return false
  if (filterChannels.value.length > 0 && !filterChannels.value.includes(r.channel)) return false
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    const name = (r.name ?? '').toLowerCase()
    const msg = (r.message ?? '').toLowerCase()
    const ch = (r.channel ?? '').toLowerCase()
    if (!name.includes(q) && !msg.includes(q) && !ch.includes(q)) return false
  }
  return true
}

const filteredRecords = computed(() => sourceRecords.value.filter(matchRecord))

const sortedRecords = computed(() => {
  const list = [...filteredRecords.value]
  const field = sortBy.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let va: number | string = a[field] ?? ''
    let vb: number | string = b[field] ?? ''
    if (field === 'ts' || field === 'durMs') {
      va = Number(va) || 0
      vb = Number(vb) || 0
      return dir * (va - vb)
    }
    return dir * String(va).localeCompare(String(vb))
  })
  return list
})

const mockTraces = computed(() => {
  const byTrace = new Map<string, { traceId: string; name: string; startTs: number; endTs: number; durMs: number; recordCount: number }>()
  const records = sourceRecords.value
  for (const r of records) {
    if (r.kind === 'span' && !r.parentSpanId && r.traceId) {
      const recs = records.filter(x => x.traceId === r.traceId)
      byTrace.set(r.traceId, {
        traceId: r.traceId,
        name: r.name,
        startTs: r.ts,
        endTs: r.ts + (r.durMs ?? 0),
        durMs: r.durMs ?? 0,
        recordCount: recs.length,
      })
    }
  }
  return Array.from(byTrace.values()).sort((a, b) => b.startTs - a.startTs)
})

const filteredTraces = computed(() => {
  const traceIds = new Set(filteredRecords.value.map(r => r.traceId))
  return mockTraces.value.filter(t => traceIds.has(t.traceId))
})

const diagnosticsSubTab = useSmartTabSelection(
  'pulse.diagnostics.active-tab',
  'traces',
  ['traces', 'table', 'timeline'] as const,
)
const selectedTraceId = ref<string | null>(null)

function getTraceRecords(traceId: string): DisplayRecord[] {
  return sourceRecords.value.filter(r => r.traceId === traceId).sort((a, b) => a.ts - b.ts)
}

const selectedTraceRecords = computed(() => {
  const id = selectedTraceId.value
  return id ? getTraceRecords(id) : []
})

const timeRange = computed(() => {
  const records = sourceRecords.value
  if (records.length === 0) return { min: 0, max: 1, width: 1 }
  const ts = records.map(r => r.ts)
  const min = Math.min(...ts)
  const max = Math.max(...ts)
  return { min, max, width: Math.max(1, max - min) }
})

function positionPercent(ts: number, durMs: number): { left: number; width: number } {
  const { min, width } = timeRange.value
  return { left: ((ts - min) / width) * 100, width: Math.max((durMs / width) * 100, 0.5) }
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': case 'fatal': return 'bg-red-500/20 text-red-700 border-red-500/30'
    case 'warn': return 'bg-amber-500/20 text-amber-700 border-amber-500/30'
    case 'info': return 'bg-sky-500/20 text-sky-700 border-sky-500/30'
    case 'debug': case 'trace': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted'
  }
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = { log: 'log', span: 'span' }
  return labels[kind] ?? kind
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <p class="text-sm text-muted-foreground">
      <template v-if="isFromRegister">Логи и трейсы из подключённых вкладок (по каналу).</template>
      <template v-else>Логи и трейсы (mock).</template>
    </p>

    <div class="shrink-0 flex items-center gap-2 flex-wrap">
      <Button v-if="!streamActive" variant="default" size="sm" class="gap-1.5" @click="startStream">
        <Play class="size-3.5" />
        Начать поток событий (mock)
      </Button>
      <Button v-else variant="destructive" size="sm" class="gap-1.5" @click="stopStream">
        <Square class="size-3.5" />
        Остановить поток
      </Button>
      <Button
        v-if="isFromRegister"
        variant="outline"
        size="sm"
        class="gap-1.5"
        @click="clearRegister"
      >
        Очистить регистр
      </Button>
      <span v-if="streamActive" class="text-xs text-muted-foreground">События генерируются случайным образом…</span>
    </div>

    <Card class="shrink-0 p-3">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium">Счётчики</span>
        </div>
        <Badge variant="secondary" class="font-mono text-xs">записей: {{ mockCounters.totalRecords }}</Badge>
        <Badge variant="outline" class="font-mono text-xs">traces: {{ mockCounters.openTraces }}, spans: {{ mockCounters.openSpans }}</Badge>
        <span class="text-muted-foreground">|</span>
        <div class="flex flex-wrap gap-1">
          <Badge v-for="(count, kind) in mockCounters.recordsByKind" :key="kind" variant="outline" class="text-[10px]">{{ kind }}: {{ count }}</Badge>
        </div>
        <span class="text-muted-foreground">|</span>
        <span class="text-xs text-muted-foreground">Policy: {{ mockPolicy.enabled ? 'вкл' : 'выкл' }}, max {{ mockPolicy.maxRecords }}</span>
      </div>
    </Card>

    <!-- Фильтры и сортировка -->
    <Card class="shrink-0 p-3">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-medium text-muted-foreground">Фильтры</span>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-muted-foreground">level:</span>
          <div class="flex flex-wrap gap-1">
            <label v-for="lev in ALL_LEVELS" :key="lev" class="flex items-center gap-1 cursor-pointer">
              <Checkbox :checked="filterLevels.length === 0 || filterLevels.includes(lev)" @update:checked="toggleLevel(lev, $event === true)" />
              <span class="text-[10px]">{{ lev }}</span>
            </label>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-muted-foreground">kind:</span>
          <div class="flex flex-wrap gap-1">
            <label v-for="k in ALL_KINDS" :key="k" class="flex items-center gap-1 cursor-pointer">
              <Checkbox :checked="filterKinds.length === 0 || filterKinds.includes(k)" @update:checked="toggleKind(k, $event === true)" />
              <span class="text-[10px] truncate max-w-20">{{ k }}</span>
            </label>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-muted-foreground">channel:</span>
          <div class="flex flex-wrap gap-1">
            <label v-for="ch in ALL_CHANNELS" :key="ch" class="flex items-center gap-1 cursor-pointer">
              <Checkbox :checked="filterChannels.length === 0 || filterChannels.includes(ch)" @update:checked="toggleChannel(ch, $event === true)" />
              <span class="text-[10px]">{{ ch }}</span>
            </label>
          </div>
        </div>
        <Input v-model="searchText" placeholder="Поиск по name/message…" class="h-7 w-44 text-xs" />
        <span class="text-muted-foreground">|</span>
        <span class="text-[10px] text-muted-foreground">Сортировка:</span>
        <Select v-model="sortBy">
          <SelectTrigger class="w-[100px] h-7 text-xs">
            <SelectValue placeholder="поле" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ts">ts</SelectItem>
            <SelectItem value="level">level</SelectItem>
            <SelectItem value="kind">kind</SelectItem>
            <SelectItem value="channel">channel</SelectItem>
            <SelectItem value="name">name</SelectItem>
            <SelectItem value="durMs">durMs</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'">
          {{ sortDir === 'asc' ? '↑' : '↓' }}
        </Button>
      </div>
    </Card>

    <Tabs v-model="diagnosticsSubTab" class="flex min-h-0 flex-1 flex-col gap-3">
      <TabsList class="grid w-full max-w-[360px] grid-cols-3">
        <TabsTrigger value="traces" class="flex items-center gap-1.5"><List class="size-3.5" /> Трассы</TabsTrigger>
        <TabsTrigger value="table" class="flex items-center gap-1.5"><Table class="size-3.5" /> Таблица</TabsTrigger>
        <TabsTrigger value="timeline" class="flex items-center gap-1.5"><BarChart3 class="size-3.5" /> Таймлайн</TabsTrigger>
      </TabsList>

      <!-- Трассы: раскрываемый список с консольным выводом внутри каждого трейса -->
      <TabsContent value="traces" class="m-0 flex-1 min-h-0">
        <Card class="h-full overflow-hidden p-0">
          <div class="border-b px-3 py-2 text-sm font-medium">Трассы (раскройте для деталей)</div>
          <ScrollArea class="h-[calc(100%-2.5rem)]">
            <div class="p-2 space-y-1">
              <div
                v-for="t in filteredTraces"
                :key="t.traceId"
                class="rounded-md border border-border/50 overflow-hidden"
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
                  @click="toggleTraceExpanded(t.traceId)"
                >
                  <component :is="expandedTraceIds.has(t.traceId) ? ChevronDown : ChevronRight" class="size-4 shrink-0 text-muted-foreground" />
                  <span class="font-medium truncate">{{ t.name }}</span>
                  <Badge variant="secondary" class="text-[10px] shrink-0">{{ t.durMs }} ms</Badge>
                  <span class="text-xs text-muted-foreground shrink-0">{{ t.recordCount }} записей</span>
                </button>
                <div v-if="expandedTraceIds.has(t.traceId)" class="border-t bg-muted/20 px-3 py-2 font-mono text-xs">
                  <div
                    v-for="r in getTraceRecords(t.traceId).filter(matchRecord)"
                    :key="r.id"
                    class="flex flex-wrap items-baseline gap-2 py-0.5 border-b border-border/30 last:border-0"
                  >
                    <span class="text-muted-foreground tabular-nums shrink-0">{{ r.ts }}</span>
                    <Badge :class="levelColor(r.level)" class="text-[10px] shrink-0">{{ r.level }}</Badge>
                    <Badge variant="outline" class="text-[10px] shrink-0">{{ r.kind }}</Badge>
                    <span class="text-muted-foreground shrink-0">[{{ r.channel }}]</span>
                    <span class="font-medium">{{ r.name }}</span>
                    <span v-if="r.message" class="text-muted-foreground truncate">{{ r.message }}</span>
                    <span v-if="r.value != null" class="text-muted-foreground">{{ r.value }}{{ r.unit ? ` ${r.unit}` : '' }}</span>
                    <span v-if="r.durMs != null" class="text-muted-foreground tabular-nums">{{ r.durMs }} ms</span>
                    <span v-if="r.tabId" class="text-muted-foreground text-[10px]">[{{ r.tabId }}]</span>
                  </div>
                </div>
              </div>
              <p v-if="filteredTraces.length === 0" class="px-3 py-4 text-sm text-muted-foreground">Нет трейсов по фильтрам</p>
            </div>
          </ScrollArea>
        </Card>
      </TabsContent>

      <!-- Таблица: все записи с сортировкой -->
      <TabsContent value="table" class="m-0 flex-1 min-h-0">
        <Card class="h-full overflow-hidden p-0">
          <div class="border-b px-3 py-2 text-sm font-medium">Записи ({{ sortedRecords.length }})</div>
          <ScrollArea class="h-[calc(100%-2.5rem)]">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-muted/60">
                <tr class="border-b text-left text-muted-foreground">
                  <th v-if="isFromRegister" class="w-24 px-2 py-1.5">вкладка</th>
                  <th class="w-12 px-2 py-1.5">id</th>
                  <th class="w-20 px-2 py-1.5">ts</th>
                  <th class="w-24 px-2 py-1.5">kind</th>
                  <th class="w-20 px-2 py-1.5">level</th>
                  <th class="w-24 px-2 py-1.5">channel</th>
                  <th class="px-2 py-1.5">name</th>
                  <th class="w-16 px-2 py-1.5 text-right">durMs</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in sortedRecords" :key="r.id" class="border-b border-border/50 hover:bg-muted/30">
                  <td v-if="isFromRegister" class="px-2 py-1.5 text-muted-foreground truncate max-w-24" :title="r.tabId">{{ r.tabId ?? '—' }}</td>
                  <td class="px-2 py-1.5 font-mono">{{ r.id }}</td>
                  <td class="px-2 py-1.5 font-mono tabular-nums">{{ r.ts }}</td>
                  <td class="px-2 py-1.5"><Badge variant="outline" class="text-[10px]">{{ kindLabel(r.kind) }}</Badge></td>
                  <td class="px-2 py-1.5"><Badge :class="levelColor(r.level)" class="text-[10px]">{{ r.level }}</Badge></td>
                  <td class="px-2 py-1.5 text-muted-foreground">{{ r.channel }}</td>
                  <td class="px-2 py-1.5 truncate">{{ r.name }}</td>
                  <td class="px-2 py-1.5 text-right font-mono tabular-nums">{{ r.durMs != null ? `${r.durMs} ms` : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      </TabsContent>

      <TabsContent value="timeline" class="m-0 flex-1 min-h-0">
        <div class="flex h-full min-h-0 gap-3">
          <Card class="w-52 shrink-0 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">Трассы</div>
            <ScrollArea class="h-[200px]">
              <ul class="p-1">
                <li v-for="t in filteredTraces" :key="t.traceId" class="rounded-md px-2 py-1.5 text-sm" :class="selectedTraceId === t.traceId ? 'bg-primary/15 text-primary' : 'hover:bg-muted/50'">
                  <button type="button" class="w-full text-left" @click="selectedTraceId = t.traceId">
                    <span class="truncate block font-medium">{{ t.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ t.durMs }} ms</span>
                  </button>
                </li>
              </ul>
            </ScrollArea>
          </Card>
          <Card class="min-w-0 flex-1 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">Время (mock)</div>
            <div class="relative p-3">
              <div class="relative h-8 rounded border border-border/50 bg-muted/20" :style="{ minWidth: '400px' }">
                <template v-for="t in filteredTraces" :key="t.traceId">
                  <div
                    class="absolute top-1 h-5 rounded bg-primary/40 border border-primary/50 cursor-pointer hover:bg-primary/60"
                    :style="{ left: `${positionPercent(t.startTs, t.durMs).left}%`, width: `${positionPercent(t.startTs, t.durMs).width}%`, minWidth: '4px' }"
                    :title="`${t.name} ${t.durMs}ms`"
                    @click="selectedTraceId = t.traceId"
                  />
                </template>
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground font-mono">{{ timeRange.min }} — {{ timeRange.max }} (диапазон {{ timeRange.width }} ms)</div>
            </div>
          </Card>
          <Card class="w-72 shrink-0 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">Детали трассы</div>
            <ScrollArea class="h-[200px]">
              <div v-if="!selectedTraceId" class="p-3 text-sm text-muted-foreground">Выберите трассу слева или на полоске.</div>
              <ul v-else class="divide-y p-2 text-xs">
                <li v-for="r in selectedTraceRecords" :key="r.id" class="flex flex-wrap items-center gap-1 py-1.5">
                  <Badge :class="levelColor(r.level)" class="text-[10px]">{{ r.level }}</Badge>
                  <Badge variant="outline" class="text-[10px]">{{ kindLabel(r.kind) }}</Badge>
                  <span class="font-medium truncate">{{ r.name }}</span>
                  <span v-if="r.durMs != null" class="text-muted-foreground tabular-nums">{{ r.durMs }} ms</span>
                  <span v-if="r.message" class="w-full truncate text-muted-foreground">{{ r.message }}</span>
                  <span v-if="r.value != null" class="text-muted-foreground">{{ r.value }}{{ r.unit ? ` ${r.unit}` : '' }}</span>
                </li>
              </ul>
            </ScrollArea>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
