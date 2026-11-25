<script setup lang="ts">
import type { TimelineRecipeBoundary, TimelineRecipeElement, TimelineRecipeStyle } from '@endge/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import TimelineRecipeBoundaryEditor from './TimelineRecipeBoundaryEditor.vue'
import TimelineRecipeStyleEditor from './TimelineRecipeStyleEditor.vue'

const props = defineProps<{
  element: TimelineRecipeElement
  blocks: readonly string[]
  instants: string[]
  bindings: Readonly<Record<string, unknown>>
}>()
const emit = defineEmits<{
  position: [value: TimelineRecipeElement['position']]
  appearance: [value?: TimelineRecipeStyle]
}>()
const { t } = useI18n()
const widthLabel = computed(() => props.element.shape === 'circle'
  ? t('timelineEditor.recipes.primitiveDiameter')
  : t('timelineEditor.recipes.primitiveWidth'))

function setAnchor(axis: 'x' | 'y', anchor?: TimelineRecipeBoundary) {
  const position = props.element.position
  if (anchor && axis === 'x') {
    emit('position', { ...position, x: anchor })
  }
  else if (anchor && anchor.mode !== 'time') {
    emit('position', { ...position, y: anchor })
  }
}

function setSize(key: 'width' | 'height', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value) && value > 0) {
    emit('position', { ...props.element.position, [key]: value })
  }
}
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <label class="grid min-w-0 gap-1 text-xs">
      {{ $t('timelineEditor.recipes.primitiveReference') }}
      <select
        :value="element.position.blockId ?? ''" class="h-8 rounded-md border bg-background px-2"
        @change="emit('position', { ...element.position, blockId: ($event.target as HTMLSelectElement).value || undefined })"
      >
        <option value="">{{ $t('timelineEditor.recipes.selectLayout') }}</option>
        <option v-for="id in blocks" :key="id" :value="id">{{ $t('timelineEditor.recipes.primitiveBlock', { id }) }}</option>
      </select>
    </label>
    <fieldset class="grid min-w-0 gap-2 rounded border px-3 pb-3 sm:px-4 sm:pb-4">
      <legend class="px-1 text-xs">
        {{ $t('timelineEditor.recipes.primitiveX') }}
      </legend>
      <TimelineRecipeBoundaryEditor class="mt-1.5" :boundary="element.position.x" :instants="instants" :bindings="bindings" time @update:boundary="setAnchor('x', $event)" />
    </fieldset>
    <fieldset class="grid min-w-0 gap-2 rounded border px-3 pb-3 sm:px-4 sm:pb-4">
      <legend class="px-1 text-xs">
        {{ $t('timelineEditor.recipes.primitiveY') }}
      </legend>
      <TimelineRecipeBoundaryEditor class="mt-1.5" :boundary="element.position.y" :instants="instants" :bindings="bindings" vertical @update:boundary="setAnchor('y', $event)" />
    </fieldset>
    <div class="grid gap-2 sm:grid-cols-2">
      <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
        <label class="grid min-w-0 gap-1 text-xs">
          {{ widthLabel }}
          <Input type="number" min="1" :model-value="element.position.width" @change="setSize('width', $event)" />
        </label>
        <TimelineRecipeStyleEditor
          field="layerWidth" :label="widthLabel"
          :base="element.position.width" :bindings="bindings" :appearance="element.appearance" @update="emit('appearance', $event)"
        />
      </div>
      <div v-if="element.shape !== 'circle'" class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
        <label class="grid min-w-0 gap-1 text-xs">
          {{ $t('timelineEditor.recipes.layerHeight') }}
          <Input type="number" min="1" :model-value="element.position.height" @change="setSize('height', $event)" />
        </label>
        <TimelineRecipeStyleEditor
          field="layerHeight" :label="$t('timelineEditor.recipes.layerHeight')"
          :base="element.position.height" :bindings="bindings" :appearance="element.appearance" @update="emit('appearance', $event)"
        />
      </div>
    </div>
  </div>
</template>
