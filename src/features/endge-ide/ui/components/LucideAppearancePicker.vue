<script setup lang="ts">
import type { Component } from 'vue'

import { CircleHelp, icons, Palette, Search } from 'lucide-vue-next'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  icon: string
  color: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:icon': [value: string]
  'update:color': [value: string]
}>()

const query = ref('')
const advanced = ref(false)
const open = ref(false)
const hue = ref(220)
const saturation = ref(84)
const value = ref(90)

const canonicalIcons = Object.entries(icons as Record<string, Component>)
  .filter(([name]) => /^[A-Z][A-Za-z0-9]*$/.test(name) && !name.endsWith('Icon') && !name.startsWith('Lucide'))
  .sort(([left], [right]) => left.localeCompare(right))
const iconMap = new Map(canonicalIcons)
const filteredIcons = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return needle ? canonicalIcons.filter(([name]) => name.toLowerCase().includes(needle)) : canonicalIcons
})
const selectedIcon = computed(() => iconMap.get(props.icon) ?? CircleHelp)
const iconKnown = computed(() => iconMap.has(props.icon))

watch(() => props.color, (color) => {
  const hsv = hexToHsv(color)
  if (!hsv) {
    return
  }
  hue.value = hsv.h
  saturation.value = hsv.s
  value.value = hsv.v
}, { immediate: true })

watch(open, (isOpen) => {
  if (!isOpen) {
    advanced.value = false
  }
})

function chooseIcon(name: string): void {
  emit('update:icon', name)
}

function updateHue(next: number): void {
  hue.value = next
  emitColor()
}

function updateSaturationValue(event: PointerEvent): void {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  saturation.value = clamp(((event.clientX - bounds.left) / bounds.width) * 100)
  value.value = clamp((1 - (event.clientY - bounds.top) / bounds.height) * 100)
  emitColor()
}

function updateHex(value: string): void {
  const normalized = normalizeHex(value)
  if (normalized) {
    emit('update:color', normalized)
  }
}

function emitColor(): void {
  emit('update:color', hsvToHex(hue.value, saturation.value, value.value))
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function normalizeHex(value: string): string | null {
  const text = value.trim().toLowerCase()
  const expanded = /^#[0-9a-f]{3}$/.test(text)
    ? `#${text.slice(1).split('').map(char => char + char).join('')}`
    : text
  return /^#[0-9a-f]{6}$/.test(expanded) ? expanded : null
}

function hsvToHex(h: number, s: number, v: number): string {
  const saturationValue = clamp(s) / 100
  const brightness = clamp(v) / 100
  const chroma = brightness * saturationValue
  const segment = ((h % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs(segment % 2 - 1))
  const [r1, g1, b1] = segment < 1
    ? [chroma, x, 0]
    : segment < 2
      ? [x, chroma, 0]
      : segment < 3
        ? [0, chroma, x]
        : segment < 4
          ? [0, x, chroma]
          : segment < 5
            ? [x, 0, chroma]
            : [chroma, 0, x]
  const m = brightness - chroma
  return `#${[r1, g1, b1].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

function hexToHsv(value: string): { h: number, s: number, v: number } | null {
  const hex = normalizeHex(value)
  if (!hex) {
    return null
  }
  const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const max = Math.max(r!, g!, b!)
  const min = Math.min(r!, g!, b!)
  const delta = max - min
  const h = delta === 0
    ? 0
    : max === r
      ? 60 * (((g! - b!) / delta) % 6)
      : max === g
        ? 60 * ((b! - r!) / delta + 2)
        : 60 * ((r! - g!) / delta + 4)
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max * 100, v: max * 100 }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <Button type="button" variant="outline" class="h-10 w-full justify-start gap-2" :disabled="disabled">
        <component :is="selectedIcon" class="size-4" :style="{ color }" />
        <span class="truncate font-mono text-xs">{{ icon }}</span>
        <span v-if="!iconKnown" class="ml-auto text-[10px] text-amber-600">{{ $t('facets.fallback') }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent align="start" :side-offset="8" class="z-[9999] w-[min(38rem,calc(100vw-2rem))] rounded-lg border bg-background p-3 shadow-md outline-none">
        <div class="grid min-h-80 grid-cols-[minmax(0,1fr)_2.75rem] gap-3">
          <div class="flex min-w-0 flex-col gap-2">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input v-model="query" class="h-8 pl-8 text-xs" placeholder="Поиск по Lucide name / identity" />
            </div>
            <div class="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto pr-1">
              <button
                v-for="([name, iconComponent]) in filteredIcons"
                :key="name"
                type="button"
                class="flex size-9 items-center justify-center rounded border transition-colors hover:bg-accent"
                :class="name === icon ? 'border-primary bg-primary/10' : 'border-transparent'"
                :title="name"
                @click="chooseIcon(name)"
              >
                <component :is="iconComponent" class="size-4" :style="{ color }" />
              </button>
            </div>
          </div>
          <div class="flex min-h-0 flex-col items-center gap-2">
            <input
              :value="hue"
              type="range"
              min="0"
              max="359"
              aria-label="Hue"
              class="min-h-0 w-9 flex-1 cursor-pointer appearance-none rounded border [background:linear-gradient(to_bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] [writing-mode:vertical-lr]"
              @input="updateHue(Number(($event.target as HTMLInputElement).value))"
            >
            <PopoverRoot v-model:open="advanced">
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  class="size-9 shrink-0"
                  :aria-label="$t('facets.advancedColor')"
                  :aria-pressed="advanced"
                  :title="$t('facets.advancedColor')"
                >
                  <Palette class="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  side="right"
                  align="end"
                  :side-offset="8"
                  :collision-padding="12"
                  class="z-[10000] w-64 rounded-lg border bg-background p-3 shadow-md outline-none"
                >
                  <div class="space-y-3">
                    <div class="flex items-center gap-2 text-xs font-medium">
                      <Palette class="size-4 text-muted-foreground" />
                      <span>{{ $t('facets.advancedColor') }}</span>
                    </div>
                    <div
                      class="relative h-36 cursor-crosshair rounded border"
                      :style="{ backgroundColor: `hsl(${hue} 100% 50%)`, backgroundImage: 'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent)' }"
                      @pointerdown="updateSaturationValue"
                      @pointermove.left="updateSaturationValue"
                    >
                      <span class="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow" :style="{ left: `${saturation}%`, bottom: `${value}%` }" />
                    </div>
                    <div class="space-y-2">
                      <label class="text-xs text-muted-foreground">{{ $t('facets.hex') }}</label>
                      <Input :model-value="color" class="h-8 font-mono text-xs" @change="updateHex(($event.target as HTMLInputElement).value)" />
                      <div class="h-8 rounded border" :style="{ backgroundColor: color }" />
                    </div>
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
