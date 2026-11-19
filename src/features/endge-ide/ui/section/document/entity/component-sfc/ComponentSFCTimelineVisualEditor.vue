<script setup lang="ts">
import type { ComponentSFCTimelineVisualNode, ComponentSFCVisualAttribute } from '@endge/core'
import { compileComponentSFC, Endge, parseComponentSFC, patchComponentSFCTimelineSource } from '@endge/core'
import { listTimelinePresets } from '@endge/ui-vue'
import { ArrowDown, ArrowUp, X } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/services/types/type-definition-resolver'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'color'
  values?: readonly string[]
  fallback?: string | number | boolean
}

interface Column {
  id: string
  field: string
  title?: string
  width?: number
  sortable?: boolean
}

const props = defineProps<{ source: string, identity: string, projection: ComponentSFCTimelineVisualNode }>()
const emit = defineEmits<{ 'update:source': [source: string], 'openSource': [offset: number] }>()
const chartIndex = ref<number>()
const error = ref('')
const selected = computed(() => props.projection.charts[chartIndex.value ?? -1] ?? props.projection)
const groupSelected = computed(() => selected.value.tag === 'TimelineGroup')
const moduleRevision = ref(0)
onScopeDispose(Endge.runtime.modules.subscribe(() => moduleRevision.value++))
const moduleScope = computed(() => EndgeIDE.runtimePreview.selectedEntry.value?.selectedModuleScope(props.identity))
const presets = computed(() => {
  void moduleRevision.value
  return listTimelinePresets(moduleScope.value)
})
const preset = computed(() => presets.value.find(item => item.name === literal('preset')))
const compileOptions = {
  resolveComponentTag: (tag: string) => Endge.program.resolveComponentTag(tag),
  resolveTypeDefinition: resolveEndgeTypeDefinition,
}
const compilation = computed(() => compileComponentSFC(props.source, compileOptions))
const previewErrors = computed(() => compilation.value.diagnostics.filter(item => item.severity === 'error'))
const previewData = computed(() => Object.fromEntries(Object.entries(compilation.value.previewProps ?? {}).filter(([, value]) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return !(value.type === 'store' || value.type === 'data')
  }
  return true
})))
const runtimePreviewNeeded = computed(() => Object.keys(previewData.value).length !== Object.keys(compilation.value.previewProps ?? {}).length)
const inputs = computed(() => compilation.value.contract.inputs.map(input => input.name))
const columns = computed<Column[]>(() => {
  const value = literal('columns')
  return Array.isArray(value) ? value as Column[] : []
})
const options = computed(() => record(literal('options')))
const settings = computed(() => record(literal('settings')))

const chartFields: Field[] = [
  { key: 'title', label: 'Заголовок', type: 'text' },
  { key: 'height', label: 'Начальная высота, px', type: 'number', fallback: 320 },
  { key: 'min-height', label: 'Минимальная высота, px', type: 'number', fallback: 80 },
  { key: 'max-height', label: 'Максимальная высота, px', type: 'number' },
  { key: 'hidden', label: 'Скрыть график', type: 'boolean' },
  { key: 'collapsed', label: 'Свернуть график', type: 'boolean' },
]
const groupFields: Field[] = [
  { key: 'sync', label: 'Синхронизация', type: 'select', values: ['none', 'time'], fallback: 'none' },
  { key: 'leader', label: 'Ключ ведущего графика', type: 'text' },
  { key: 'label-width', label: 'Ширина слева от шкалы, px', type: 'number', fallback: 160 },
  { key: 'splitter', label: 'Сплиттеры между графиками', type: 'boolean' },
]
const sections: { title: string, path?: string, fields: Field[] }[] = [
  { title: 'Шкала времени', path: 'timeScale', fields: [
    { key: 'enabled', label: 'Показывать шкалу', type: 'boolean', fallback: true },
    { key: 'height', label: 'Высота шкалы, px', type: 'number' },
    { key: 'preset', label: 'Вид шкалы', type: 'select', values: ['calendar', 'ticks', 'bands'] },
    { key: 'minTickWidthPx', label: 'Минимальный шаг делений, px', type: 'number' },
  ] },
  { title: 'Полосы прокрутки', path: 'scroll', fields: [
    { key: 'horizontalBarEnabled', label: 'Горизонтальная', type: 'boolean', fallback: true },
    { key: 'mainVerticalBarEnabled', label: 'Вертикальная основная', type: 'boolean', fallback: true },
    { key: 'ungroupedVerticalBarEnabled', label: 'Вертикальная нижней панели', type: 'boolean', fallback: true },
  ] },
  { title: 'Нижняя панель', path: 'ungroupedPanel', fields: [
    { key: 'enabled', label: 'Показывать несгруппированные задачи', type: 'boolean', fallback: true },
    { key: 'height', label: 'Высота панели, px', type: 'number' },
    { key: 'title', label: 'Заголовок панели', type: 'text' },
  ] },
  { title: 'Строки и задачи', path: 'tasks', fields: [
    { key: 'height', label: 'Высота балки, px', type: 'number' },
    { key: 'rowGap', label: 'Промежуток между балками, px', type: 'number' },
  ] },
  { title: 'Региональные настройки', fields: [
    { key: 'timezone', label: 'Часовой пояс', type: 'text' },
  ] },
]
const presetFields = computed<Field[]>(() => Object.entries(preset.value?.fields ?? {}).map(([key, field]) => ({
  key,
  label: field.label,
  type: field.type === 'string' ? (field.values ? 'select' : 'text') : field.type,
  values: 'values' in field ? field.values : undefined,
  fallback: field.default,
})))

function attribute(name: string): ComponentSFCVisualAttribute | undefined {
  return selected.value.attributes.find(item => item.name === name)
}

function literal(name: string): unknown {
  const value = attribute(name)?.value
  return value?.kind === 'expression' ? undefined : value?.value
}

function binding(name: string): string | undefined {
  const value = attribute(name)?.value
  return value?.kind === 'expression' ? value.source : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function openBinding(name: string): void {
  const input = binding(name)?.match(/^props\.([\w$]+)$/)?.[1]
  const declaration = input ? parseComponentSFC(props.source).ast?.script?.props?.range : undefined
  emit('openSource', declaration?.start ?? attribute(name)?.sourceRange?.start ?? selected.value.sourceRange.start)
}

function set(name: string, value: unknown, bound = false): void {
  try {
    const index = groupSelected.value || selected.value === props.projection ? undefined : chartIndex.value
    const source = patchComponentSFCTimelineSource(props.source, { chartIndex: index, name, value, binding: bound }, compileOptions)
    if (source !== props.source) {
      emit('update:source', source)
    }
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function setOption(path: string | undefined, key: string, value: unknown): void {
  const current = path ? record(options.value[path]) : options.value
  const next = { ...current }
  if (value == null) {
    delete next[key]
  }
  else {
    next[key] = value
  }
  set('options', path ? { ...options.value, [path]: next } : next)
}

function changePreset(value: unknown): void {
  if (value === literal('preset')) {
    return
  }
  try {
    const chartIndexValue = selected.value === props.projection ? undefined : chartIndex.value
    const next = patchComponentSFCTimelineSource(props.source, { chartIndex: chartIndexValue, name: 'preset', value }, compileOptions)
    const cleared = patchComponentSFCTimelineSource(next, { chartIndex: chartIndexValue, name: 'settings', value: null }, compileOptions)
    emit('update:source', cleared)
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function setSetting(key: string, value: unknown): void {
  const next = { ...settings.value }
  if (value == null) {
    delete next[key]
  }
  else {
    next[key] = value
  }
  set('settings', next)
}

function inputValue(event: Event, type: Field['type']): string | number | boolean | null {
  const target = event.target as HTMLInputElement
  if (type === 'boolean') {
    return target.checked
  }
  if (target.value === '') {
    return null
  }
  return type === 'number' ? Number(target.value) : target.value
}

function scalar(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function changeColumn(index: number, patch: Partial<Column>): void {
  set('columns', columns.value.map((column, i) => i === index ? { ...column, ...patch } : column))
}

function addColumn(): void {
  const ids = new Set(columns.value.map(column => column.id))
  let index = 1
  while (ids.has(`column-${index}`)) {
    index++
  }
  set('columns', [...columns.value, { id: `column-${index}`, field: 'title', title: 'Группа', width: 160, sortable: false }])
}

function moveColumn(index: number, next: number): void {
  const columnsNext = [...columns.value]
  const destination = columnsNext[next]
  const current = columnsNext[index]
  if (destination && current) {
    columnsNext[next] = current
    columnsNext[index] = destination
    set('columns', columnsNext)
  }
}

function chartLabel(chart: ComponentSFCTimelineVisualNode, index: number): string {
  const title = chart.attributes.find(item => item.name === 'title')?.value
  return title?.kind === 'literal' && typeof title.value === 'string' ? title.value : `График ${index + 1}`
}
</script>

<template>
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(290px,360px)] overflow-hidden">
    <section class="flex min-h-0 min-w-0 flex-col">
      <nav v-if="projection.tag === 'TimelineGroup'" class="flex shrink-0 items-center gap-1 overflow-x-auto border-b p-2" aria-label="Графики">
        <Button size="sm" :variant="groupSelected ? 'secondary' : 'ghost'" @click="chartIndex = undefined">
          {{ $t('timelineEditor.group') }}
        </Button>
        <Button v-for="(chart, index) in projection.charts" :key="index" size="sm" :variant="chartIndex === index ? 'secondary' : 'ghost'" @click="chartIndex = index">
          {{ chartLabel(chart, index) }}
          <template v-if="chart.attributes.some(item => item.name === 'for')">
            {{ $t('timelineEditor.templateSuffix') }}
          </template>
        </Button>
      </nav>
      <div class="min-h-0 flex-1 overflow-auto p-3">
        <p v-if="previewErrors.length" role="alert" class="text-sm text-destructive">
          {{ previewErrors[0]?.message }}
        </p>
        <p v-else-if="runtimePreviewNeeded" class="text-sm text-muted-foreground">
          {{ $t('timelineEditor.runtimePreview') }}
        </p>
        <EndgeAdapterRoot v-else-if="compilation.ir" root-key="sfc" :ir="compilation.ir" :props="previewData" :runtime-scope-id="moduleScope?.id" />
      </div>
    </section>
    <aside class="min-h-0 space-y-4 overflow-auto border-l p-4">
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
      <div v-if="!groupSelected" class="grid gap-2">
        <label class="text-sm font-medium" for="timeline-data">{{ $t('timelineEditor.data') }}</label>
        <Button v-if="binding('data')" variant="outline" class="justify-start font-mono" @click="openBinding('data')">
          {{ binding('data') }} {{ $t('timelineEditor.sourceSuffix') }}
        </Button>
        <select v-else-if="inputs.length" id="timeline-data" class="timeline-select" value="" @change="set('data', `props.${inputValue($event, 'text')}`, true)">
          <option value="" disabled>
            {{ literal('data') ? $t('timelineEditor.localData') : $t('timelineEditor.chooseInput') }}
          </option>
          <option v-for="name in inputs" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <Button v-else variant="outline" @click="openBinding('data')">
          {{ literal('data') ? $t('timelineEditor.localData') : $t('timelineEditor.setData') }} {{ $t('timelineEditor.sourceSuffix') }}
        </Button>
      </div>

      <div v-if="groupSelected && attribute('range')" class="grid gap-2">
        <span class="text-sm font-medium">{{ $t('timelineEditor.groupRange') }}</span>
        <Button variant="outline" class="justify-start" @click="openBinding('range')">
          {{ binding('range') ?? $t('timelineEditor.initialRange') }} {{ $t('timelineEditor.sourceSuffix') }}
        </Button>
      </div>

      <div v-for="field in groupSelected ? groupFields : chartFields" :key="field.key" class="grid gap-1">
        <label :for="`timeline-${field.key}`" class="text-sm font-medium">{{ field.label }}</label>
        <Button v-if="binding(field.key)" variant="outline" class="justify-start font-mono" @click="openBinding(field.key)">
          {{ binding(field.key) }} {{ $t('timelineEditor.sourceSuffix') }}
        </Button>
        <select v-else-if="field.type === 'select'" :id="`timeline-${field.key}`" class="timeline-select" :value="literal(field.key) ?? field.fallback" @change="set(field.key, inputValue($event, field.type))">
          <option v-for="value in field.values" :key="value" :value="value">
            {{ value }}
          </option>
        </select>
        <input v-else-if="field.type === 'boolean'" :id="`timeline-${field.key}`" class="h-4 w-4" type="checkbox" :checked="literal(field.key) === true" @change="set(field.key, inputValue($event, field.type))">
        <Input v-else :id="`timeline-${field.key}`" :type="field.type" :model-value="scalar(literal(field.key) ?? field.fallback)" @change="set(field.key, inputValue($event, field.type))" />
      </div>

      <template v-if="!groupSelected">
        <fieldset class="space-y-2 border-t pt-3">
          <legend class="text-sm font-medium">
            {{ $t('timelineEditor.columns') }}
          </legend>
          <Button v-if="binding('columns')" variant="outline" class="w-full justify-start font-mono" @click="openBinding('columns')">
            {{ binding('columns') }} {{ $t('timelineEditor.sourceSuffix') }}
          </Button>
          <template v-else>
            <div v-for="(column, index) in columns" :key="index" class="grid grid-cols-2 gap-2 rounded-md border p-2">
              <label class="text-xs">{{ $t('timelineEditor.id') }}<Input :model-value="column.id" @change="changeColumn(index, { id: String(inputValue($event, 'text') ?? '') })" /></label>
              <label class="text-xs">{{ $t('timelineEditor.field') }}<Input :model-value="column.field" @change="changeColumn(index, { field: String(inputValue($event, 'text') ?? '') })" /></label>
              <label class="text-xs">{{ $t('timelineEditor.title') }}<Input :model-value="column.title" @change="changeColumn(index, { title: String(inputValue($event, 'text') ?? '') })" /></label>
              <label class="text-xs">{{ $t('timelineEditor.width') }}<Input type="number" :model-value="column.width" @change="changeColumn(index, { width: Number(inputValue($event, 'number')) })" /></label>
              <label class="flex items-center gap-2 text-xs"><input type="checkbox" :checked="column.sortable" @change="changeColumn(index, { sortable: inputValue($event, 'boolean') === true })">{{ $t('timelineEditor.sort') }}</label>
              <div class="flex justify-end gap-1">
                <Button size="sm" variant="ghost" aria-label="Выше" :disabled="index === 0" @click="moveColumn(index, index - 1)">
                  <ArrowUp class="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Ниже" :disabled="index === columns.length - 1" @click="moveColumn(index, index + 1)">
                  <ArrowDown class="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Удалить колонку" @click="set('columns', columns.filter((_, i) => i !== index))">
                  <X class="size-4" />
                </Button>
              </div>
            </div>
            <Button size="sm" variant="outline" @click="addColumn">
              {{ $t('timelineEditor.addColumn') }}
            </Button>
          </template>
        </fieldset>

        <fieldset class="space-y-2 border-t pt-3">
          <legend class="text-sm font-medium">
            {{ $t('timelineEditor.preset') }}
          </legend>
          <Button v-if="binding('preset')" variant="outline" class="w-full justify-start font-mono" @click="openBinding('preset')">
            {{ binding('preset') }} {{ $t('timelineEditor.sourceSuffix') }}
          </Button>
          <select v-else aria-label="Пресет Timeline" class="timeline-select" :value="literal('preset') ?? ''" @change="changePreset(inputValue($event, 'text'))">
            <option value="">
              {{ $t('timelineEditor.standard') }}
            </option>
            <option v-if="literal('preset') && !preset" :value="literal('preset')">
              {{ literal('preset') }}{{ ' (' }}{{ $t('timelineEditor.unavailable') }}{{ ')' }}
            </option>
            <option v-for="entry in presets" :key="entry.name" :value="entry.name">
              {{ entry.label ?? entry.name }}
            </option>
          </select>
          <Button v-if="binding('settings')" variant="outline" class="w-full justify-start font-mono" @click="openBinding('settings')">
            {{ binding('settings') }} {{ $t('timelineEditor.sourceSuffix') }}
          </Button>
          <template v-else>
            <div v-for="field in presetFields" :key="field.key" class="grid gap-1">
              <label :for="`timeline-setting-${field.key}`" class="text-sm">{{ field.label }}</label>
              <select v-if="field.type === 'select'" :id="`timeline-setting-${field.key}`" class="timeline-select" :value="settings[field.key] ?? field.fallback" @change="setSetting(field.key, inputValue($event, field.type))">
                <option v-for="value in field.values" :key="value" :value="value">
                  {{ value }}
                </option>
              </select>
              <input v-else-if="field.type === 'boolean'" :id="`timeline-setting-${field.key}`" type="checkbox" class="h-4 w-4" :checked="Boolean(settings[field.key] ?? field.fallback)" @change="setSetting(field.key, inputValue($event, field.type))">
              <Input v-else :id="`timeline-setting-${field.key}`" :type="field.type" :model-value="scalar(settings[field.key] ?? field.fallback)" @change="setSetting(field.key, inputValue($event, field.type))" />
            </div>
          </template>
        </fieldset>

        <Button v-if="binding('options')" variant="outline" class="w-full justify-start font-mono" @click="openBinding('options')">
          {{ binding('options') }} {{ $t('timelineEditor.sourceSuffix') }}
        </Button>
        <template v-else>
          <fieldset v-for="section in sections" :key="section.title" class="space-y-2 border-t pt-2">
            <legend class="text-sm font-medium">
              {{ section.title }}
            </legend>
            <div v-for="field in section.fields" :key="field.key" class="grid gap-1">
              <label :for="`timeline-option-${section.path}-${field.key}`" class="text-sm">{{ field.label }}</label>
              <select v-if="field.type === 'select'" :id="`timeline-option-${section.path}-${field.key}`" class="timeline-select" :value="record(options[section.path ?? ''])[field.key] ?? ''" @change="setOption(section.path, field.key, inputValue($event, field.type))">
                <option value="">
                  {{ $t('timelineEditor.default') }}
                </option>
                <option v-for="value in field.values" :key="value" :value="value">
                  {{ value }}
                </option>
              </select>
              <input v-else-if="field.type === 'boolean'" :id="`timeline-option-${section.path}-${field.key}`" type="checkbox" class="h-4 w-4" :checked="Boolean(record(options[section.path ?? ''])[field.key] ?? field.fallback)" @change="setOption(section.path, field.key, inputValue($event, field.type))">
              <Input v-else :id="`timeline-option-${section.path}-${field.key}`" :type="field.type" :model-value="scalar((section.path ? record(options[section.path]) : options)[field.key])" @change="setOption(section.path, field.key, inputValue($event, field.type))" />
            </div>
          </fieldset>
        </template>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.timeline-select {
  width: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: .375rem;
  padding-inline: .625rem;
  background: var(--background);
  font-size: .875rem;
}
</style>
