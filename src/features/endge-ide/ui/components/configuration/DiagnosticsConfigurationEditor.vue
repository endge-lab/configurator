<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  DiagnosticsPhase,
  DiagnosticsSeverityNumber,
  DiagnosticsSignal,
  EndgeDiagnosticsConfiguration,
  EndgeDiagnosticsOutputConfiguration,
  EndgeDiagnosticsRoute,
} from '@endge/core'
import type { WritableComputedRef } from 'vue'

import { Endge } from '@endge/core'
import { CircleHelp, Download, Plus, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type DiagnosticsSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
type DiagnosticsRoutePhase = 'any' | DiagnosticsPhase

const props = defineProps<{
  variant: 'root' | 'contribution'
  modelValue: EndgeDiagnosticsConfiguration
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EndgeDiagnosticsConfiguration]
}>()

const SEVERITY_NUMBER: Record<DiagnosticsSeverity, DiagnosticsSeverityNumber> = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
}
const SEVERITY_TEXT = Object.fromEntries(
  Object.entries(SEVERITY_NUMBER).map(([text, number]) => [number, text]),
) as Record<DiagnosticsSeverityNumber, DiagnosticsSeverity>

const severityOptions: DiagnosticsSeverity[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
const draft = ref(clone(props.modelValue))
const feedback = ref('Изменения сохраняются в документе')
const diagnosticsRevision = ref(0)
let unsubscribeDiagnostics: (() => void) | null = null
let syncingFromParent = false

const outputs = computed(() => draft.value.telemetry.outputs)
const routes = computed(() => draft.value.telemetry.routes)
const diagnosticsEnabled = computed({
  get: () => draft.value.telemetry.collection.enabled,
  set: (value) => { draft.value.telemetry.collection.enabled = value },
})
const collectLogs = createSignalModel('log')
const collectSpans = createSignalModel('span')
const minSeverity = computed<DiagnosticsSeverity>({
  get: () => SEVERITY_TEXT[draft.value.telemetry.collection.minSeverity],
  set: (value) => { draft.value.telemetry.collection.minSeverity = SEVERITY_NUMBER[value] },
})
const maxRecords = computed({
  get: () => draft.value.telemetry.collection.maxRecords,
  set: (value) => { draft.value.telemetry.collection.maxRecords = Math.max(1, Number(value) || 1) },
})
const includeTelemetry = createSnapshotContentModel('telemetry')
const includeProblems = createSnapshotContentModel('problems')
const includeConfiguration = createSnapshotContentModel('configuration')
const automaticSnapshotEnabled = computed({
  get: () => draft.value.snapshots.automatic.enabled,
  set: (value) => { draft.value.snapshots.automatic.enabled = value },
})
const snapshotErrorCount = createAutomaticNumberModel('errorCount', 1)
const snapshotWindowSeconds = createAutomaticNumberModel('windowSeconds', 1)
const snapshotCooldownMinutes = computed({
  get: () => draft.value.snapshots.automatic.cooldownSeconds / 60,
  set: (value) => { draft.value.snapshots.automatic.cooldownSeconds = Math.max(0, Number(value) || 0) * 60 },
})
const snapshotOutputId = computed({
  get: () => draft.value.snapshots.automatic.outputIds[0] ?? '',
  set: (value) => { draft.value.snapshots.automatic.outputIds = value ? [value] : [] },
})
const storedRecords = computed(() => {
  void diagnosticsRevision.value
  return Endge.diagnostics.getCounters().totalRecords
})
const historyUsage = computed(() => Math.min(100, Math.round(storedRecords.value / Math.max(maxRecords.value, 1) * 100)))

onMounted(() => {
  unsubscribeDiagnostics = Endge.diagnostics.subscribe(() => {
    diagnosticsRevision.value += 1
  })
})

onUnmounted(() => unsubscribeDiagnostics?.())

watch(
  () => props.modelValue,
  (value) => {
    syncingFromParent = true
    draft.value = clone(value)
    void nextTick(() => {
      syncingFromParent = false
    })
  },
  { deep: true },
)

watch(
  draft,
  (value) => {
    if (!syncingFromParent) {
      emit('update:modelValue', clone(value))
    }
  },
  { deep: true },
)

/** Клонирует JSON-safe configuration без передачи mutable ссылок родителю. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Создаёт writable model включения одного telemetry signal. */
function createSignalModel(signal: DiagnosticsSignal): WritableComputedRef<boolean> {
  return computed({
    get: () => draft.value.telemetry.collection.signals.includes(signal),
    set: (enabled: boolean) => {
      const signals = draft.value.telemetry.collection.signals.filter(item => item !== signal)
      draft.value.telemetry.collection.signals = enabled ? [...signals, signal] : signals
    },
  })
}

/** Создаёт writable model одного флага состава snapshot. */
function createSnapshotContentModel(
  key: keyof EndgeDiagnosticsConfiguration['snapshots']['content'],
): WritableComputedRef<boolean> {
  return computed({
    get: () => draft.value.snapshots.content[key],
    set: (value: boolean) => { draft.value.snapshots.content[key] = value },
  })
}

/** Создаёт нормализованную numeric model автоматической snapshot policy. */
function createAutomaticNumberModel(
  key: 'errorCount' | 'windowSeconds',
  minimum: number,
): WritableComputedRef<number> {
  return computed({
    get: () => draft.value.snapshots.automatic[key],
    set: (value: number) => { draft.value.snapshots.automatic[key] = Math.max(minimum, Number(value) || minimum) },
  })
}

/** Возвращает первый свободный нумерованный id указанного типа. */
function nextId(prefix: string, values: readonly { id: string }[]): string {
  let index = 1
  while (values.some(value => value.id === `${prefix}-${index}`)) {
    index += 1
  }
  return `${prefix}-${index}`
}

/** Добавляет console output в редактируемую EndgeConfiguration. */
function addOutput(): void {
  const id = nextId('output', outputs.value)
  const sequence = Number(id.split('-').at(-1)) || outputs.value.length + 1
  outputs.value.push({
    id,
    name: `Канал вывода ${sequence}`,
    enabled: true,
    adapterType: 'console',
    options: {
      format: 'pretty',
      groupByTrace: false,
      includeTimestamp: true,
      includeScope: true,
      includeAttributes: false,
    },
  })
  feedback.value = `Добавлен ${id}`
}

/** Удаляет output и переводит связанные routes на первый доступный канал. */
function removeOutput(outputId: string): void {
  draft.value.telemetry.outputs = outputs.value.filter(output => output.id !== outputId)
  const fallback = outputs.value[0]?.id ?? ''
  for (const route of routes.value) {
    if (route.outputId === outputId) {
      route.outputId = fallback
    }
  }
  if (snapshotOutputId.value === outputId) {
    snapshotOutputId.value = fallback
  }
  feedback.value = 'Канал удалён'
}

/** Добавляет локальное правило доставки с безопасными начальными значениями. */
function addRoute(): void {
  const id = nextId('diagnostics-route', routes.value)
  routes.value.push({
    id,
    name: `Новое правило ${routes.value.length + 1}`,
    enabled: true,
    match: { signals: ['log'], minSeverity: 17, phases: ['runtime'] },
    outputId: outputs.value[0]?.id ?? '',
  })
  feedback.value = 'Правило добавлено'
}

/** Удаляет правило маршрутизации из редактируемой configuration. */
function removeRoute(routeId: string): void {
  draft.value.telemetry.routes = routes.value.filter(route => route.id !== routeId)
  feedback.value = 'Правило удалено'
}

/** Проверяет active runtime adapter выбранного output. */
async function testOutput(output: EndgeDiagnosticsOutputConfiguration): Promise<void> {
  const succeeded = await Endge.diagnostics.testOutput(output.id)
  feedback.value = succeeded
    ? `Канал «${output.name}» доступен`
    : 'Канал станет доступен после применения configuration'
}

/** Создаёт core snapshot и скачивает его средствами browser UI. */
function prepareSnapshot(): void {
  const snapshot = Endge.diagnostics.snapshot({
    includeTelemetry: includeTelemetry.value,
    includeProblems: includeProblems.value,
    includeConfiguration: includeConfiguration.value,
  })
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `endge-diagnostics-${snapshot.generatedAt}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  feedback.value = 'Диагностический снимок скачан'
}

/** Читает JSON-safe option выбранного output. */
function outputOption(output: EndgeDiagnosticsOutputConfiguration, key: string): unknown {
  return output.options[key]
}

/** Обновляет JSON-safe option выбранного output. */
function setOutputOption(output: EndgeDiagnosticsOutputConfiguration, key: string, value: string | boolean): void {
  output.options[key] = value
}

/** Возвращает единственный signal, редактируемый упрощённой формой route. */
function routeSignal(route: EndgeDiagnosticsRoute): DiagnosticsSignal {
  return route.match.signals?.[0] ?? 'log'
}

/** Применяет выбранный signal к route filter. */
function setRouteSignal(route: EndgeDiagnosticsRoute, value: unknown): void {
  route.match.signals = [value === 'span' ? 'span' : 'log']
}

/** Возвращает текстовое представление минимального severity route. */
function routeSeverity(route: EndgeDiagnosticsRoute): DiagnosticsSeverity {
  return SEVERITY_TEXT[route.match.minSeverity ?? 1]
}

/** Применяет выбранный OpenTelemetry severity number к route. */
function setRouteSeverity(route: EndgeDiagnosticsRoute, value: unknown): void {
  route.match.minSeverity = SEVERITY_NUMBER[String(value) as DiagnosticsSeverity] ?? 1
}

/** Возвращает одну phase или значение any для формы. */
function routePhase(route: EndgeDiagnosticsRoute): DiagnosticsRoutePhase {
  return route.match.phases?.[0] ?? 'any'
}

/** Применяет optional phase filter к route. */
function setRoutePhase(route: EndgeDiagnosticsRoute, value: unknown): void {
  route.match.phases = value === 'authoring' || value === 'build' || value === 'runtime' ? [value] : undefined
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <Tabs default-value="collection" class="min-h-full">
      <header class="border-b bg-background px-6 pt-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-semibold">
                Диагностика
              </h2>
              <span v-if="variant === 'contribution'" class="text-[10px] text-muted-foreground">
                Настройки текущего слоя
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              Настройка телеметрии, каналов вывода и диагностических снимков.
            </p>
          </div>
          <span class="pt-1 text-[10px] text-muted-foreground">{{ feedback }}</span>
        </div>

        <TabsList class="mt-5 flex h-auto w-full justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0">
          <TabsTrigger value="collection" class="diagnostics-tab">
            Сбор и история
          </TabsTrigger>
          <TabsTrigger value="outputs" class="diagnostics-tab">
            Каналы вывода
            <span class="ml-1 text-[10px] text-muted-foreground">{{ outputs.length }}</span>
          </TabsTrigger>
          <TabsTrigger value="routing" class="diagnostics-tab">
            Маршрутизация
            <span class="ml-1 text-[10px] text-muted-foreground">{{ routes.length }}</span>
          </TabsTrigger>
          <TabsTrigger value="snapshots" class="diagnostics-tab">
            Снимки
          </TabsTrigger>
        </TabsList>
      </header>

      <div class="w-full p-6">
        <TabsContent value="collection" class="m-0 outline-none">
          <section class="settings-section">
            <div class="settings-row items-center">
              <div>
                <Label class="text-sm font-medium">Собирать телеметрию</Label>
                <p class="settings-hint">
                  Логи и операции будут сохраняться в локальной истории.
                </p>
              </div>
              <Switch v-model:checked="diagnosticsEnabled" :disabled="disabled" aria-label="Включить сбор телеметрии" />
            </div>

            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">Собираемые сигналы</Label>
              </div>
              <div class="space-y-3">
                <div class="flex min-h-7 items-center gap-2.5">
                  <label class="flex items-center gap-2.5 text-sm">
                    <Checkbox v-model:checked="collectLogs" :disabled="disabled || !diagnosticsEnabled" />
                    Логи
                  </label>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" size="icon" variant="ghost" class="size-6 text-muted-foreground" aria-label="Что такое логи">
                        <CircleHelp class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" class="max-w-72 text-xs leading-5">
                      Отдельные события в конкретный момент: ошибки, предупреждения и сообщения runtime. Помогают понять, что произошло.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div class="flex min-h-7 items-center gap-2.5">
                  <label class="flex items-center gap-2.5 text-sm">
                    <Checkbox v-model:checked="collectSpans" :disabled="disabled || !diagnosticsEnabled" />
                    Операции
                  </label>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" size="icon" variant="ghost" class="size-6 text-muted-foreground" aria-label="Что такое операции">
                        <CircleHelp class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" class="max-w-72 text-xs leading-5">
                      Процессы с началом, завершением и длительностью: компиляция, запросы и runtime-выполнение. Помогают оценить время и результат операции.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <Label for="diagnostics-min-severity" class="text-sm font-medium">Минимальный уровень</Label>
                <p class="settings-hint">
                  Записи ниже уровня не сохраняются.
                </p>
              </div>
              <Select v-model="minSeverity" :disabled="disabled || !diagnosticsEnabled">
                <SelectTrigger id="diagnostics-min-severity" class="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="severity in severityOptions" :key="severity" :value="severity">
                    {{ severity }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="settings-row">
              <div>
                <Label for="diagnostics-max-records" class="text-sm font-medium">История</Label>
                <p class="settings-hint">
                  Старые записи удаляются при достижении лимита.
                </p>
              </div>
              <div class="w-64">
                <Input id="diagnostics-max-records" v-model.number="maxRecords" type="number" min="1" step="100" :disabled="disabled || !diagnosticsEnabled" />
                <div class="mt-2 flex items-center gap-3">
                  <div class="h-1 flex-1 overflow-hidden rounded bg-muted">
                    <div class="h-full bg-foreground/40" :style="{ width: `${historyUsage}%` }" />
                  </div>
                  <span class="text-[10px] tabular-nums text-muted-foreground">{{ storedRecords }} / {{ maxRecords }}</span>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="outputs" class="m-0 outline-none">
          <div class="section-heading">
            <div>
              <h3 class="text-sm font-semibold">
                Каналы вывода
              </h3>
              <p class="settings-hint">
                Куда отправлять выбранные записи.
              </p>
            </div>
            <Button size="sm" variant="outline" :disabled="disabled" @click="addOutput">
              <Plus class="mr-1.5 size-3.5" /> Добавить
            </Button>
          </div>

          <div v-if="outputs.length" class="mt-5 space-y-3">
            <article v-for="output in outputs" :key="output.id" class="rounded-md border bg-background">
              <div class="flex items-center gap-3 border-b px-4 py-3">
                <Switch v-model:checked="output.enabled" :disabled="disabled" :aria-label="`Включить ${output.name}`" />
                <Input v-model="output.name" class="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 font-medium shadow-none" :disabled="disabled" />
                <span class="hidden font-mono text-[10px] text-muted-foreground sm:inline">{{ output.adapterType }}</span>
                <Button size="sm" variant="ghost" :disabled="disabled || !output.enabled" @click="testOutput(output)">
                  Проверить
                </Button>
                <Button size="icon" variant="ghost" class="size-8 text-muted-foreground" :disabled="disabled" :aria-label="`Удалить ${output.name}`" @click="removeOutput(output.id)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>

              <div class="grid gap-5 p-4 md:grid-cols-[12rem_1fr]">
                <div>
                  <Label class="text-xs">Формат</Label>
                  <Select :model-value="String(outputOption(output, 'format') ?? 'pretty')" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'format', String($event))">
                    <SelectTrigger class="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pretty">
                        Pretty console
                      </SelectItem>
                      <SelectItem value="json">
                        JSON
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="text-xs">Поля записи</Label>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <label class="flex items-center gap-2 text-xs"><Checkbox :checked="outputOption(output, 'includeTimestamp') !== false" :disabled="disabled || !output.enabled" @update:checked="setOutputOption(output, 'includeTimestamp', $event === true)" />Время</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :checked="outputOption(output, 'includeScope') !== false" :disabled="disabled || !output.enabled" @update:checked="setOutputOption(output, 'includeScope', $event === true)" />Scope</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :checked="outputOption(output, 'includeAttributes') !== false" :disabled="disabled || !output.enabled" @update:checked="setOutputOption(output, 'includeAttributes', $event === true)" />Attributes</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :checked="outputOption(output, 'groupByTrace') === true" :disabled="disabled || !output.enabled" @update:checked="setOutputOption(output, 'groupByTrace', $event === true)" />Группировать по trace</label>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            Каналы вывода не настроены.
          </div>
        </TabsContent>

        <TabsContent value="routing" class="m-0 outline-none">
          <div class="section-heading">
            <div>
              <h3 class="text-sm font-semibold">
                Правила маршрутизации
              </h3>
              <p class="settings-hint">
                Какие записи отправлять в каждый канал.
              </p>
            </div>
            <Button size="sm" variant="outline" :disabled="disabled || !outputs.length" @click="addRoute">
              <Plus class="mr-1.5 size-3.5" /> Добавить
            </Button>
          </div>

          <div v-if="routes.length" class="mt-5 overflow-hidden rounded-md border">
            <article v-for="routeItem in routes" :key="routeItem.id" class="border-b p-4 last:border-b-0">
              <div class="flex items-center gap-3">
                <Switch v-model:checked="routeItem.enabled" :disabled="disabled" :aria-label="`Включить ${routeItem.name}`" />
                <Input v-model="routeItem.name" class="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 font-medium shadow-none" :disabled="disabled" />
                <Button size="icon" variant="ghost" class="size-8 text-muted-foreground" :disabled="disabled" :aria-label="`Удалить ${routeItem.name}`" @click="removeRoute(routeItem.id)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>

              <div class="mt-4 grid gap-3 pl-11 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label class="field-label">Тип</Label>
                  <Select :model-value="routeSignal(routeItem)" :disabled="disabled || !routeItem.enabled" @update:model-value="setRouteSignal(routeItem, $event)">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="log">
                        Log
                      </SelectItem>
                      <SelectItem value="span">
                        Span
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="field-label">Уровень</Label>
                  <Select :model-value="routeSeverity(routeItem)" :disabled="disabled || !routeItem.enabled || routeSignal(routeItem) === 'span'" @update:model-value="setRouteSeverity(routeItem, $event)">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="severity in severityOptions" :key="severity" :value="severity">
                        {{ severity }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="field-label">Фаза</Label>
                  <Select :model-value="routePhase(routeItem)" :disabled="disabled || !routeItem.enabled" @update:model-value="setRoutePhase(routeItem, $event)">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">
                        Любая
                      </SelectItem>
                      <SelectItem value="authoring">
                        Authoring
                      </SelectItem>
                      <SelectItem value="build">
                        Build
                      </SelectItem>
                      <SelectItem value="runtime">
                        Runtime
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="field-label">Канал</Label>
                  <Select v-model="routeItem.outputId" :disabled="disabled || !routeItem.enabled || !outputs.length">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue placeholder="Канал" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="output in outputs" :key="output.id" :value="output.id">
                        {{ output.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            Правила не настроены.
          </div>
        </TabsContent>

        <TabsContent value="snapshots" class="m-0 outline-none">
          <section class="settings-section">
            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">Ручной снимок</Label>
                <p class="settings-hint">
                  JSON-файл для анализа и поддержки.
                </p>
              </div>
              <div class="space-y-3">
                <label class="flex items-center gap-2.5 text-sm"><Checkbox v-model:checked="includeTelemetry" :disabled="disabled" />Телеметрия</label>
                <label class="flex items-center gap-2.5 text-sm"><Checkbox v-model:checked="includeProblems" :disabled="disabled" />Проблемы</label>
                <label class="flex items-center gap-2.5 text-sm"><Checkbox v-model:checked="includeConfiguration" :disabled="disabled" />Effective configuration</label>
                <Button size="sm" variant="outline" :disabled="disabled" @click="prepareSnapshot">
                  <Download class="mr-1.5 size-3.5" /> Скачать JSON
                </Button>
              </div>
            </div>

            <div class="settings-row items-center">
              <div>
                <Label class="text-sm font-medium">Автоматические снимки</Label>
                <p class="settings-hint">
                  Создавать снимок при серии runtime errors.
                </p>
              </div>
              <Switch v-model:checked="automaticSnapshotEnabled" :disabled="disabled || !outputs.length" aria-label="Включить автоматические снимки" />
            </div>

            <div v-if="automaticSnapshotEnabled" class="settings-row">
              <div>
                <Label class="text-sm font-medium">Условие</Label>
              </div>
              <div class="grid max-w-xl gap-4 sm:grid-cols-2">
                <div><Label class="field-label">Количество ошибок</Label><Input v-model.number="snapshotErrorCount" type="number" min="1" class="mt-1.5" :disabled="disabled" /></div>
                <div><Label class="field-label">За период, сек.</Label><Input v-model.number="snapshotWindowSeconds" type="number" min="1" class="mt-1.5" :disabled="disabled" /></div>
                <div><Label class="field-label">Пауза после снимка, мин.</Label><Input v-model.number="snapshotCooldownMinutes" type="number" min="0" class="mt-1.5" :disabled="disabled" /></div>
                <div>
                  <Label class="field-label">Канал</Label>
                  <Select v-model="snapshotOutputId" :disabled="disabled">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue placeholder="Канал" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="output in outputs" :key="output.id" :value="output.id">
                        {{ output.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>
      </div>
    </Tabs>
  </TooltipProvider>
</template>

<style scoped>
.diagnostics-tab {
  height: 2.25rem;
  padding: 0 0 0.625rem;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 400;
  box-shadow: none;
}

.diagnostics-tab[data-state='active'] {
  border-bottom-color: var(--foreground);
  background: transparent;
  color: var(--foreground);
  font-weight: 500;
  box-shadow: none;
}

.settings-section {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--background);
}

.settings-row {
  display: grid;
  gap: 1.25rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.settings-row:last-child {
  border-bottom: 0;
}

.settings-hint {
  margin-top: 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.25rem;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.field-label {
  color: var(--muted-foreground);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.empty-state {
  margin-top: 1.25rem;
  padding: 2.5rem 1.25rem;
  border: 1px dashed var(--border);
  border-radius: calc(var(--radius) - 2px);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  text-align: center;
}

@media (min-width: 768px) {
  .settings-row {
    grid-template-columns: 15rem minmax(0, 1fr);
  }
}
</style>
