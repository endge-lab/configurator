<script setup lang="ts">
/**
 * Вкладка «Диагностика» — mock-данные для визуальной проверки.
 * Позже подключается к Endge.diagnostics.
 */
import { Activity, BarChart3, List, Play, Square } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MAX_RECORDS = 800

/** Mock: тип записи для отображения (упрощённый) */
interface MockRecord {
  id: number
  ts: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
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
}

const nextId = ref(14)
const mockRecords = ref<MockRecord[]>([
  { id: 1, ts: 1000, level: 'info', kind: 'trace-start', channel: 'runtime', name: 'domain.compile', traceId: 'tr-1' },
  { id: 2, ts: 1005, level: 'info', kind: 'span-start', channel: 'domain', name: 'resolve-bindings', traceId: 'tr-1', spanId: 'sp-1' },
  { id: 3, ts: 1020, level: 'debug', kind: 'event', channel: 'domain', name: 'binding.resolved', message: 'Query flights bound', traceId: 'tr-1', spanId: 'sp-1' },
  { id: 4, ts: 1045, level: 'info', kind: 'span-end', channel: 'domain', name: 'resolve-bindings', traceId: 'tr-1', spanId: 'sp-1', durMs: 40 },
  { id: 5, ts: 1050, level: 'info', kind: 'span-start', channel: 'query', name: 'build-request', traceId: 'tr-1', spanId: 'sp-2' },
  { id: 6, ts: 1080, level: 'info', kind: 'measurement', channel: 'query', name: 'request.size', value: 256, unit: 'bytes', traceId: 'tr-1', spanId: 'sp-2' },
  { id: 7, ts: 1120, level: 'info', kind: 'span-end', channel: 'query', name: 'build-request', traceId: 'tr-1', spanId: 'sp-2', durMs: 70 },
  { id: 8, ts: 1150, level: 'info', kind: 'trace-end', channel: 'runtime', name: 'domain.compile', traceId: 'tr-1', durMs: 150 },
  { id: 9, ts: 1200, level: 'info', kind: 'trace-start', channel: 'runtime', name: 'query.run', traceId: 'tr-2' },
  { id: 10, ts: 1210, level: 'info', kind: 'span-start', channel: 'query', name: 'execute', traceId: 'tr-2', spanId: 'sp-3' },
  { id: 11, ts: 1350, level: 'info', kind: 'span-end', channel: 'query', name: 'execute', traceId: 'tr-2', spanId: 'sp-3', durMs: 140 },
  { id: 12, ts: 1360, level: 'info', kind: 'trace-end', channel: 'runtime', name: 'query.run', traceId: 'tr-2', durMs: 160 },
  { id: 13, ts: 1400, level: 'warn', kind: 'event', channel: 'events', name: 'slow-render', message: 'Render > 100ms', traceId: 'tr-3' },
])

/** Счётчики считаем по текущим записям */
const mockCounters = computed(() => {
  const records = mockRecords.value
  const byKind: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  let openTraces = 0
  let openSpans = 0
  const traceStarted = new Set<string>()
  const spanStarted = new Set<string>()
  for (const r of records) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    if (r.channel) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
    if (r.kind === 'trace-start' && r.traceId) { traceStarted.add(r.traceId); openTraces++ }
    if (r.kind === 'trace-end' && r.traceId) traceStarted.delete(r.traceId)
    if (r.kind === 'span-start' && r.spanId) { spanStarted.add(r.spanId); openSpans++ }
    if (r.kind === 'span-end' && r.spanId) spanStarted.delete(r.spanId)
  }
  openTraces = traceStarted.size
  openSpans = spanStarted.size
  return {
    totalRecords: records.length,
    droppedByPolicy: 0,
    droppedByCapacity: 0,
    activeExporters: 0,
    openTraces,
    openSpans,
    recordsByKind: byKind,
    recordsByChannel: byChannel,
  }
})

const mockPolicy = {
  enabled: true,
  levelThreshold: 'info' as const,
  sampleRate: 1,
  maxRecords: 10_000,
  exportersEnabled: false,
}

/** Поток событий: таймер и состояние */
const streamActive = ref(false)
let streamTimer: ReturnType<typeof setInterval> | null = null

const TRACE_NAMES = ['domain.compile', 'query.run', 'runtime.execute', 'bindings.apply', 'flow.step']
const CHANNELS = ['runtime', 'domain', 'query', 'bindings', 'events']
const SPAN_NAMES = ['resolve-bindings', 'build-request', 'execute', 'hydrate', 'render', 'parse']
const EVENT_NAMES = ['binding.resolved', 'request.sent', 'response.received', 'cache.hit', 'slow-render']
const EVENT_MESSAGES = ['OK', 'Completed', 'Render > 50ms', 'Cache miss', 'Retry']
const LEVELS: MockRecord['level'][] = ['trace', 'debug', 'info', 'warn', 'error']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rndId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function appendRecord(record: MockRecord): void {
  const list = mockRecords.value
  const next = list.length >= MAX_RECORDS ? list.slice(-MAX_RECORDS + 1) : [...list]
  record.id = nextId.value++
  record.ts = Date.now()
  next.push(record)
  mockRecords.value = next
}

function emitRandomEvent(): void {
  const ts = Date.now()
  const traceId = `tr-${rndId()}`
  const channel = pick(CHANNELS)
  const level = pick(LEVELS)
  const traceName = pick(TRACE_NAMES)
  appendRecord({ id: 0, ts, level, kind: 'trace-start', channel, name: traceName, traceId })
  const numSpans = Math.floor(Math.random() * 3) + 1
  let parentSpanId: string | undefined
  for (let i = 0; i < numSpans; i++) {
    const spanId = `sp-${rndId()}`
    const spanName = pick(SPAN_NAMES)
    appendRecord({ id: 0, ts: Date.now(), level, kind: 'span-start', channel, name: spanName, traceId, spanId, parentSpanId })
    if (Math.random() > 0.5) {
      appendRecord({ id: 0, ts: Date.now(), level: 'debug', kind: 'event', channel, name: pick(EVENT_NAMES), message: pick(EVENT_MESSAGES), traceId, spanId })
    }
    if (Math.random() > 0.4) {
      appendRecord({ id: 0, ts: Date.now(), level, kind: 'measurement', channel, name: 'duration', value: Math.round(Math.random() * 200), unit: 'ms', traceId, spanId })
    }
    const durMs = Math.round(20 + Math.random() * 150)
    appendRecord({ id: 0, ts: Date.now(), level, kind: 'span-end', channel, name: spanName, traceId, spanId, parentSpanId, durMs })
    parentSpanId = spanId
  }
  const totalDur = Math.round(50 + Math.random() * 200)
  appendRecord({ id: 0, ts: Date.now(), level, kind: 'trace-end', channel, name: traceName, traceId, durMs: totalDur })
}

function startStream(): void {
  if (streamActive.value) return
  streamActive.value = true
  streamTimer = setInterval(() => emitRandomEvent(), 400 + Math.random() * 600)
}

function stopStream(): void {
  streamActive.value = false
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
}

onBeforeUnmount(() => {
  stopStream()
})

/** Уникальные трассы для левой панели таймлайна */
const mockTraces = computed(() => {
  const byTrace = new Map<string, { traceId: string; name: string; startTs: number; endTs: number; durMs: number }>()
  for (const r of mockRecords.value) {
    if (r.kind === 'trace-start' && r.traceId) {
      byTrace.set(r.traceId, { traceId: r.traceId, name: r.name, startTs: r.ts, endTs: r.ts, durMs: 0 })
    }
    if (r.kind === 'trace-end' && r.traceId && r.durMs != null) {
      const t = byTrace.get(r.traceId)
      if (t) {
        t.endTs = r.ts
        t.durMs = r.durMs
      }
    }
  }
  return Array.from(byTrace.values()).sort((a, b) => a.startTs - b.startTs)
})

const activeTab = ref<'overview' | 'timeline'>('overview')
const selectedTraceId = ref<string | null>(null)

const selectedTraceRecords = computed(() => {
  const id = selectedTraceId.value
  if (!id) return []
  return mockRecords.value.filter(r => r.traceId === id)
})

/** Временной диапазон для отрисовки таймлайна (mock) */
const timeRange = computed(() => {
  const records = mockRecords.value
  if (records.length === 0) return { min: 0, max: 1, width: 1 }
  const ts = records.map(r => r.ts)
  const min = Math.min(...ts)
  const max = Math.max(...ts)
  return { min, max, width: Math.max(1, max - min) }
})

/** Позиция полоски в % от min (0..100) */
function positionPercent(ts: number, durMs: number): { left: number; width: number } {
  const { min, width } = timeRange.value
  const left = ((ts - min) / width) * 100
  const w = (durMs / width) * 100
  return { left, width: Math.max(w, 0.5) }
}

function formatTs(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23)
}

function levelColor(level: string): string {
  switch (level) {
    case 'error':
    case 'fatal':
      return 'bg-red-500/20 text-red-700 border-red-500/30'
    case 'warn':
      return 'bg-amber-500/20 text-amber-700 border-amber-500/30'
    case 'info':
      return 'bg-sky-500/20 text-sky-700 border-sky-500/30'
    case 'debug':
    case 'trace':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted'
  }
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    'trace-start': 'trace-start',
    'trace-end': 'trace-end',
    'span-start': 'span-start',
    'span-end': 'span-end',
    event: 'event',
    measurement: 'measurement',
    snapshot: 'snapshot',
  }
  return labels[kind] ?? kind
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3">
    <!-- Кнопка потока событий -->
    <div class="shrink-0 flex items-center gap-2">
      <Button
        v-if="!streamActive"
        variant="default"
        size="sm"
        class="gap-1.5"
        @click="startStream"
      >
        <Play class="size-3.5" />
        Начать поток событий
      </Button>
      <Button
        v-else
        variant="destructive"
        size="sm"
        class="gap-1.5"
        @click="stopStream"
      >
        <Square class="size-3.5" />
        Остановить поток
      </Button>
      <span v-if="streamActive" class="text-xs text-muted-foreground">
        События генерируются случайным образом…
      </span>
    </div>

    <!-- Метрики -->
    <Card class="shrink-0 p-3">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium">Счётчики</span>
        </div>
        <Badge variant="secondary" class="font-mono text-xs">
          записей: {{ mockCounters.totalRecords }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          отброшено (policy): {{ mockCounters.droppedByPolicy }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          отброшено (буфер): {{ mockCounters.droppedByCapacity }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          открыто traces: {{ mockCounters.openTraces }}, spans: {{ mockCounters.openSpans }}
        </Badge>
        <span class="text-muted-foreground">|</span>
        <div class="flex flex-wrap gap-1">
          <Badge
            v-for="(count, kind) in mockCounters.recordsByKind"
            :key="kind"
            variant="outline"
            class="text-[10px]"
          >
            {{ kind }}: {{ count }}
          </Badge>
        </div>
        <span class="text-muted-foreground">|</span>
        <div class="text-xs text-muted-foreground">
          Policy: {{ mockPolicy.enabled ? 'вкл' : 'выкл' }}, порог {{ mockPolicy.levelThreshold }}, max {{ mockPolicy.maxRecords }}
        </div>
      </div>
    </Card>

    <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col gap-3">
      <TabsList class="grid w-full max-w-[280px] grid-cols-2">
        <TabsTrigger value="overview" class="flex items-center gap-1.5">
          <List class="size-3.5" />
          Обзор
        </TabsTrigger>
        <TabsTrigger value="timeline" class="flex items-center gap-1.5">
          <BarChart3 class="size-3.5" />
          Таймлайн
        </TabsTrigger>
      </TabsList>

      <!-- Обзор: таблица записей -->
      <TabsContent value="overview" class="m-0 flex-1 min-h-0">
        <Card class="h-full overflow-hidden p-0">
          <div class="border-b px-3 py-2 text-sm font-medium">
            Последние записи (mock)
          </div>
          <ScrollArea class="h-[calc(100%-3rem)]">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-muted/60">
                <tr class="border-b text-left text-muted-foreground">
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
                <tr
                  v-for="r in mockRecords"
                  :key="r.id"
                  class="border-b border-border/50 hover:bg-muted/30"
                >
                  <td class="px-2 py-1.5 font-mono">{{ r.id }}</td>
                  <td class="px-2 py-1.5 font-mono tabular-nums">{{ r.ts }}</td>
                  <td class="px-2 py-1.5">
                    <Badge variant="outline" class="text-[10px]">
                      {{ kindLabel(r.kind) }}
                    </Badge>
                  </td>
                  <td class="px-2 py-1.5">
                    <Badge :class="levelColor(r.level)" class="text-[10px]">
                      {{ r.level }}
                    </Badge>
                  </td>
                  <td class="px-2 py-1.5 text-muted-foreground">{{ r.channel }}</td>
                  <td class="px-2 py-1.5 truncate">{{ r.name }}</td>
                  <td class="px-2 py-1.5 text-right font-mono tabular-nums">
                    {{ r.durMs != null ? `${r.durMs} ms` : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      </TabsContent>

      <!-- Таймлайн: трассы + полоски + детали -->
      <TabsContent value="timeline" class="m-0 flex-1 min-h-0">
        <div class="flex h-full min-h-0 gap-3">
          <!-- Список трасс -->
          <Card class="w-52 shrink-0 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">
              Трассы
            </div>
            <ScrollArea class="h-[200px]">
              <ul class="p-1">
                <li
                  v-for="t in mockTraces"
                  :key="t.traceId"
                  class="rounded-md px-2 py-1.5 text-sm"
                  :class="selectedTraceId === t.traceId ? 'bg-primary/15 text-primary' : 'hover:bg-muted/50'"
                >
                  <button
                    type="button"
                    class="w-full text-left"
                    @click="selectedTraceId = t.traceId"
                  >
                    <span class="truncate block font-medium">{{ t.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ t.durMs }} ms</span>
                  </button>
                </li>
              </ul>
            </ScrollArea>
          </Card>

          <!-- Полоски таймлайна -->
          <Card class="min-w-0 flex-1 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">
              Время (mock)
            </div>
            <div class="relative p-3">
              <div
                class="relative h-8 rounded border border-border/50 bg-muted/20"
                :style="{ minWidth: '400px' }"
              >
                <template v-for="t in mockTraces" :key="t.traceId">
                  <div
                    class="absolute top-1 h-5 rounded bg-primary/40 border border-primary/50 cursor-pointer hover:bg-primary/60"
                    :style="{
                      left: `${positionPercent(t.startTs, t.durMs).left}%`,
                      width: `${positionPercent(t.startTs, t.durMs).width}%`,
                      minWidth: '4px',
                    }"
                    :title="`${t.name} ${t.durMs}ms`"
                    @click="selectedTraceId = t.traceId"
                  />
                </template>
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground font-mono">
                {{ timeRange.min }} — {{ timeRange.max }} (диапазон {{ timeRange.width }} ms)
              </div>
            </div>
          </Card>

          <!-- Детали выбранной трассы -->
          <Card class="w-72 shrink-0 overflow-hidden p-0">
            <div class="border-b px-2 py-2 text-xs font-medium text-muted-foreground">
              Детали трассы
            </div>
            <ScrollArea class="h-[200px]">
              <div v-if="!selectedTraceId" class="p-3 text-sm text-muted-foreground">
                Выберите трассу слева или на полоске.
              </div>
              <ul v-else class="divide-y p-2 text-xs">
                <li
                  v-for="r in selectedTraceRecords"
                  :key="r.id"
                  class="flex flex-wrap items-center gap-1 py-1.5"
                >
                  <Badge :class="levelColor(r.level)" class="text-[10px]">
                    {{ r.level }}
                  </Badge>
                  <Badge variant="outline" class="text-[10px]">
                    {{ kindLabel(r.kind) }}
                  </Badge>
                  <span class="font-medium truncate">{{ r.name }}</span>
                  <span v-if="r.durMs != null" class="text-muted-foreground tabular-nums">
                    {{ r.durMs }} ms
                  </span>
                  <span v-if="r.message" class="w-full truncate text-muted-foreground">
                    {{ r.message }}
                  </span>
                  <span v-if="r.value != null" class="text-muted-foreground">
                    {{ r.value }}{{ r.unit ? ` ${r.unit}` : '' }}
                  </span>
                </li>
              </ul>
            </ScrollArea>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
