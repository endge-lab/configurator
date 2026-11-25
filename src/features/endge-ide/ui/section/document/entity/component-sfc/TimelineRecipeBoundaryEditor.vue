<script setup lang="ts">
import type { TimelineRecipeBoundary } from '@endge/core'
import { timelineRecipeTaskPath } from '@endge/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TimelineBindingInput from './TimelineBindingInput.vue'

const props = defineProps<{
  boundary?: TimelineRecipeBoundary
  instants: string[]
  bindings: Readonly<Record<string, unknown>>
  time?: boolean
  vertical?: boolean
  optional?: boolean
  defaultEdge?: 'start' | 'end'
}>()
const emit = defineEmits<{ 'update:boundary': [value: TimelineRecipeBoundary | undefined] }>()
const { t } = useI18n()
const otherInstants = computed(() => props.instants.filter(field => field !== 'startTime' && field !== 'endTime'))
const anchor = computed(() => {
  const at = props.boundary
  if (!at || at.mode !== 'time') {
    return at?.mode === 'px' ? at.edge : at?.mode ?? ''
  }
  if (at.anchorExpression) {
    return 'time-expression'
  }
  if (at.field === 'startTime') {
    return 'time-start'
  }
  if (at.field === 'endTime') {
    return 'time-end'
  }
  return 'time-field'
})
const expression = computed(() => {
  const at = props.boundary
  if (at?.offsetExpression) {
    return at.offsetExpression
  }
  if (at?.mode === 'time' && at.offsetField) {
    return `${at.offset} ${at.subtract ? '-' : '+'} ${timelineRecipeTaskPath(at.offsetField)}`
  }
  return undefined
})
const value = computed(() => {
  const at = props.boundary
  if (!at) {
    return ''
  }
  return expression.value ?? String(at.mode === 'ratio' ? at.offset * 100 : at.mode === 'time' ? at.offset / 60000 : at.offset)
})
const offsetLabel = computed(() => {
  if (props.boundary?.mode === 'ratio') {
    return props.vertical ? t('timelineEditor.recipes.offsetHeightPercent') : t('timelineEditor.recipes.offsetPercent')
  }
  if (props.boundary?.mode === 'time') {
    return expression.value === undefined ? t('timelineEditor.recipes.offsetMinutes') : t('timelineEditor.recipes.offsetMs')
  }
  return t('timelineEditor.recipes.offsetPx')
})

function read(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function setAnchor(mode: string) {
  const previous = props.boundary
  if (!mode) {
    emit('update:boundary', undefined)
  }
  else if (mode === 'ratio') {
    emit('update:boundary', { mode: 'ratio', offset: 0.5 })
  }
  else if (mode.startsWith('time-')) {
    const field = mode === 'time-end'
      ? 'endTime'
      : mode === 'time-field' ? otherInstants.value[0] ?? 'startTime' : 'startTime'
    const timeOffset = previous?.mode === 'time'
      ? { offset: previous.offset, offsetExpression: previous.offsetExpression, offsetField: previous.offsetField, subtract: previous.subtract }
      : { offset: 0 }
    emit('update:boundary', {
      mode: 'time',
      field,
      ...timeOffset,
      anchorExpression: mode === 'time-expression' ? timelineRecipeTaskPath(previous?.mode === 'time' ? previous.field : field) : undefined,
    })
  }
  else {
    const pixelOffset = previous?.mode === 'px' ? previous : { offset: 0 }
    emit('update:boundary', { ...pixelOffset, mode: 'px', edge: mode === 'end' ? 'end' : 'start' })
  }
}

function setOffset(offset: number, source?: string) {
  const at = props.boundary
  if (!at) {
    return
  }
  if (at.mode === 'time') {
    emit('update:boundary', { ...at, offset, offsetExpression: source, offsetField: undefined, subtract: undefined })
  }
  else {
    emit('update:boundary', { ...at, offset, offsetExpression: source })
  }
}

function changeOffset(next: string, binding: boolean) {
  const at = props.boundary
  if (!at || !next.trim()) {
    return
  }
  if (binding) {
    setOffset(at.offset, next.trim())
    return
  }
  const number = Number(next)
  if (!Number.isFinite(number)) {
    return
  }
  const offset = at.mode === 'ratio'
    ? Math.max(0, Math.min(100, number)) / 100
    : at.mode === 'time' ? Math.round(number * 60000) : number
  setOffset(offset)
}

function toggleOffset() {
  const at = props.boundary
  if (!at) {
    return
  }
  const numeric = at.mode === 'ratio' ? at.offset * 100 : at.offset
  setOffset(at.offset, expression.value === undefined ? String(numeric) : undefined)
}

function changeAnchorExpression(source: string) {
  const at = props.boundary
  if (at?.mode === 'time' && source.trim()) {
    emit('update:boundary', { ...at, anchorExpression: source.trim() })
  }
}
</script>

<template>
  <div class="grid min-w-0 gap-2 sm:grid-cols-2">
    <label class="grid min-w-0 gap-1 text-xs">
      {{ $t('timelineEditor.recipes.anchor') }}
      <select class="recipe-select" :value="anchor" @change="setAnchor(read($event))">
        <option v-if="optional" value="">{{ defaultEdge === 'end' ? $t('timelineEditor.recipes.edgeEnd') : $t('timelineEditor.recipes.edgeStart') }}</option>
        <option value="start">{{ vertical ? $t('timelineEditor.recipes.pxFromTop') : $t('timelineEditor.recipes.pxFromStart') }}</option>
        <option value="end">{{ vertical ? $t('timelineEditor.recipes.pxFromBottom') : $t('timelineEditor.recipes.pxFromEnd') }}</option>
        <option v-if="time || vertical" value="ratio">{{ vertical ? $t('timelineEditor.recipes.relativeHeight') : $t('timelineEditor.recipes.relativeWidth') }}</option>
        <option v-if="time" value="time-start">{{ $t('timelineEditor.recipes.timeFromStart') }}</option>
        <option v-if="time" value="time-end">{{ $t('timelineEditor.recipes.timeFromEnd') }}</option>
        <option v-if="time && (otherInstants.length || anchor === 'time-field')" value="time-field">{{ $t('timelineEditor.recipes.timeField') }}</option>
        <option v-if="time" value="time-expression">{{ $t('timelineEditor.recipes.timeExpression') }}</option>
      </select>
    </label>
    <div v-if="boundary" class="grid min-w-0 gap-1 text-xs">
      <span>{{ offsetLabel }}</span>
      <TimelineBindingInput
        :value="value" :binding="expression !== undefined" :label="offsetLabel" :bindings="bindings"
        scope="timeline-recipe" numeric :expression-example="boundary.mode === 'time' ? '$task.takeoffDurationMinutes * 60000' : undefined"
        @change="changeOffset" @toggle="toggleOffset"
      />
    </div>
    <label v-if="boundary?.mode === 'time' && anchor === 'time-field'" class="grid min-w-0 gap-1 text-xs">
      {{ $t('timelineEditor.recipes.timeField') }}
      <select class="recipe-select" :value="boundary.field" @change="emit('update:boundary', { ...boundary, field: read($event) })">
        <option v-if="!otherInstants.includes(boundary.field)" :value="boundary.field">{{ boundary.field }}</option>
        <option v-for="field in otherInstants" :key="field" :value="field">{{ field }}</option>
      </select>
    </label>
    <div v-if="boundary?.mode === 'time' && boundary.anchorExpression" class="col-span-full grid min-w-0 gap-1 text-xs">
      <span>{{ $t('timelineEditor.recipes.timeExpression') }}</span>
      <TimelineBindingInput
        :value="boundary.anchorExpression" binding :label="$t('timelineEditor.recipes.timeExpression')" :bindings="bindings"
        scope="timeline-recipe" expression-example="$task.startTime" @change="changeAnchorExpression" @toggle="setAnchor('time-start')"
      />
    </div>
  </div>
</template>

<style scoped>
.recipe-select {
  min-width: 0;
  height: 2rem;
  padding-inline: .5rem;
  border: 1px solid var(--border);
  border-radius: .375rem;
  background: var(--background);
  color: inherit;
}
</style>
