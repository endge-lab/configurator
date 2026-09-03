<script setup lang="ts" generic="TValue extends string">
import type { ComponentPublicInstance, HTMLAttributes } from 'vue'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { cn } from '@/shared/tools/utils'
import { Tabs } from '@/shared/ui/tabs'

const props = withDefaults(defineProps<{
  modelValue: TValue
  sidebarWidth: number
  defaultSidebarWidth?: number
  minSidebarWidth?: number
  maxSidebarWidth?: number
  separatorLabel?: string
  class?: HTMLAttributes['class']
  navigationClass?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
}>(), {
  defaultSidebarWidth: 240,
  minSidebarWidth: 192,
  maxSidebarWidth: 420,
  separatorLabel: 'Изменить ширину меню настроек',
})

const emit = defineEmits<{
  'update:modelValue': [value: TValue]
  'update:sidebarWidth': [value: number]
}>()

const SPLITTER_WIDTH = 7
const MIN_CONTENT_WIDTH = 320
const KEYBOARD_STEP = 16

const root = ref<ComponentPublicInstance | null>(null)
const containerWidth = ref(0)
const sidebarWidthDraft = ref(props.sidebarWidth)
const isResizing = ref(false)
let resizeObserver: ResizeObserver | null = null
let resizeStartX = 0
let resizeStartWidth = 0

const activeSection = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const availableMaximum = computed(() => {
  if (!containerWidth.value) {
    return props.maxSidebarWidth
  }

  return Math.max(
    props.minSidebarWidth,
    Math.min(
      props.maxSidebarWidth,
      containerWidth.value - MIN_CONTENT_WIDTH - SPLITTER_WIDTH,
    ),
  )
})

const displayedSidebarWidth = computed(() => clampWidth(sidebarWidthDraft.value))

watch(() => props.sidebarWidth, (width) => {
  if (!isResizing.value) {
    sidebarWidthDraft.value = width
  }
})

function clampWidth(width: number): number {
  const normalized = Number.isFinite(width) ? width : props.defaultSidebarWidth
  return Math.round(Math.min(availableMaximum.value, Math.max(props.minSidebarWidth, normalized)))
}

function beginResize(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  resizeStartX = event.clientX
  resizeStartWidth = displayedSidebarWidth.value
  isResizing.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('pointercancel', endResize)
}

function resize(event: PointerEvent): void {
  if (!isResizing.value) {
    return
  }
  sidebarWidthDraft.value = clampWidth(resizeStartWidth + event.clientX - resizeStartX)
}

function endResize(): void {
  if (!isResizing.value) {
    return
  }

  isResizing.value = false
  emit('update:sidebarWidth', displayedSidebarWidth.value)
  removeResizeListeners()
}

function removeResizeListeners(): void {
  window.removeEventListener('pointermove', resize)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('pointercancel', endResize)
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

function resetWidth(): void {
  sidebarWidthDraft.value = clampWidth(props.defaultSidebarWidth)
  emit('update:sidebarWidth', displayedSidebarWidth.value)
}

function resizeByKeyboard(event: KeyboardEvent): void {
  const step = event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP
  let nextWidth: number | null = null

  if (event.key === 'ArrowLeft') {
    nextWidth = displayedSidebarWidth.value - step
  }
  else if (event.key === 'ArrowRight') {
    nextWidth = displayedSidebarWidth.value + step
  }
  else if (event.key === 'Home') {
    nextWidth = props.minSidebarWidth
  }
  else if (event.key === 'End') {
    nextWidth = availableMaximum.value
  }

  if (nextWidth == null) {
    return
  }
  event.preventDefault()
  sidebarWidthDraft.value = clampWidth(nextWidth)
  emit('update:sidebarWidth', displayedSidebarWidth.value)
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  resizeObserver = new ResizeObserver(([entry]) => {
    containerWidth.value = entry?.contentRect.width ?? 0
  })
  const rootElement = root.value?.$el
  if (rootElement instanceof HTMLElement) {
    resizeObserver.observe(rootElement)
  }
})

onBeforeUnmount(() => {
  if (isResizing.value) {
    emit('update:sidebarWidth', displayedSidebarWidth.value)
  }
  isResizing.value = false
  removeResizeListeners()
  resizeObserver?.disconnect()
})
</script>

<template>
  <Tabs
    ref="root"
    v-model="activeSection"
    orientation="vertical"
    :class="cn(
      'settings-navigation-panel flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs lg:flex-row',
      props.class,
    )"
  >
    <aside
      :class="cn(
        'hidden min-h-0 shrink-0 overflow-hidden overscroll-none bg-muted/25 lg:flex lg:flex-col',
        props.navigationClass,
      )"
      :style="{
        width: `${displayedSidebarWidth}px`,
        flexBasis: `${displayedSidebarWidth}px`,
      }"
    >
      <slot name="navigation" />
    </aside>

    <div
      class="settings-navigation-panel__separator hidden lg:flex"
      :data-resizing="isResizing"
      role="separator"
      :aria-label="separatorLabel"
      aria-orientation="vertical"
      :aria-valuenow="displayedSidebarWidth"
      :aria-valuemin="minSidebarWidth"
      :aria-valuemax="availableMaximum"
      tabindex="0"
      title="Перетащите для изменения ширины. Двойной клик — ширина по умолчанию."
      @dblclick="resetWidth"
      @pointerdown="beginResize"
      @keydown="resizeByKeyboard"
    >
      <span />
    </div>

    <main
      :class="cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/35',
        props.contentClass,
      )"
    >
      <slot />
    </main>
  </Tabs>
</template>

<style scoped>
.settings-navigation-panel__separator {
  position: relative;
  z-index: 2;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  border-right: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  cursor: ew-resize;
  outline: none;
  touch-action: none;
}

.settings-navigation-panel__separator span {
  width: 2px;
  height: 30px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted-foreground) 34%, transparent);
  transition: height 120ms ease, background-color 120ms ease;
}

.settings-navigation-panel__separator:hover span,
.settings-navigation-panel__separator:focus-visible span,
.settings-navigation-panel__separator[data-resizing='true'] span {
  height: 46px;
  background: var(--primary);
}
</style>
