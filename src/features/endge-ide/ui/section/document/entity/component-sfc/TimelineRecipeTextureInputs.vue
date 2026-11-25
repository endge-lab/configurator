<script setup lang="ts">
import type { TimelineRecipeTexture } from '@endge/core'
import { Input } from '@/components/ui/input'
import { colorInputValue } from './timeline-recipe-appearance'

const props = defineProps<{ fill: TimelineRecipeTexture }>()
const emit = defineEmits<{ update: [fill: TimelineRecipeTexture] }>()

function changeColor(which: 'first' | 'second', value: string | number) {
  const color = String(value)
  const fill = props.fill
  if (fill.type === 'stripe') {
    emit('update', which === 'first' ? { ...fill, background: color } : { ...fill, color })
  }
  else {
    emit('update', which === 'first' ? { ...fill, from: color } : { ...fill, to: color })
  }
}

function changeNumber(key: 'angle' | 'width', value: string | number) {
  if (value !== '' && Number.isFinite(Number(value))) {
    emit('update', { ...props.fill, [key]: key === 'width' ? Math.max(1, Math.min(16, Number(value))) : Number(value) })
  }
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <label class="grid gap-1 text-xs">
      {{ fill.type === 'stripe' ? $t('timelineEditor.recipes.fillColor') : $t('timelineEditor.recipes.gradientFrom') }}
      <Input type="color" class="h-8 p-1" :model-value="colorInputValue(fill.type === 'stripe' ? fill.background : fill.from)" @update:model-value="changeColor('first', $event)" />
    </label>
    <label class="grid gap-1 text-xs">
      {{ fill.type === 'stripe' ? $t('timelineEditor.recipes.stripeColor') : $t('timelineEditor.recipes.gradientTo') }}
      <Input type="color" class="h-8 p-1" :model-value="colorInputValue(fill.type === 'stripe' ? fill.color : fill.to, '#ffffff')" @update:model-value="changeColor('second', $event)" />
    </label>
    <label class="grid gap-1 text-xs">
      {{ $t('timelineEditor.recipes.fillAngle') }}
      <Input type="number" class="h-8" :model-value="fill.angle" @update:model-value="changeNumber('angle', $event)" />
    </label>
    <label v-if="fill.type === 'stripe'" class="grid gap-1 text-xs">
      {{ $t('timelineEditor.recipes.stripeWidth') }}
      <Input type="number" class="h-8" min="1" max="16" :model-value="fill.width" @update:model-value="changeNumber('width', $event)" />
    </label>
  </div>
</template>
