<script setup lang="ts">
import type { TimelineRecipeFill, TimelineRecipeRect, TimelineRecipeShape, TimelineRecipeStyle } from '@endge/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { colorInputValue, timelineRecipeFillStyle } from './timeline-recipe-appearance'
import TimelineRecipeStyleEditor from './TimelineRecipeStyleEditor.vue'
import TimelineRecipeToolButton from './TimelineRecipeToolButton.vue'

const props = defineProps<{ block: TimelineRecipeRect, renderedFill?: TimelineRecipeFill, overlay?: boolean, shape?: TimelineRecipeShape, bindings: Readonly<Record<string, unknown>> }>()
const emit = defineEmits<{ update: [block: TimelineRecipeRect] }>()
const fill = computed(() => props.block.fill)
const fillType = computed(() => typeof fill.value === 'string' ? 'solid' : fill.value.type)
const baseColor = computed(() => typeof fill.value === 'string' ? fill.value : fill.value.type === 'stripe' ? fill.value.background : fill.value.from)

function updateFill(fill: TimelineRecipeFill) {
  const previous = props.block.fill
  const keepTextures = typeof previous !== 'string' && typeof fill !== 'string' && previous.type === fill.type
  const appearance = !keepTextures && props.block.appearance?.textures
    ? { ...props.block.appearance, textures: undefined }
    : props.block.appearance
  emit('update', { ...props.block, fill, appearance, ...(typeof fill === 'string' ? {} : { opacity: undefined, radius: undefined }) })
}

function updateAppearance(appearance?: TimelineRecipeStyle) {
  emit('update', { ...props.block, appearance })
}

function setFillType(event: Event) {
  const color = colorInputValue(baseColor.value)
  const type = (event.target as HTMLSelectElement).value
  if (type === 'stripe') {
    updateFill({ type, background: color, color: '#ffffff', width: 4, angle: 45 })
  }
  else if (type === 'linear-gradient') {
    updateFill({ type, from: color, to: '#234779', angle: 0 })
  }
  else {
    updateFill(baseColor.value)
  }
}

function read(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function updateStyle(event: Event, key: 'background' | 'color' | 'from' | 'to' | 'width' | 'angle') {
  if (typeof fill.value === 'string') {
    return
  }
  const input = read(event)
  const value = key === 'width' || key === 'angle' ? Number(input) : input
  if (input && (typeof value === 'string' || Number.isFinite(value))) {
    updateFill({ ...fill.value, [key]: key === 'width' ? Math.min(16, Math.max(1, Number(value))) : value })
  }
}

function toggleBorder(event: Event) {
  emit('update', {
    ...props.block,
    border: (event.target as HTMLInputElement).checked ? { color: '#ffffff', width: 1, style: 'solid' } : undefined,
  })
}

function updateBorder(event: Event, key: 'color' | 'width' | 'style') {
  const input = read(event)
  if (props.block.border && input) {
    emit('update', {
      ...props.block,
      border: { ...props.block.border, [key]: key === 'width' ? Math.min(16, Math.max(1, Number(input))) : input },
    })
  }
}

function updateRectStyle(event: Event, key: 'opacity' | 'radius') {
  const input = read(event)
  const value = Number(input)
  if (input && Number.isFinite(value)) {
    emit('update', { ...props.block, [key]: key === 'opacity' ? Math.min(100, Math.max(0, value)) / 100 : Math.max(0, value) })
  }
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.appearance')">
        <span class="size-4 rounded-sm border border-foreground/25" :style="timelineRecipeFillStyle(renderedFill ?? fill)" />
      </TimelineRecipeToolButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent align="start" :side-offset="6" class="z-[10000] grid w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md" @open-auto-focus.prevent>
        <div class="grid grid-cols-[1fr_auto] items-end gap-1">
          <label class="grid gap-1 text-xs font-medium">
            {{ $t('timelineEditor.recipes.fill') }}
            <select class="h-8 rounded-md border bg-background px-2 font-normal" :value="fillType" @change="setFillType">
              <option value="solid">{{ $t('timelineEditor.recipes.solidFill') }}</option>
              <option value="stripe">{{ $t('timelineEditor.recipes.stripeFill') }}</option>
              <option value="linear-gradient">{{ $t('timelineEditor.recipes.gradientFill') }}</option>
            </select>
          </label>
          <TimelineRecipeStyleEditor v-if="typeof fill !== 'string'" :texture="fill" :label="$t('timelineEditor.recipes.fill')" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
            <label class="grid min-w-0 gap-1 text-xs">
              {{ typeof fill !== 'string' && fill.type === 'linear-gradient' ? $t('timelineEditor.recipes.gradientFrom') : $t('timelineEditor.recipes.fillColor') }}
              <Input type="color" class="h-8 p-1" :model-value="colorInputValue(baseColor)" @change="typeof fill === 'string' ? updateFill(read($event)) : updateStyle($event, fill.type === 'stripe' ? 'background' : 'from')" />
            </label>
            <TimelineRecipeStyleEditor v-if="typeof fill === 'string'" field="fill" color :label="$t('timelineEditor.recipes.fillColor')" :base="baseColor" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
          </div>
          <template v-if="typeof fill !== 'string'">
            <label class="grid gap-1 text-xs">
              {{ fill.type === 'stripe' ? $t('timelineEditor.recipes.stripeColor') : $t('timelineEditor.recipes.gradientTo') }}
              <Input type="color" class="h-8 p-1" :model-value="colorInputValue(fill.type === 'stripe' ? fill.color : fill.to, '#ffffff')" @change="updateStyle($event, fill.type === 'stripe' ? 'color' : 'to')" />
            </label>
            <label class="grid gap-1 text-xs">
              {{ $t('timelineEditor.recipes.fillAngle') }}
              <Input type="number" class="h-8" :model-value="fill.angle" @change="updateStyle($event, 'angle')" />
            </label>
            <label v-if="fill.type === 'stripe'" class="grid gap-1 text-xs">
              {{ $t('timelineEditor.recipes.stripeWidth') }}
              <Input type="number" class="h-8" min="1" max="16" :model-value="fill.width" @change="updateStyle($event, 'width')" />
            </label>
          </template>
          <template v-else-if="!overlay">
            <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
              <label class="grid min-w-0 gap-1 text-xs">
                {{ $t('timelineEditor.recipes.fillOpacity') }}
                <Input type="number" class="h-8" min="0" max="100" :model-value="Math.round((block.opacity ?? 1) * 100)" @change="updateRectStyle($event, 'opacity')" />
              </label>
              <TimelineRecipeStyleEditor field="opacity" :label="$t('timelineEditor.recipes.fillOpacity')" :base="block.opacity ?? 1" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
            </div>
            <div v-if="shape !== 'circle'" class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
              <label class="grid min-w-0 gap-1 text-xs">
                {{ $t('timelineEditor.recipes.cornerRadius') }}
                <Input type="number" class="h-8" min="0" :model-value="block.radius ?? 0" @change="updateRectStyle($event, 'radius')" />
              </label>
              <TimelineRecipeStyleEditor field="radius" :label="$t('timelineEditor.recipes.cornerRadius')" :base="block.radius ?? 0" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
            </div>
          </template>
        </div>
        <div class="flex items-center justify-between gap-2 border-t pt-2">
          <label class="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" :checked="Boolean(block.border)" @change="toggleBorder">
            {{ $t('timelineEditor.recipes.border') }}
          </label>
          <TimelineRecipeStyleEditor field="borderVisible" :label="$t('timelineEditor.recipes.border')" :base="Boolean(block.border)" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
        </div>
        <div v-if="block.border" class="grid grid-cols-2 gap-2">
          <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
            <label class="grid min-w-0 gap-1 text-xs">
              {{ $t('timelineEditor.recipes.borderColor') }}
              <Input type="color" class="h-8 p-1" :model-value="colorInputValue(block.border.color, '#ffffff')" @change="updateBorder($event, 'color')" />
            </label>
            <TimelineRecipeStyleEditor field="borderColor" color :label="$t('timelineEditor.recipes.borderColor')" :base="block.border.color" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
          </div>
          <div class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
            <label class="grid min-w-0 gap-1 text-xs">
              {{ $t('timelineEditor.recipes.borderWidth') }}
              <Input type="number" class="h-8" min="1" max="16" :model-value="block.border.width" @change="updateBorder($event, 'width')" />
            </label>
            <TimelineRecipeStyleEditor field="borderWidth" :label="$t('timelineEditor.recipes.borderWidth')" :base="block.border.width" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
          </div>
          <div class="col-span-2 grid grid-cols-[1fr_auto] items-end gap-1">
            <label class="grid gap-1 text-xs">
              {{ $t('timelineEditor.recipes.borderStyle') }}
              <select class="h-8 rounded-md border bg-background px-2" :value="block.border.style" @change="updateBorder($event, 'style')">
                <option value="solid">{{ $t('timelineEditor.recipes.solidBorder') }}</option>
                <option value="dashed">{{ $t('timelineEditor.recipes.dashedBorder') }}</option>
              </select>
            </label>
            <TimelineRecipeStyleEditor field="borderStyle" :label="$t('timelineEditor.recipes.borderStyle')" :base="block.border.style" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
          </div>
        </div>
        <div class="flex items-center justify-between gap-2 border-t pt-2 text-xs">
          <span>{{ $t('timelineEditor.recipes.blockVisibility') }}</span>
          <TimelineRecipeStyleEditor field="visible" :label="$t('timelineEditor.recipes.blockVisibility')" :base="true" :bindings="bindings" :appearance="block.appearance" @update="updateAppearance" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
