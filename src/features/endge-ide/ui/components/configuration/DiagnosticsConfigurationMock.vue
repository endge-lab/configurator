<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Download, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

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

type DiagnosticsSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
type DiagnosticsPhase = 'any' | 'authoring' | 'build' | 'runtime'

interface MockDiagnosticsOutput {
  id: string
  name: string
  enabled: boolean
  format: 'pretty' | 'json'
  groupByTrace: boolean
  includeTimestamp: boolean
  includeScope: boolean
  includeAttributes: boolean
}

interface MockDiagnosticsRoute {
  id: string
  name: string
  enabled: boolean
  signal: 'log' | 'span'
  minSeverity: DiagnosticsSeverity
  phase: DiagnosticsPhase
  outputId: string
}

defineProps<{
  variant: 'root' | 'contribution'
  disabled?: boolean
}>()

const diagnosticsEnabled = ref(true)
const collectLogs = ref(true)
const collectSpans = ref(true)
const minSeverity = ref<DiagnosticsSeverity>('INFO')
const maxRecords = ref(2000)
const includeTelemetry = ref(true)
const includeProblems = ref(true)
const includeConfiguration = ref(false)
const automaticSnapshotEnabled = ref(false)
const snapshotErrorCount = ref(10)
const snapshotWindowSeconds = ref(60)
const snapshotCooldownMinutes = ref(5)
const snapshotOutputId = ref('browser-console')
const outputSequence = ref(1)
const routeSequence = ref(1)
const feedback = ref('Изменения не сохраняются')

const outputs = ref<MockDiagnosticsOutput[]>([
  {
    id: 'browser-console',
    name: 'Browser console',
    enabled: true,
    format: 'pretty',
    groupByTrace: true,
    includeTimestamp: true,
    includeScope: true,
    includeAttributes: true,
  },
])

const routes = ref<MockDiagnosticsRoute[]>([
  {
    id: 'runtime-fatal-to-console',
    name: 'Runtime fatal errors',
    enabled: true,
    signal: 'log',
    minSeverity: 'FATAL',
    phase: 'runtime',
    outputId: 'browser-console',
  },
])

const severityOptions: DiagnosticsSeverity[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
const historyUsage = computed(() => Math.min(100, Math.round(438 / Math.max(maxRecords.value, 1) * 100)))

/** Добавляет локальный mock-output без изменения EndgeConfiguration. */
function addOutput(): void {
  outputSequence.value += 1
  const id = `browser-console-${outputSequence.value}`
  outputs.value.push({
    id,
    name: `Browser console ${outputSequence.value}`,
    enabled: true,
    format: 'pretty',
    groupByTrace: false,
    includeTimestamp: true,
    includeScope: true,
    includeAttributes: false,
  })
  feedback.value = `Добавлен ${id}`
}

/** Удаляет локальный output и переводит связанные mock-routes на первый доступный output. */
function removeOutput(outputId: string): void {
  outputs.value = outputs.value.filter(output => output.id !== outputId)
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
  routeSequence.value += 1
  routes.value.push({
    id: `diagnostics-route-${routeSequence.value}`,
    name: `Новое правило ${routeSequence.value}`,
    enabled: true,
    signal: 'log',
    minSeverity: 'ERROR',
    phase: 'runtime',
    outputId: outputs.value[0]?.id ?? '',
  })
  feedback.value = 'Правило добавлено'
}

/** Удаляет локальное mock-правило. */
function removeRoute(routeId: string): void {
  routes.value = routes.value.filter(route => route.id !== routeId)
  feedback.value = 'Правило удалено'
}

/** Показывает результат тестовой доставки без вызова настоящего adapter. */
function testOutput(output: MockDiagnosticsOutput): void {
  feedback.value = `Тестовая запись подготовлена для ${output.name}`
}

/** Имитирует подготовку snapshot без создания Blob и скачивания файла. */
function prepareSnapshot(): void {
  feedback.value = 'Mock snapshot подготовлен'
}
</script>

<template>
  <Tabs default-value="collection" class="min-h-full">
    <header class="border-b bg-background px-6 pt-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold">
              Диагностика
            </h2>
            <span class="rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Mock
            </span>
            <span v-if="variant === 'contribution'" class="text-[10px] text-muted-foreground">
              Унаследованный слой
            </span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Сбор и доставка диагностических данных.
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

    <div class="mx-auto max-w-5xl p-6">
      <TabsContent value="collection" class="m-0 outline-none">
        <section class="settings-section">
          <div class="settings-row items-center">
            <div>
              <Label class="text-sm font-medium">Собирать диагностику</Label>
              <p class="settings-hint">
                Отключает сбор для этого уровня конфигурации.
              </p>
            </div>
            <Switch v-model:checked="diagnosticsEnabled" :disabled="disabled" aria-label="Включить сбор диагностики" />
          </div>

          <div class="settings-row">
            <div>
              <Label class="text-sm font-medium">Типы данных</Label>
            </div>
            <div class="space-y-3">
              <label class="flex items-center gap-2.5 text-sm">
                <Checkbox v-model:checked="collectLogs" :disabled="disabled || !diagnosticsEnabled" />
                Логи
              </label>
              <label class="flex items-center gap-2.5 text-sm">
                <Checkbox v-model:checked="collectSpans" :disabled="disabled || !diagnosticsEnabled" />
                Операции
              </label>
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
                <span class="text-[10px] tabular-nums text-muted-foreground">438 / {{ maxRecords }}</span>
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
              <span class="hidden font-mono text-[10px] text-muted-foreground sm:inline">console</span>
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
                <Select v-model="output.format" :disabled="disabled || !output.enabled">
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
                  <label class="flex items-center gap-2 text-xs"><Checkbox v-model:checked="output.includeTimestamp" :disabled="disabled || !output.enabled" />Время</label>
                  <label class="flex items-center gap-2 text-xs"><Checkbox v-model:checked="output.includeScope" :disabled="disabled || !output.enabled" />Scope</label>
                  <label class="flex items-center gap-2 text-xs"><Checkbox v-model:checked="output.includeAttributes" :disabled="disabled || !output.enabled" />Attributes</label>
                  <label class="flex items-center gap-2 text-xs"><Checkbox v-model:checked="output.groupByTrace" :disabled="disabled || !output.enabled" />Группировать по trace</label>
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
                <Select v-model="routeItem.signal" :disabled="disabled || !routeItem.enabled">
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
                <Select v-model="routeItem.minSeverity" :disabled="disabled || !routeItem.enabled || routeItem.signal === 'span'">
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
                <Select v-model="routeItem.phase" :disabled="disabled || !routeItem.enabled">
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
              <div><Label class="field-label">Интервал, сек.</Label><Input v-model.number="snapshotWindowSeconds" type="number" min="1" class="mt-1.5" :disabled="disabled" /></div>
              <div><Label class="field-label">Cooldown, мин.</Label><Input v-model.number="snapshotCooldownMinutes" type="number" min="0" class="mt-1.5" :disabled="disabled" /></div>
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
