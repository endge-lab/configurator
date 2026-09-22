<script setup lang="ts">
import type {
  ComponentSFCInteractionTriggerActivation,
  DiagnosticsPhase,
  DiagnosticsSeverityNumber,
  DiagnosticsSignal,
  EndgeDiagnosticsConfiguration,
  EndgeDiagnosticsOutputConfiguration,
  EndgeDiagnosticsRoute,
  EndgeDiagnosticsSnapshotContentConfiguration,
} from '@endge/core'
import type { WritableComputedRef } from 'vue'

import { Endge } from '@endge/core'
import { CircleHelp, Download, Plus, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import DiagnosticsSnapshotContentEditor from '@/features/endge-ide/ui/components/configuration/DiagnosticsSnapshotContentEditor.vue'
import SFCInteractionTriggerActivationEditor from '@/features/endge-ide/ui/components/configuration/SFCInteractionTriggerActivationEditor.vue'

type DiagnosticsSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
type DiagnosticsRoutePhase = 'any' | DiagnosticsPhase
type DiagnosticsAdapterType = 'console' | 'sentry'
type DiagnosticsSection
  = | 'collection'
    | 'history'
    | 'outputs'
    | 'routing'
    | 'manual-snapshot'
    | 'hotkey-snapshot'
    | 'automatic-snapshots'

const props = defineProps<{
  variant: 'root' | 'contribution'
  modelValue: EndgeDiagnosticsConfiguration
  section: DiagnosticsSection
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EndgeDiagnosticsConfiguration]
}>()
const { t } = useI18n()

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
const manualSnapshotContent = computed({
  get: () => draft.value.snapshots.content,
  set: (value: EndgeDiagnosticsSnapshotContentConfiguration) => { draft.value.snapshots.content = clone(value) },
})
const shortcutSnapshotActivation = computed({
  get: () => draft.value.snapshots.shortcut.triggerSet,
  set: (value: ComponentSFCInteractionTriggerActivation) => { draft.value.snapshots.shortcut.triggerSet = clone(value) },
})
const shortcutSnapshotContent = computed({
  get: () => draft.value.snapshots.shortcut.content,
  set: (value: EndgeDiagnosticsSnapshotContentConfiguration) => { draft.value.snapshots.shortcut.content = clone(value) },
})
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
const sectionTitle = computed(() => ({
  'collection': t('diagnostics.configuration.sections.collection.title'),
  'history': t('diagnostics.configuration.sections.history.title'),
  'outputs': t('diagnostics.configuration.sections.outputs.title'),
  'routing': t('diagnostics.configuration.sections.routing.title'),
  'manual-snapshot': t('diagnostics.configuration.sections.manualSnapshot.title'),
  'hotkey-snapshot': t('diagnostics.configuration.sections.hotkeySnapshot.title'),
  'automatic-snapshots': t('diagnostics.configuration.sections.automaticSnapshots.title'),
})[props.section])
const sectionDescription = computed(() => ({
  'collection': t('diagnostics.configuration.sections.collection.description'),
  'history': t('diagnostics.configuration.sections.history.description'),
  'outputs': t('diagnostics.configuration.sections.outputs.description'),
  'routing': t('diagnostics.configuration.sections.routing.description'),
  'manual-snapshot': t('diagnostics.configuration.sections.manualSnapshot.description'),
  'hotkey-snapshot': t('diagnostics.configuration.sections.hotkeySnapshot.description'),
  'automatic-snapshots': t('diagnostics.configuration.sections.automaticSnapshots.description'),
})[props.section])

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

/** Переключает тип output и применяет минимальные options выбранного adapter. */
function setOutputAdapterType(output: EndgeDiagnosticsOutputConfiguration, value: unknown): void {
  const adapterType: DiagnosticsAdapterType = value === 'sentry' ? 'sentry' : 'console'
  output.adapterType = adapterType
  output.options = adapterType === 'sentry'
    ? {
        dsn: '{{ SENTRY_DSN }}',
        environment: '{{ SENTRY_ENVIRONMENT }}',
        release: '{{ SENTRY_RELEASE }}',
        sendSnapshots: true,
        requestTimeoutMs: 10_000,
      }
    : {
        format: 'pretty',
        groupByTrace: false,
        includeTimestamp: true,
        includeScope: true,
        includeAttributes: false,
      }
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

/** Создаёт snapshot текущего Core и скачивает его через общий diagnostics owner. */
function prepareSnapshot(): void {
  Endge.diagnostics.downloadSnapshot(snapshotOptions(manualSnapshotContent.value))
  feedback.value = 'Диагностический снимок скачан'
}

/** Переводит редактируемый content policy в options ручного snapshot. */
function snapshotOptions(content: EndgeDiagnosticsSnapshotContentConfiguration) {
  return {
    includeTelemetry: content.telemetry,
    includeProblems: content.problems,
    includeConfiguration: content.configuration,
    includeEffectiveConfiguration: content.effectiveConfiguration,
    includeDomain: content.domain,
    includeProgram: content.program,
    includeRuntime: content.runtime,
    includeRaphData: content.raphData,
    includeRaphGraph: content.raphGraph,
  }
}

/** Читает JSON-safe option выбранного output. */
function outputOption(output: EndgeDiagnosticsOutputConfiguration, key: string): unknown {
  return output.options[key]
}

/** Обновляет JSON-safe option выбранного output. */
function setOutputOption(output: EndgeDiagnosticsOutputConfiguration, key: string, value: string | number | boolean): void {
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
    <div class="min-h-full">
      <header class="border-b bg-background px-6 py-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-semibold">
                {{ sectionTitle }}
              </h2>
              <span v-if="variant === 'contribution'" class="text-[10px] text-muted-foreground">
                {{ $t('uiText.currentLayerSettings30972ea5') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ sectionDescription }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] text-muted-foreground">{{ feedback }}</span>
            <Button v-if="section === 'outputs'" size="sm" variant="outline" :disabled="disabled" @click="addOutput">
              <Plus class="mr-1.5 size-3.5" /> {{ $t('uiText.add559a87f7') }}
            </Button>
            <Button v-else-if="section === 'routing'" size="sm" variant="outline" :disabled="disabled || !outputs.length" @click="addRoute">
              <Plus class="mr-1.5 size-3.5" /> {{ $t('uiText.add559a87f7') }}
            </Button>
          </div>
        </div>
      </header>

      <div class="w-full p-6">
        <div v-if="section === 'collection'">
          <section class="settings-section">
            <div class="settings-row items-center">
              <div>
                <Label class="text-sm font-medium">{{ $t('uiText.collectTelemetry48f6524c') }}</Label>
                <p class="settings-hint">
                  {{ $t('uiText.logsAndOperationsWillBeSavedInLocalHistory401d8f4b') }}
                </p>
              </div>
              <Switch v-model:checked="diagnosticsEnabled" :disabled="disabled" aria-label="Включить сбор телеметрии" />
            </div>

            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">{{ $t('uiText.collectedSignals46995dbd') }}</Label>
              </div>
              <div class="space-y-3">
                <div class="flex min-h-7 items-center gap-2.5">
                  <label class="flex items-center gap-2.5 text-sm">
                    <Checkbox v-model="collectLogs" :disabled="disabled || !diagnosticsEnabled" />
                    {{ $t('uiText.logs853d620e') }}
                  </label>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" size="icon" variant="ghost" class="size-6 text-muted-foreground" aria-label="Что такое логи">
                        <CircleHelp class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" class="max-w-72 text-xs leading-5">
                      {{ $t('uiText.individualEventsAtSpecificMomentsErrorsWarningsAndRu2801673a') }}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div class="flex min-h-7 items-center gap-2.5">
                  <label class="flex items-center gap-2.5 text-sm">
                    <Checkbox v-model="collectSpans" :disabled="disabled || !diagnosticsEnabled" />
                    {{ $t('uiText.operationsaa0afc4b') }}
                  </label>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" size="icon" variant="ghost" class="size-6 text-muted-foreground" aria-label="Что такое операции">
                        <CircleHelp class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" class="max-w-72 text-xs leading-5">
                      {{ $t('uiText.processesWithStartEndAndDurationCompilationQueriesAnc504b9e0') }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <Label for="diagnostics-min-severity" class="text-sm font-medium">{{ $t('uiText.minimumLevel3e7a1ad6') }}</Label>
                <p class="settings-hint">
                  {{ $t('uiText.recordsBelowThisLevelAreNotSaved18ef956c') }}
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
          </section>
        </div>

        <div v-else-if="section === 'history'">
          <section class="settings-section">
            <div class="settings-row">
              <div>
                <Label for="diagnostics-max-records" class="text-sm font-medium">{{ $t('diagnostics.configuration.history.recordLimit') }}</Label>
                <p class="settings-hint">
                  {{ $t('uiText.oldRecordsAreDeletedWhenTheLimitIsReached7f977438') }}
                </p>
              </div>
              <div class="w-64">
                <Input id="diagnostics-max-records" v-model.number="maxRecords" type="number" min="1" step="100" :disabled="disabled || !diagnosticsEnabled" />
                <div class="mt-2 flex items-center gap-3">
                  <div class="h-1 flex-1 overflow-hidden rounded bg-muted">
                    <div class="h-full bg-foreground/40" :style="{ width: `${historyUsage}%` }" />
                  </div>
                  <span class="text-[10px] tabular-nums text-muted-foreground">{{ storedRecords }} {{ $t('uiText.symbol42099b4a') }} {{ maxRecords }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else-if="section === 'outputs'">
          <div v-if="outputs.length" class="space-y-3">
            <article v-for="output in outputs" :key="output.id" class="rounded-md border bg-background">
              <div class="flex items-center gap-3 border-b px-4 py-3">
                <Switch v-model:checked="output.enabled" :disabled="disabled" :aria-label="`Включить ${output.name}`" />
                <Input v-model="output.name" class="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 font-medium shadow-none" :disabled="disabled" />
                <Select :model-value="output.adapterType" :disabled="disabled" @update:model-value="setOutputAdapterType(output, $event)">
                  <SelectTrigger class="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="console">
                      {{ $t('uiText.console9f3341d3') }}
                    </SelectItem>
                    <SelectItem value="sentry">
                      {{ $t('uiText.sentry17f228be') }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" :disabled="disabled || !output.enabled" @click="testOutput(output)">
                  {{ $t('uiText.check52dec92e') }}
                </Button>
                <Button size="icon" variant="ghost" class="size-8 text-muted-foreground" :disabled="disabled" :aria-label="`Удалить ${output.name}`" @click="removeOutput(output.id)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>

              <div v-if="output.adapterType === 'console'" class="grid gap-5 p-4 md:grid-cols-[12rem_1fr]">
                <div>
                  <Label class="text-xs">{{ $t('uiText.formatb9563c38') }}</Label>
                  <Select :model-value="String(outputOption(output, 'format') ?? 'pretty')" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'format', String($event))">
                    <SelectTrigger class="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pretty">
                        {{ $t('uiText.prettyConsole17264c83') }}
                      </SelectItem>
                      <SelectItem value="json">
                        {{ $t('uiText.json031a4e76') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="text-xs">{{ $t('uiText.recordFields829af3a9') }}</Label>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <label class="flex items-center gap-2 text-xs"><Checkbox :model-value="outputOption(output, 'includeTimestamp') !== false" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'includeTimestamp', $event === true)" />{{ $t('uiText.timeC80d7e81') }}</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :model-value="outputOption(output, 'includeScope') !== false" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'includeScope', $event === true)" />{{ $t('uiText.scope4651a34e') }}</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :model-value="outputOption(output, 'includeAttributes') !== false" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'includeAttributes', $event === true)" />{{ $t('uiText.attributesa6652617') }}</label>
                    <label class="flex items-center gap-2 text-xs"><Checkbox :model-value="outputOption(output, 'groupByTrace') === true" :disabled="disabled || !output.enabled" @update:model-value="setOutputOption(output, 'groupByTrace', $event === true)" />{{ $t('uiText.groupByTrace5984f22b') }}</label>
                  </div>
                </div>
              </div>

              <div v-else-if="output.adapterType === 'sentry'" class="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="md:col-span-2 xl:col-span-2">
                  <Label class="text-xs">{{ $t('uiText.dsn3914c8b1') }}</Label>
                  <Input
                    :model-value="String(outputOption(output, 'dsn') ?? '')"
                    class="mt-2 font-mono text-xs"
                    placeholder="{{ SENTRY_DSN }}"
                    :disabled="disabled || !output.enabled"
                    @update:model-value="setOutputOption(output, 'dsn', String($event))"
                  />
                </div>
                <div>
                  <Label class="text-xs">{{ $t('uiText.environmentd443a118') }}</Label>
                  <Input
                    :model-value="String(outputOption(output, 'environment') ?? '')"
                    class="mt-2 font-mono text-xs"
                    placeholder="{{ SENTRY_ENVIRONMENT }}"
                    :disabled="disabled || !output.enabled"
                    @update:model-value="setOutputOption(output, 'environment', String($event))"
                  />
                </div>
                <div>
                  <Label class="text-xs">{{ $t('uiText.released41f56ce') }}</Label>
                  <Input
                    :model-value="String(outputOption(output, 'release') ?? '')"
                    class="mt-2 font-mono text-xs"
                    placeholder="{{ SENTRY_RELEASE }}"
                    :disabled="disabled || !output.enabled"
                    @update:model-value="setOutputOption(output, 'release', String($event))"
                  />
                </div>
                <div>
                  <Label class="text-xs">{{ $t('uiText.timeoutMs71e4b8da') }}</Label>
                  <Input
                    :model-value="Number(outputOption(output, 'requestTimeoutMs') ?? 10000)"
                    type="number"
                    min="1"
                    class="mt-2"
                    :disabled="disabled || !output.enabled"
                    @update:model-value="setOutputOption(output, 'requestTimeoutMs', Math.max(1, Number($event) || 10000))"
                  />
                </div>
                <label class="flex items-end gap-2 pb-2 text-xs md:col-span-1 xl:col-span-3">
                  <Checkbox
                    :model-value="outputOption(output, 'sendSnapshots') !== false"
                    :disabled="disabled || !output.enabled"
                    @update:model-value="setOutputOption(output, 'sendSnapshots', $event === true)"
                  />
                  {{ $t('uiText.sendSnapshotsAsJSONAttachment52a5ae5e') }}
                </label>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            {{ $t('uiText.outputChannelsAreNotConfigured0533a1d7') }}
          </div>
        </div>

        <div v-else-if="section === 'routing'">
          <div v-if="routes.length" class="overflow-hidden rounded-md border">
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
                  <Label class="field-label">{{ $t('uiText.typeD25691ca') }}</Label>
                  <Select :model-value="routeSignal(routeItem)" :disabled="disabled || !routeItem.enabled" @update:model-value="setRouteSignal(routeItem, $event)">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="log">
                        {{ $t('uiText.log8bf95ea3') }}
                      </SelectItem>
                      <SelectItem value="span">
                        {{ $t('uiText.span080e88ef') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="field-label">{{ $t('uiText.leveld9f964d7') }}</Label>
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
                  <Label class="field-label">{{ $t('uiText.phaseac9b7388') }}</Label>
                  <Select :model-value="routePhase(routeItem)" :disabled="disabled || !routeItem.enabled" @update:model-value="setRoutePhase(routeItem, $event)">
                    <SelectTrigger class="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">
                        {{ $t('uiText.any2f5de61f') }}
                      </SelectItem>
                      <SelectItem value="authoring">
                        {{ $t('uiText.authoringc76b8386') }}
                      </SelectItem>
                      <SelectItem value="build">
                        {{ $t('uiText.buildbbd80cf7') }}
                      </SelectItem>
                      <SelectItem value="runtime">
                        {{ $t('uiText.runtimec4740e4c') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label class="field-label">{{ $t('uiText.channeld01ba53d') }}</Label>
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
            {{ $t('uiText.rulesNotConfigured0c795e3b') }}
          </div>
        </div>

        <div v-else-if="section === 'manual-snapshot'">
          <section class="settings-section">
            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">{{ $t('diagnostics.snapshot.contentTitle') }}</Label>
                <p class="settings-hint">
                  {{ $t('uiText.jsonFileForAnalysisAndSupport3b241d20') }}
                </p>
              </div>
              <div class="space-y-4">
                <DiagnosticsSnapshotContentEditor v-model="manualSnapshotContent" :disabled="disabled" />

                <div class="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
                  <p class="max-w-xl text-xs leading-5 text-muted-foreground">
                    {{ $t('diagnostics.snapshot.redactionHint') }}
                  </p>
                  <Button size="sm" variant="outline" :disabled="disabled" @click="prepareSnapshot">
                    <Download class="mr-1.5 size-3.5" /> {{ $t('uiText.downloadJson2007ff2d') }}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else-if="section === 'hotkey-snapshot'">
          <section class="settings-section">
            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">{{ $t('diagnostics.snapshot.shortcut.triggerTitle') }}</Label>
                <p class="settings-hint">
                  {{ $t('diagnostics.snapshot.shortcut.description') }}
                </p>
              </div>
              <SFCInteractionTriggerActivationEditor
                v-model="shortcutSnapshotActivation"
                kind="shortcut"
                :disabled="disabled"
              />
            </div>

            <div class="settings-row">
              <div>
                <Label class="text-sm font-medium">{{ $t('diagnostics.snapshot.shortcut.contentTitle') }}</Label>
                <p class="settings-hint">
                  {{ $t('diagnostics.snapshot.shortcut.contentDescription') }}
                </p>
              </div>
              <DiagnosticsSnapshotContentEditor v-model="shortcutSnapshotContent" :disabled="disabled" />
            </div>
          </section>
        </div>

        <div v-else-if="section === 'automatic-snapshots'">
          <section class="settings-section">
            <div class="settings-row items-center">
              <div>
                <Label class="text-sm font-medium">{{ $t('diagnostics.snapshot.automatic.enabledTitle') }}</Label>
                <p class="settings-hint">
                  {{ $t('uiText.createSnapshotOnASeriesOfRuntimeErrors272c42ac') }}
                </p>
              </div>
              <Switch
                v-model:checked="automaticSnapshotEnabled"
                :disabled="disabled || !outputs.length"
                :aria-label="$t('diagnostics.snapshot.automatic.enabledTitle')"
              />
            </div>

            <div v-if="automaticSnapshotEnabled" class="settings-row">
              <div>
                <Label class="text-sm font-medium">{{ $t('uiText.condition1d10d9c5') }}</Label>
              </div>
              <div class="grid max-w-xl gap-4 sm:grid-cols-2">
                <div><Label class="field-label">{{ $t('uiText.numberOfErrors202f5f20') }}</Label><Input v-model.number="snapshotErrorCount" type="number" min="1" class="mt-1.5" :disabled="disabled" /></div>
                <div><Label class="field-label">{{ $t('uiText.withinSec871873f4') }}</Label><Input v-model.number="snapshotWindowSeconds" type="number" min="1" class="mt-1.5" :disabled="disabled" /></div>
                <div><Label class="field-label">{{ $t('uiText.pauseAfterSnapshotMin6f39325d') }}</Label><Input v-model.number="snapshotCooldownMinutes" type="number" min="0" class="mt-1.5" :disabled="disabled" /></div>
                <div>
                  <Label class="field-label">{{ $t('uiText.channeld01ba53d') }}</Label>
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
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
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

.field-label {
  color: var(--muted-foreground);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.empty-state {
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
