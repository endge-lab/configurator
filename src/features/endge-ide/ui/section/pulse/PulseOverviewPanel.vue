<script setup lang="ts">
import { pulsePhaseLoad, pulseSummary, pulseTimeline } from '@/features/endge-ide/model/pulse/pulse.mock.ts'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function toLinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0)
    return ''
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? width / (values.length - 1) : width
  return values
    .map((value, index) => {
      const x = index * stepX
      const y = height - (value / max) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}
</script>

<template>
  <div class="space-y-4 p-4">
    <div class="rounded-xl border bg-background p-4">
      <h2 class="text-base font-semibold">Обзор runtime-картины</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        Панель показывает live-снимок `RuntimeHostRegistry`: активные runtime-host, связанные ресурсы,
        каналы и агрегированную телеметрию по текущему состоянию runtime.
      </p>
    </div>

    <TooltipProvider>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="rounded-xl border bg-muted/20 p-4">
              <div class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Host</div>
              <div class="mt-1 text-2xl font-semibold">{{ pulseSummary.hosts }}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Количество runtime-host сущностей в текущем snapshot.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <div class="rounded-xl border bg-muted/20 p-4">
              <div class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Активные</div>
              <div class="mt-1 text-2xl font-semibold">{{ pulseSummary.active }}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Количество runtime-host в статусе active (сейчас выполняются/слушают события).
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <div class="rounded-xl border bg-muted/20 p-4">
              <div class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Raph nodes</div>
              <div class="mt-1 text-2xl font-semibold">{{ pulseSummary.raphNodes }}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Суммарное число `RaphNode`, прикреплённых к runtime-host.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <div class="rounded-xl border bg-muted/20 p-4">
              <div class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Subscriptions</div>
              <div class="mt-1 text-2xl font-semibold">{{ pulseSummary.subscriptions }}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Количество event-bus и внешних runtime-каналов.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-xl border bg-background p-4">
        <h3 class="text-sm font-semibold">Что показывает этот mock</h3>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>registry хранит все живые runtime-host в едином индексе;</li>
          <li>каждый host может иметь ресурсы (`RaphNode`, scope, metadata);</li>
          <li>каналы отражают подписки и публикации (event-bus/external);</li>
          <li>карточки сверху показывают актуальные aggregate-метрики в моменте.</li>
        </ul>
      </section>

      <section class="rounded-xl border bg-background p-4">
        <h3 class="text-sm font-semibold">Как читать слои</h3>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>`Raph` отвечает за data-driven сигналы и dirty propagation;</li>
          <li>runtime channels описывают взаимодействие host с event bus и внешними источниками;</li>
          <li>`Pulse` собирает всё это как единый runtime snapshot;</li>
          <li>правый sidebar показывает краткую tree-view картину host и их внутренностей.</li>
        </ul>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-xl border bg-background p-4">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Нагрузка по фазам Raph</h3>
          <span class="text-xs text-muted-foreground">runtime distribution</span>
        </div>
        <p class="mb-4 text-xs text-muted-foreground">
          Процентное распределение активных runtime-host по типам исполнения.
        </p>
        <div class="grid gap-2">
          <div
            v-for="item in pulsePhaseLoad"
            :key="item.phase"
            class="rounded-lg border bg-muted/20 px-3 py-2"
          >
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium">{{ item.phase }}</span>
              <span class="text-muted-foreground">{{ item.load }}%</span>
            </div>
            <div class="h-2 rounded-full bg-muted">
              <div
                class="h-2 rounded-full bg-sky-500"
                :style="{ width: `${item.load}%` }"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="rounded-xl border bg-background p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold">Телеметрия во времени (60 сек)</h3>
        <span class="text-xs text-muted-foreground">NPS / Bus EPS</span>
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        Широкая диаграмма динамики нагрузки. В production здесь обычно показывается скользящее окно по ring-buffer.
      </p>

      <div class="overflow-x-auto rounded-lg border bg-muted/10 p-3">
        <svg viewBox="0 0 720 220" class="h-[220px] w-full min-w-[720px]">
          <g>
            <line x1="0" y1="200" x2="720" y2="200" stroke="rgba(148,163,184,0.5)" stroke-width="1" />
            <line x1="0" y1="150" x2="720" y2="150" stroke="rgba(148,163,184,0.24)" stroke-width="1" />
            <line x1="0" y1="100" x2="720" y2="100" stroke="rgba(148,163,184,0.24)" stroke-width="1" />
            <line x1="0" y1="50" x2="720" y2="50" stroke="rgba(148,163,184,0.24)" stroke-width="1" />
          </g>

          <polyline
            :points="toLinePoints(pulseTimeline.raphNps, 720, 200)"
            fill="none"
            stroke="#0ea5e9"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            :points="toLinePoints(pulseTimeline.busEps, 720, 200)"
            fill="none"
            stroke="#f97316"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-2"><span class="size-2 rounded-full bg-sky-500" />Raph NPS</span>
        <span class="inline-flex items-center gap-2"><span class="size-2 rounded-full bg-orange-500" />Bus EPS</span>
      </div>
    </section>
  </div>
</template>
