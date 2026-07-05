<script setup lang="ts">
import { ComponentType, Endge, RComponentTableColumn_isHtml } from '@endge/core'
import RevoGrid from '@revolist/vue3-datagrid'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { normalizeQueryResult } from '@/features/endge-ide/model/core/endge-ide-demonstration'

type BenchRow = Record<string, unknown>
type BenchMode = 'synthetic' | 'view'
type BenchAlign = 'left' | 'center' | 'right'

type BenchColumnDef = {
  key: string
  title: string
  width: number
  align: BenchAlign
}

type EngineMetrics = {
  fps: number
  avgFrameMs: number
  p95FrameMs: number
  updateToPaintMs: number
  droppedFrames: number
  renderCostMs: number
}

const PLANTS = [
  'Monstera',
  'Ficus',
  'Aloe',
  'Basil',
  'Mint',
  'Lavender',
  'Rosemary',
  'Fern',
  'Orchid',
  'Bamboo',
]

const STAGES = ['seed', 'sprout', 'veg', 'flower', 'harvest']
const DEFAULT_COLUMNS: BenchColumnDef[] = [
  { key: 'id', title: 'ID', width: 80, align: 'right' },
  { key: 'plant', title: 'Plant', width: 150, align: 'left' },
  { key: 'stage', title: 'Stage', width: 120, align: 'left' },
  { key: 'moisture', title: 'Moisture %', width: 120, align: 'right' },
  { key: 'temperature', title: 'Temp C', width: 120, align: 'right' },
  { key: 'ph', title: 'pH', width: 120, align: 'right' },
  { key: 'updatedAt', title: 'Updated', width: 180, align: 'left' },
]

const rows = ref<BenchRow[]>([])
const columns = ref<BenchColumnDef[]>([...DEFAULT_COLUMNS])
const mode = ref<BenchMode>('synthetic')
const selectedViewId = ref<string>('')
const loadingView = ref(false)
const running = ref(false)
const rowCount = ref(5000)
const targetUpdatesPerSec = ref(400)

const updatesCounter = ref(0)
const updatesPerSec = ref(0)
const lastUpdateAt = ref(performance.now())
let updatesTimer: number | null = null

const revoMetrics = reactive<EngineMetrics>({
  fps: 0,
  avgFrameMs: 0,
  p95FrameMs: 0,
  updateToPaintMs: 0,
  droppedFrames: 0,
  renderCostMs: 0,
})

const canvasMetrics = reactive<EngineMetrics>({
  fps: 0,
  avgFrameMs: 0,
  p95FrameMs: 0,
  updateToPaintMs: 0,
  droppedFrames: 0,
  renderCostMs: 0,
})

const revoHostRef = ref<HTMLElement | null>(null)
const revoGridRef = ref<any>(null)
const canvasViewportRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const revoGridHeight = ref(320)
const canvasContentWidth = ref(900)
const canvasContentHeight = ref(520)

const headerHeight = 34
const rowHeight = 28

let flowInterval: number | null = null
let revoRaf: number | null = null
let canvasRaf: number | null = null
let drawDirty = true
let revoObserver: MutationObserver | null = null
let revoResizeObserver: ResizeObserver | null = null
let flowRemainder = 0
let revoRefreshScheduled = false
let revoRefreshPending = false
let revoScrollIdleTimer: number | null = null
let revoLastRefreshAt = 0
const REVO_REFRESH_MIN_INTERVAL_MS = 80
const isRevoScrolling = ref(false)

const revoColumns = computed(() =>
  columns.value.map(col => ({
    prop: col.key,
    name: col.title,
    size: col.width,
    sortable: true,
  })),
)

const viewOptions = computed(() => {
  return Endge.domain
    .getViews()
    .filter((view: any) => view?.queryId != null && view?.componentId != null)
    .map((view: any) => ({
      id: String(view.id),
      name: String(view.name ?? view.identity ?? view.id),
      identity: String(view.identity ?? ''),
      queryId: view.queryId as number,
      componentId: view.componentId as number,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function nowLabel(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function createRow(id: number): BenchRow {
  return {
    id,
    plant: PLANTS[id % PLANTS.length] ?? 'Plant',
    stage: STAGES[id % STAGES.length] ?? 'seed',
    moisture: randomInt(25, 95),
    temperature: randomInt(16, 36),
    ph: Number((5.5 + Math.random() * 2.4).toFixed(1)),
    updatedAt: nowLabel(),
  }
}

function setSyntheticRows(count: number): void {
  columns.value = [...DEFAULT_COLUMNS]
  rows.value = Array.from({ length: count }, (_, i) => createRow(i + 1))
  drawDirty = true
  lastUpdateAt.value = performance.now()
}

function toObjectRow(row: unknown, index: number): BenchRow {
  if (row && typeof row === 'object' && !Array.isArray(row))
    return row as BenchRow
  return { id: index + 1, value: String(row ?? '') }
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.'))
    return source[path]
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object')
      return (acc as Record<string, unknown>)[key]
    return undefined
  }, source)
}

function inferColumnsFromRows(inputRows: BenchRow[]): BenchColumnDef[] {
  const keys = new Set<string>()
  inputRows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key))
  })
  const ordered = Array.from(keys)
  return ordered.map((key, idx) => ({
    key,
    title: key,
    width: idx === 0 ? 120 : 160,
    align: 'left',
  }))
}

async function loadSelectedView(): Promise<void> {
  if (!selectedViewId.value) {
    toast.info('Выберите вид')
    return
  }
  const view = Endge.domain.getView(selectedViewId.value) as any
  if (!view?.queryId || !view?.componentId) {
    toast.error('У вида не настроены query/table')
    return
  }

  const table = Endge.domain.getComponent(view.componentId) as any
  if (!table || table.type !== ComponentType.Table) {
    toast.error('Компонент вида не является таблицей')
    return
  }

  const query = Endge.domain.getQuery(view.queryId)
  if (!query) {
    toast.error('Запрос вида не найден')
    return
  }

  loadingView.value = true
  try {
    const result = await query.run({})
    let rawRows: unknown[] = []
    if (Array.isArray(result)) {
      rawRows = result
    } else {
      const normalized = normalizeQueryResult(result)
      const firstKey = Object.keys(normalized)[0]
      rawRows = firstKey ? normalized[firstKey] ?? [] : []
    }
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      toast.info('По выбранному виду нет строк')
      rows.value = []
      columns.value = [...DEFAULT_COLUMNS]
      return
    }

    const objectRows = rawRows.map((row, index) => toObjectRow(row, index))
    const activeColumns = (table.columns ?? [])
      .filter((x: any) => x?.isActive)
      .filter((x: any) => !RComponentTableColumn_isHtml(x))

    if (activeColumns.length > 0) {
      const nextColumns: BenchColumnDef[] = activeColumns.map((col: any) => ({
        key: String(col.id ?? col.identity ?? ''),
        title: String(col.title ?? col.id ?? 'Column'),
        width: Number.isFinite(Number(col.width)) ? Math.max(80, Number(col.width)) : 160,
        align: String(col.align ?? '').toLowerCase() === 'center'
          ? 'center'
          : String(col.align ?? '').toLowerCase() === 'right'
              ? 'right'
              : 'left',
      }))

      const projectedRows = objectRows.map((row, rowIndex) => {
        const target: BenchRow = {}
        for (const col of activeColumns) {
          const key = String(col.id ?? col.identity ?? '')
          let value = row[key]
          if (value == null && col?.sort?.by)
            value = getByPath(row as Record<string, unknown>, String(col.sort.by))
          if (value == null && col?.dataPaths && typeof col.dataPaths === 'object') {
            const firstPath = Object.values(col.dataPaths)[0]
            if (typeof firstPath === 'string' && firstPath.length)
              value = getByPath(row as Record<string, unknown>, firstPath.replace(/^\$store\.\w+\./, ''))
          }
          target[key] = value ?? ''
        }
        target.id = target.id ?? rowIndex + 1
        return target
      })

      columns.value = nextColumns
      rows.value = projectedRows
    } else {
      columns.value = inferColumnsFromRows(objectRows)
      rows.value = objectRows
    }

    rowCount.value = rows.value.length
    drawDirty = true
    scheduleRevoRefresh()
    toast.success(`Загружен вид: ${view.name ?? view.identity ?? view.id}`)
  } catch (e: any) {
    toast.error('Ошибка загрузки вида', { description: e?.message ?? String(e) })
  } finally {
    loadingView.value = false
  }
}

function regenerateRows(count: number): void {
  if (mode.value === 'synthetic') {
    setSyntheticRows(count)
    return
  }
  drawDirty = true
}

function mutateValue(prev: unknown): unknown {
  if (typeof prev === 'number') {
    const delta = (Math.random() - 0.5) * 10
    return Number((prev + delta).toFixed(2))
  }
  if (typeof prev === 'boolean')
    return !prev
  const token = randomInt(100, 999)
  return `${String(prev ?? '').slice(0, 12)}-${token}`
}

function mutateSharedData(batch: number): void {
  if (!running.value || rows.value.length === 0)
    return

  const total = rows.value.length
  const safeBatch = Math.max(0, Math.min(batch, total))
  if (safeBatch === 0)
    return

  const keys = columns.value
    .map(c => c.key)
    .filter(key => key !== 'id')
  if (!keys.length)
    return

  for (let i = 0; i < safeBatch; i++) {
    const idx = randomInt(0, total - 1)
    const row = rows.value[idx]
    if (!row)
      continue

    const key = keys[randomInt(0, keys.length - 1)] ?? keys[0]
    row[key] = mutateValue(row[key])
    if ('updatedAt' in row)
      row.updatedAt = nowLabel()
  }

  scheduleRevoRefresh()
  updatesCounter.value += safeBatch
  lastUpdateAt.value = performance.now()
  drawDirty = true
}

function scheduleRevoRefresh(): void {
  if (isRevoScrolling.value) {
    revoRefreshPending = true
    return
  }
  if (revoRefreshScheduled)
    return
  const now = performance.now()
  const elapsed = now - revoLastRefreshAt
  if (elapsed < REVO_REFRESH_MIN_INTERVAL_MS) {
    revoRefreshPending = true
    window.setTimeout(() => {
      if (revoRefreshPending && !isRevoScrolling.value) {
        revoRefreshPending = false
        scheduleRevoRefresh()
      }
    }, REVO_REFRESH_MIN_INTERVAL_MS - elapsed)
    return
  }

  revoRefreshScheduled = true
  requestAnimationFrame(() => {
    revoRefreshScheduled = false
    revoLastRefreshAt = performance.now()
    try {
      revoGridRef.value?.$el?.refresh?.()
    } catch {}
    if (revoRefreshPending && !isRevoScrolling.value) {
      revoRefreshPending = false
      scheduleRevoRefresh()
    }
  })
}

function ewma(prev: number, next: number, alpha = 0.2): number {
  if (!Number.isFinite(prev) || prev <= 0)
    return next
  return prev * (1 - alpha) + next * alpha
}

function buildFpsLoop(target: EngineMetrics, rafHolder: 'revo' | 'canvas'): void {
  const frameDurations: number[] = []
  let last = performance.now()
  const tick = () => {
    const now = performance.now()
    const dt = now - last
    last = now
    frameDurations.push(dt)
    if (frameDurations.length > 180)
      frameDurations.shift()

    const avg = frameDurations.reduce((acc, x) => acc + x, 0) / Math.max(1, frameDurations.length)
    const sorted = [...frameDurations].sort((a, b) => a - b)
    const p95 = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? avg

    target.avgFrameMs = Number(avg.toFixed(2))
    target.p95FrameMs = Number(p95.toFixed(2))
    target.fps = Number((1000 / Math.max(1, avg)).toFixed(1))
    if (dt > 16.7)
      target.droppedFrames++

    if (rafHolder === 'revo')
      revoRaf = requestAnimationFrame(tick)
    else
      canvasRaf = requestAnimationFrame(tick)
  }

  if (rafHolder === 'revo')
    revoRaf = requestAnimationFrame(tick)
  else
    canvasRaf = requestAnimationFrame(tick)
}

function stopFlowTimers(): void {
  if (flowInterval != null) {
    window.clearInterval(flowInterval)
    flowInterval = null
  }
}

function startFlowTimers(): void {
  stopFlowTimers()
  flowRemainder = 0
  flowInterval = window.setInterval(() => {
    const ticksPerSecond = 20
    const perTickRaw = Math.max(0, targetUpdatesPerSec.value) / ticksPerSecond
    const perTickInt = Math.floor(perTickRaw)
    flowRemainder += perTickRaw - perTickInt
    const extra = flowRemainder >= 1 ? 1 : 0
    if (extra === 1)
      flowRemainder -= 1
    mutateSharedData(perTickInt + extra)
  }, 1000 / 20)
}

function stopAllRafs(): void {
  if (revoRaf != null) {
    cancelAnimationFrame(revoRaf)
    revoRaf = null
  }
  if (canvasRaf != null) {
    cancelAnimationFrame(canvasRaf)
    canvasRaf = null
  }
}

function drawEllipsisText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: 'left' | 'center' | 'right',
): void {
  let value = text
  if (ctx.measureText(value).width > maxWidth) {
    while (value.length > 0 && ctx.measureText(`${value}...`).width > maxWidth) {
      value = value.slice(0, -1)
    }
    value = `${value}...`
  }

  if (align === 'right')
    ctx.textAlign = 'right'
  else if (align === 'center')
    ctx.textAlign = 'center'
  else
    ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const tx = align === 'right' ? x + maxWidth : align === 'center' ? x + maxWidth / 2 : x
  ctx.fillText(value, tx, y)
}

function renderCanvasTable(): void {
  const canvas = canvasRef.value
  const viewport = canvasViewportRef.value
  if (!canvas || !viewport)
    return

  const t0 = performance.now()
  const dpr = window.devicePixelRatio || 1
  const localColumns = columns.value.length ? columns.value : DEFAULT_COLUMNS
  const tableWidth = localColumns.reduce((acc, c) => acc + c.width, 0)
  const tableHeight = headerHeight + rows.value.length * rowHeight
  const width = Math.max(320, viewport.clientWidth)
  const height = Math.max(220, viewport.clientHeight)
  canvasContentWidth.value = Math.max(tableWidth, viewport.clientWidth)
  canvasContentHeight.value = Math.max(tableHeight, viewport.clientHeight)

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const scrollTop = viewport.scrollTop
  const scrollLeft = viewport.scrollLeft
  const viewportBottom = scrollTop + viewport.clientHeight
  const startRow = Math.max(0, Math.floor((scrollTop - headerHeight) / rowHeight) - 4)
  const endRow = Math.min(rows.value.length - 1, Math.ceil((viewportBottom - headerHeight) / rowHeight) + 4)

  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(0, 0, width, headerHeight)

  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, headerHeight)
  ctx.lineTo(width, headerHeight)
  ctx.stroke()

  let cx = -scrollLeft
  ctx.fillStyle = '#0f172a'
  ctx.font = '600 12px Inter'
  for (const col of localColumns) {
    ctx.beginPath()
    ctx.moveTo(cx + col.width, 0)
    ctx.lineTo(cx + col.width, height)
    ctx.stroke()
    drawEllipsisText(ctx, col.title, cx + 8, headerHeight / 2, col.width - 16, 'left')
    cx += col.width
  }

  ctx.font = '400 12px Inter'
  for (let r = startRow; r <= endRow; r++) {
    const row = rows.value[r]
    if (!row)
      continue
    const y = headerHeight + r * rowHeight - scrollTop
    ctx.fillStyle = r % 2 === 0 ? '#ffffff' : '#f8fafc'
    ctx.fillRect(0, y, Math.max(width, canvasContentWidth.value), rowHeight)

    ctx.strokeStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.moveTo(0, y + rowHeight)
    ctx.lineTo(width, y + rowHeight)
    ctx.stroke()

    let x = -scrollLeft
    for (const col of localColumns) {
      const cellValue = String((row as Record<string, unknown>)[col.key] ?? '')
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 2, y + 1, col.width - 4, rowHeight - 2)
      ctx.clip()
      ctx.fillStyle = '#0f172a'
      drawEllipsisText(ctx, cellValue, x + 8, y + rowHeight / 2, col.width - 16, col.align)
      ctx.restore()
      x += col.width
    }
  }

  const t1 = performance.now()
  canvasMetrics.renderCostMs = ewma(canvasMetrics.renderCostMs, t1 - t0)
  canvasMetrics.updateToPaintMs = ewma(canvasMetrics.updateToPaintMs, t1 - lastUpdateAt.value)
}

function startCanvasLoop(): void {
  const loop = () => {
    if (drawDirty || running.value) {
      renderCanvasTable()
      drawDirty = false
    }
    canvasRaf = requestAnimationFrame(loop)
  }
  canvasRaf = requestAnimationFrame(loop)
}

function setupRevoMutationObserver(): void {
  if (revoObserver) {
    revoObserver.disconnect()
    revoObserver = null
  }
  if (!revoHostRef.value)
    return

  revoObserver = new MutationObserver(() => {
    const now = performance.now()
    revoMetrics.updateToPaintMs = ewma(revoMetrics.updateToPaintMs, now - lastUpdateAt.value)
    const t0 = performance.now()
    const t1 = performance.now()
    revoMetrics.renderCostMs = ewma(revoMetrics.renderCostMs, t1 - t0)
  })

  revoObserver.observe(revoHostRef.value, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false,
  })
}

function resetCounters(): void {
  updatesCounter.value = 0
  updatesPerSec.value = 0
  revoMetrics.droppedFrames = 0
  canvasMetrics.droppedFrames = 0
}

function toggleRun(): void {
  running.value = !running.value
}

watch(rowCount, (count) => {
  if (mode.value === 'synthetic') {
    regenerateRows(count)
    resetCounters()
  }
})

watch(targetUpdatesPerSec, () => {
  if (running.value)
    startFlowTimers()
})

watch(running, (isRunning) => {
  if (isRunning)
    startFlowTimers()
  else
    stopFlowTimers()
})

watch(mode, (nextMode) => {
  stopFlowTimers()
  running.value = false
  resetCounters()
  if (nextMode === 'synthetic') {
    setSyntheticRows(rowCount.value)
  } else {
    rows.value = []
    columns.value = [...DEFAULT_COLUMNS]
  }
})

function onCanvasScroll(): void {
  drawDirty = true
}

function onRevoViewportScroll(): void {
  isRevoScrolling.value = true
  if (revoScrollIdleTimer != null) {
    window.clearTimeout(revoScrollIdleTimer)
    revoScrollIdleTimer = null
  }
  revoScrollIdleTimer = window.setTimeout(() => {
    isRevoScrolling.value = false
    if (revoRefreshPending) {
      revoRefreshPending = false
      scheduleRevoRefresh()
    }
  }, 120)
}

function syncRevoHeight(): void {
  const host = revoHostRef.value
  if (!host)
    return
  revoGridHeight.value = Math.max(220, Math.floor(host.getBoundingClientRect().height))
}

onMounted(async () => {
  setSyntheticRows(rowCount.value)
  await nextTick()
  setupRevoMutationObserver()
  syncRevoHeight()
  if (revoHostRef.value) {
    revoResizeObserver = new ResizeObserver(() => {
      syncRevoHeight()
    })
    revoResizeObserver.observe(revoHostRef.value)
  }

  buildFpsLoop(revoMetrics, 'revo')
  buildFpsLoop(canvasMetrics, 'canvas')
  startCanvasLoop()
  startFlowTimers()

  updatesTimer = window.setInterval(() => {
    updatesPerSec.value = updatesCounter.value
    updatesCounter.value = 0
  }, 1000)
})

onUnmounted(() => {
  stopFlowTimers()
  stopAllRafs()
  if (updatesTimer != null) {
    window.clearInterval(updatesTimer)
    updatesTimer = null
  }
  if (revoObserver) {
    revoObserver.disconnect()
    revoObserver = null
  }
  if (revoResizeObserver) {
    revoResizeObserver.disconnect()
    revoResizeObserver = null
  }
  if (revoScrollIdleTimer != null) {
    window.clearTimeout(revoScrollIdleTimer)
    revoScrollIdleTimer = null
  }
})

const totalColumns = computed(() => columns.value.length)
</script>

<template>
  <div class="w-full h-full p-4">
    <div class="w-full h-full rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-sm font-semibold">
          Benchmark таблиц: RevoGrid vs Canvas NOVA
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <label class="text-xs text-muted-foreground">
            Режим
            <select v-model="mode" class="ml-1 h-8 rounded-md border px-2 text-xs bg-background">
              <option value="synthetic">Синтетический</option>
              <option value="view">По виду</option>
            </select>
          </label>
          <label v-if="mode === 'view'" class="text-xs text-muted-foreground">
            Вид
            <select v-model="selectedViewId" class="ml-1 h-8 min-w-[260px] rounded-md border px-2 text-xs bg-background">
              <option value="">Выберите вид</option>
              <option
                v-for="view in viewOptions"
                :key="view.id"
                :value="view.id"
              >
                {{ view.name }} ({{ view.identity || view.id }})
              </option>
            </select>
          </label>
          <Button
            v-if="mode === 'view'"
            type="button"
            variant="outline"
            size="sm"
            :disabled="loadingView"
            @click="loadSelectedView"
          >
            {{ loadingView ? 'Загрузка…' : 'Подгрузить вид' }}
          </Button>
          <label class="text-xs text-muted-foreground">
            Rows
            <select v-model.number="rowCount" class="ml-1 h-8 rounded-md border px-2 text-xs bg-background">
              <option :value="1000">1000</option>
              <option :value="5000">5000</option>
              <option :value="10000">10000</option>
              <option :value="30000">30000</option>
            </select>
          </label>
          <label class="text-xs text-muted-foreground">
            Updates/sec
            <input
              v-model.number="targetUpdatesPerSec"
              type="number"
              min="0"
              step="10"
              class="ml-1 h-8 w-28 rounded-md border px-2 text-xs bg-background"
            >
          </label>
          <Button type="button" variant="outline" size="sm" @click="toggleRun">
            {{ running ? 'Пауза потока' : 'Старт потока' }}
          </Button>
          <Button type="button" variant="outline" size="sm" @click="regenerateRows(rowCount); resetCounters()">
            Сброс данных
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full min-h-0">
        <div class="rounded-md border bg-white min-h-0 flex flex-col">
          <div class="px-3 py-2 border-b text-xs font-semibold flex items-center justify-between">
            <span>RevoGrid</span>
            <span class="text-muted-foreground">Rows: {{ rows.length }} | Cols: {{ totalColumns }}</span>
          </div>
          <div class="px-3 py-2 border-b text-[11px] grid grid-cols-3 gap-2">
            <div>FPS: <b>{{ revoMetrics.fps }}</b></div>
            <div>Frame avg: <b>{{ revoMetrics.avgFrameMs }}ms</b></div>
            <div>Frame p95: <b>{{ revoMetrics.p95FrameMs }}ms</b></div>
            <div>Upd -> Paint: <b>{{ revoMetrics.updateToPaintMs.toFixed(2) }}ms</b></div>
            <div>Render cost: <b>{{ revoMetrics.renderCostMs.toFixed(2) }}ms</b></div>
            <div>Dropped: <b>{{ revoMetrics.droppedFrames }}</b></div>
          </div>
          <div ref="revoHostRef" class="flex-1 min-h-0">
            <RevoGrid
              ref="revoGridRef"
              class="w-full"
              :style="{ height: `${revoGridHeight}px` }"
              :columns="revoColumns"
              :source="rows"
              :row-size="rowHeight"
              theme="compact"
              resize
              readonly
              :range="false"
              :use-autofill="false"
              @viewportscroll="onRevoViewportScroll"
            />
          </div>
        </div>

        <div class="rounded-md border bg-white min-h-0 flex flex-col">
          <div class="px-3 py-2 border-b text-xs font-semibold flex items-center justify-between">
            <span>Canvas NOVA</span>
            <span class="text-muted-foreground">Rows: {{ rows.length }} | Cols: {{ totalColumns }}</span>
          </div>
          <div class="px-3 py-2 border-b text-[11px] grid grid-cols-3 gap-2">
            <div>FPS: <b>{{ canvasMetrics.fps }}</b></div>
            <div>Frame avg: <b>{{ canvasMetrics.avgFrameMs }}ms</b></div>
            <div>Frame p95: <b>{{ canvasMetrics.p95FrameMs }}ms</b></div>
            <div>Upd -> Paint: <b>{{ canvasMetrics.updateToPaintMs.toFixed(2) }}ms</b></div>
            <div>Render cost: <b>{{ canvasMetrics.renderCostMs.toFixed(2) }}ms</b></div>
            <div>Dropped: <b>{{ canvasMetrics.droppedFrames }}</b></div>
          </div>
          <div
            ref="canvasViewportRef"
            class="flex-1 min-h-0 overflow-auto"
            @scroll="onCanvasScroll"
          >
            <div
              class="relative"
              :style="{ width: `${canvasContentWidth}px`, height: `${canvasContentHeight}px` }"
            >
              <canvas ref="canvasRef" class="block sticky top-0 left-0 z-10" />
            </div>
          </div>
        </div>
      </div>

      <div class="text-[11px] text-muted-foreground border-t pt-2">
        Общий поток: <b>{{ updatesPerSec }}</b> updates/sec. Источник данных единый для обеих таблиц.
      </div>
    </div>
  </div>
</template>
