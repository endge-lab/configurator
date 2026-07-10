import { TimelineChart, TimelineEvents } from '@endge/timeline-chart'
import { addMinutes, addSeconds } from 'date-fns'
import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { TimelineChartTemplatesDebug } from '@/features/@endge-admin/app/timeline-debug/templates'
import type {
  TimelineDebugGroup,
  TimelineDebugTask,
} from '@/features/@endge-admin/app/timeline-debug/types'
import { Endge } from '@endge/core'
import type { LogRecord, SpanEnd, SpanStart } from '@endge/core'
import type { LogNode } from '@endge/core'

export const CANVAS_DEBUG_ID = 'endge-timeline-debug-id'

export const useTimelineDebugStore = defineStore('timeline-debug-store', () => {
  let timeline: TimelineChart<TimelineDebugGroup, TimelineDebugTask> = markRaw(
    new TimelineChart(),
  )
  const offFns: (() => void)[] = []
  const offIntervals: NodeJS.Timeout[] = []

  // При выбранном элементе подгружается детали логов
  const details = ref<LogNode | null>(null)

  async function init(): Promise<void> {
    timeline = markRaw(new TimelineChart())

    // Инициализируем таймлайн
    timeline.attach(CANVAS_DEBUG_ID)
    timeline.init()

    applyOptions()
    applyTemplates()
    // addTimeNow()
    setupEvents()
    // applyGeneratedData()
  }

  function destroy(): void {
    offFns.forEach((fn) => fn())
    offIntervals.forEach((fn) => clearInterval(fn))

    offFns.length = 0
    offIntervals.length = 0
    timeline.destroy()
  }

  function applyOptions(): void {
    timeline.options({
      debug: true,
      groupsVisible: true,
      chartBEnabled: false,
      tasksGraphicsEnabled: true,
      timezone: 'Europe/Moscow',
      tsEnabled: true,

      height: 300,

      groupsColumns: [
        {
          id: 'group',
          title: 'Группа',
          data: (group: TimelineDebugGroup) => group.displayName,
          width: 150,
        },
      ],

      selection: {
        enabled: true,

        trigger: ['click', 'context'],

        multipleMode: 'meta',

        deselectMode: ['single', 'multiple-other', 'chart-click'],
      },

      scroll: {
        barVerticalEnabled: false,
        barHorizontalEnabled: false,
      },

      tooltipDelay: 300,
      groupYPadding: 1,
      taskYMargin: 1,

      tsMinTime: Date.now(),
      tsMaxTime: addMinutes(Date.now(), 15).getTime(),
      tsStartTime: Date.now(),
      tsEndTime: addSeconds(Date.now(), 5).getTime(),

      tsMinWidthMs: 50,

      tsFormat: [
        {
          interval: 100,
          format: { second: '2-digit', fractionalSecondDigits: 1 },
          majorFormat: {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          },
        },
        {
          interval: 250,
          format: {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 1,
          },
          majorFormat: {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          },
        },
        {
          interval: 500,
          format: {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 1,
          },
          majorFormat: {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          },
        },
        // секунды
        {
          interval: 1_000,
          format: { second: '2-digit' },
          majorFormat: { hour: '2-digit', minute: '2-digit' },
        },
        {
          interval: 2_000,
          format: { second: '2-digit' },
          majorFormat: { hour: '2-digit', minute: '2-digit' },
        },
        // минуты/часы сверху
        {
          interval: 60_000,
          format: { minute: '2-digit' },
          majorFormat: { hour: '2-digit', minute: '2-digit' },
        },
      ],

      grid: {
        type: 'plain',
        horizontal: {
          color: '#c5c5c5',
          width: 0.5,
        },
        vertical: {
          major: {
            color: '#c5c5c5',
            width: 0.5,
          },
          minor: {
            color: '#c5c5c5',
            width: 0.5,
          },
        },
      },

      ts: {
        majorColor: 'white',
        minorColor: 'white',
      },
    })
  }

  function setupEvents(): void {
    timeline.on(TimelineEvents.Click, (payload) => {
      const spanId = payload?.task?.id
      if (!spanId) {
        return
      }

      details.value = Endge.debug.getSpanSubtree(spanId)
      console.log(details.value)
    })
  }

  function applyGeneratedData(): void {
    const base = Date.now()

    // helpers
    const rand = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min
    const mkRange = (
      id: string,
      displayName: string,
      groupId: string,
      t0: number,
      durMs: number,
    ): TimelineDebugTask => ({
      id,
      type: 'range',
      displayName,
      groupId,
      startTime: t0,
      endTime: t0 + durMs,
      editable: false,
    })

    const groups: TimelineDebugGroup[] = [
      { id: 'action', displayName: 'Действия' },
      { id: 'http', displayName: 'Запросы' },
      { id: 'sse', displayName: 'SSE' },
      { id: 'raph', displayName: 'Raph' },
      { id: 'ui', displayName: 'Компоненты' },
    ]

    // действие: 200-300 ms
    const tAction0 = base + 100
    const durAction = rand(200, 300)

    // http основной: 80-150 ms, внутри действия
    const tHttpMain0 = tAction0 + rand(10, 40)
    const durHttpMain = rand(80, 150)

    // парсинг ответа: 20–40 ms, вложенно после http
    const tParse0 = tHttpMain0 + durHttpMain - rand(50, 70) // начинается ближе к концу запроса
    const durParse = rand(20, 40)

    // raph.compute: 10–25 ms после Store-обновления (условно сразу после парсинга)
    const tRaph0 = tParse0 + durParse + rand(5, 15)
    const durRaph = rand(10, 25)

    // render: 12–30 ms (после raph)
    const tRender0 = tRaph0 + durRaph + rand(5, 20)
    const durRender = rand(12, 30)

    // второй http (метаданные) в параллели: 60–120 ms
    const tHttpMeta0 = tAction0 + rand(20, 60)
    const durHttpMeta = rand(60, 120)

    // несколько SSE событий 10–50 ms, в разные моменты окна
    const sseEvents = Array.from({ length: 3 }).map((_, i) => {
      const t0 = base + 500 + i * 700 + rand(0, 200)
      const dur = rand(10, 50)
      return mkRange(`t-sse-${i}`, `SSE.message #${i + 1}`, 'sse', t0, dur)
    })

    const tasks: TimelineDebugTask[] = [
      mkRange('t-action-run', 'Action.run', 'action', tAction0, durAction),

      mkRange(
        't-http-main',
        'GET /api/flights',
        'http',
        tHttpMain0,
        durHttpMain,
      ),
      mkRange('t-parse', 'parse.json', 'http', tParse0, durParse), // можно и в lane=compute, если будет

      mkRange('t-raph', 'Raph.compute', 'raph', tRaph0, durRaph),
      mkRange('t-render', 'FlightsTable.render', 'ui', tRender0, durRender),

      mkRange(
        't-http-meta',
        'GET /api/flight-meta',
        'http',
        tHttpMeta0,
        durHttpMeta,
      ),

      ...sseEvents,
    ]

    timeline.data({ groups, tasks })
  }

  /**
   * Загружает текущий журнал из Endge.debug и проецирует верхнеуровневые спаны на таймлайн.
   * Группы = lanes, Задачи = только root-spans (parentSpanId отсутствует).
   */
  function applyCurrentJournal(): void {
    const records: LogRecord[] = Endge.debug.toPlain()
    console.log(records)

    // 2) Соберём пары start/end по spanId
    const spanStarts = new Map<string, SpanStart>()
    const spanEnds = new Map<string, SpanEnd>()
    for (const r of records) {
      if (r.kind === 'span_start' && r.corr?.spanId) {
        spanStarts.set(r.corr.spanId, r as SpanStart)
      } else if (r.kind === 'span_end' && r.corr?.spanId) {
        spanEnds.set(r.corr.spanId, r as SpanEnd)
      }
    }

    // 3) Берём только верхнеуровневые спаны (без parentSpanId)
    const rootSpans: Array<{ start: SpanStart; end?: SpanEnd }> = []
    for (const [spanId, start] of spanStarts) {
      if (!start.corr?.parentSpanId) {
        const end = spanEnds.get(spanId)
        rootSpans.push({ start, end })
      }
    }

    // 4) Строим группы по lane (только у тех, у кого lane задан)
    const laneIds = Array.from(
      new Set(rootSpans.map((s) => s.start.lane).filter(Boolean) as string[]),
    )
    const groups: TimelineDebugGroup[] = laneIds.map((lane) => ({
      id: lane,
      displayName: lane,
    }))

    // 5) Строим задачи (range) по спанам
    const tasks: TimelineDebugTask[] = []
    let minTs = Number.POSITIVE_INFINITY
    let maxTs = Number.NEGATIVE_INFINITY

    for (const { start, end } of rootSpans) {
      const lane = start.lane || 'default'
      const t0 = start.ts
      const t1 = end?.ts ?? ((start.ts + (start as any).durMs ?? 0) || start.ts)

      let endTime = t1 >= t0 ? t1 : t0 + 1 // минимальная длина
      const id = start.corr?.spanId || `${lane}:${start.name}:${t0}`

      if (t1 === t0) {
        endTime = t1 + 5
      }

      tasks.push({
        id,
        type: 'range',
        displayName: start.name,
        groupId: lane,
        startTime: t0,
        endTime,
        editable: false,
      })

      if (t0 < minTs) minTs = t0
      if (endTime > maxTs) maxTs = endTime
    }

    if (!isFinite(minTs) || !isFinite(maxTs)) {
      // нет задач -  просто очистим и выходим
      timeline.data({ groups: [], tasks: [] })
      return
    }

    // 6) Настроим окно времени под данные
    const pad = 50 // мс
    const tsMin = Math.max(0, minTs - pad)
    const tsMax = maxTs + pad

    timeline.options({
      tsMinTime: tsMin,
      tsMaxTime: tsMax,
      tsStartTime: tsMin,
      tsEndTime: tsMax,
    })

    // 7) Применяем данные
    timeline.data({ groups, tasks })
  }

  function addTimeNow(): void {
    // Не забываем в продакшене очистить таймер
    offIntervals.push(
      setInterval(() => {
        timeline.clearCustom('now') // УДАЛИМ СТАРЫЙ!
        timeline.addCustomTime('now', () => ({
          time: new Date().getTime(),
          color: 'red',
          width: 1,
          // cover: {
          //   position: 'left',
          //   background: 'rgba(255,255,255,0.05)',
          // },
        }))
      }, 1000),
    )
  }

  function applyTemplates(): void {
    const templates = TimelineChartTemplatesDebug

    timeline.ui.task(templates.task)
    timeline.ui.cluster(templates.cluster)
    timeline.ui.groupColumn(templates.groupColumn)
    timeline.ui.groupColumnHeader(templates.groupColumnHeader)
    timeline.ui.tooltip(templates.tooltip)
  }

  return {
    timeline,
    details,
    init,
    destroy,
    applyCurrentJournal,
  }
})
