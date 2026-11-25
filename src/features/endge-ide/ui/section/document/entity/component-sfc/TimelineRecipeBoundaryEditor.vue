<script setup lang="ts">
import type { TimelineRecipeBoundary } from '@endge/core'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  boundary?: TimelineRecipeBoundary
  instants: string[]
  durations: string[]
  time?: boolean
  optional?: boolean
  defaultEdge?: 'start' | 'end'
}>()
const emit = defineEmits<{ 'update:boundary': [value: TimelineRecipeBoundary | undefined] }>()

function select(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function mode(value: string) {
  if (!value) {
    emit('update:boundary', undefined)
  }
  else if (value === 'ratio') {
    emit('update:boundary', { mode: 'ratio', offset: 0.5 })
  }
  else if (value === 'time') {
    emit('update:boundary', { mode: 'time', field: props.instants[0] ?? 'startTime', offset: 0 })
  }
  else {
    emit('update:boundary', {
      mode: 'px',
      edge: value === 'end' ? 'end' : 'start',
      offset: props.boundary?.mode === 'px' ? props.boundary.offset : 0,
    })
  }
}

function updateOffset(event: Event) {
  const offset = (event.target as HTMLInputElement).valueAsNumber
  if (!props.boundary || !Number.isFinite(offset)) {
    return
  }
  const value = props.boundary.mode === 'ratio' ? Math.max(0, Math.min(100, offset)) / 100 : offset
  emit('update:boundary', { ...props.boundary, offset: value })
}
</script>

<template>
  <div class="grid min-w-0 gap-2 sm:grid-cols-2">
    <label class="grid min-w-0 gap-1 text-xs">
      {{ $t('timelineEditor.recipes.anchor') }}
      <select class="recipe-select" :value="boundary?.mode === 'px' ? boundary.edge : boundary?.mode ?? ''" @change="mode(select($event))">
        <option v-if="optional" value="">{{ defaultEdge === 'end' ? $t('timelineEditor.recipes.edgeEnd') : $t('timelineEditor.recipes.edgeStart') }}</option>
        <option value="start">{{ $t('timelineEditor.recipes.pxFromStart') }}</option>
        <option value="end">{{ $t('timelineEditor.recipes.pxFromEnd') }}</option>
        <option v-if="time && (!optional || boundary?.mode === 'ratio')" value="ratio">{{ $t('timelineEditor.recipes.relativeWidth') }}</option>
        <option v-if="time" value="time">{{ $t('timelineEditor.recipes.timeField') }}</option>
      </select>
    </label>
    <label v-if="boundary" class="grid min-w-0 gap-1 text-xs">
      {{ boundary.mode === 'ratio' ? $t('timelineEditor.recipes.offsetPercent') : boundary.mode === 'time' ? $t('timelineEditor.recipes.offsetMs') : $t('timelineEditor.recipes.offsetPx') }}
      <Input :model-value="boundary.mode === 'ratio' ? Math.round(boundary.offset * 1000) / 10 : boundary.offset" type="number" @change="updateOffset" />
    </label>
    <template v-if="boundary?.mode === 'time'">
      <label class="grid min-w-0 gap-1 text-xs">
        {{ $t('timelineEditor.recipes.timeField') }}
        <select class="recipe-select" :value="boundary.field" @change="emit('update:boundary', { ...boundary, field: select($event) })">
          <option v-if="!instants.includes(boundary.field)" :value="boundary.field">{{ boundary.field }}</option>
          <option v-for="field in instants" :key="field" :value="field">{{ field }}</option>
        </select>
      </label>
      <label class="grid min-w-0 gap-1 text-xs">
        {{ $t('timelineEditor.recipes.offsetField') }}
        <select
          class="recipe-select" :value="boundary.offsetField ?? ''"
          @change="emit('update:boundary', { ...boundary, offsetField: select($event) || undefined })"
        >
          <option value="">{{ $t('timelineEditor.recipes.noOffsetField') }}</option>
          <option v-if="boundary.offsetField && !durations.includes(boundary.offsetField)" :value="boundary.offsetField">{{ boundary.offsetField }}</option>
          <option v-for="field in durations" :key="field" :value="field">{{ field }}</option>
        </select>
      </label>
      <label v-if="boundary.offsetField" class="col-span-full flex items-center gap-2 text-xs">
        <input type="checkbox" :checked="boundary.subtract" @change="emit('update:boundary', { ...boundary, subtract: ($event.target as HTMLInputElement).checked })">
        {{ $t('timelineEditor.recipes.subtractOffset') }}
      </label>
    </template>
  </div>
</template>

<style scoped>
.recipe-select {
  min-width: 0;
  height: 2.25rem;
  padding-inline: .5rem;
  border: 1px solid var(--border);
  border-radius: .375rem;
  background: var(--background);
  color: inherit;
}
</style>
