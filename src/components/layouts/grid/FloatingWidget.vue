<script setup lang="ts">
import type { FloatingWidgetState, WidgetDefinition, WidgetDefinitionState, WidgetInstance } from '@/components/layouts/grid/types.ts'
import { computed, ref } from 'vue'
import WidgetContainer from '@/components/layouts/grid/WidgetContainer.vue'

const props = defineProps<{
  definition: WidgetDefinition & WidgetDefinitionState
  instances: WidgetInstance[]
  state?: FloatingWidgetState
}>()

const emit = defineEmits<{
  'update:state': [updates: Partial<FloatingWidgetState>]
  'focus': []
}>()

const widgetRef = ref<HTMLElement>()
const isDragging = ref(false)
const isResizing = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const resizeDirection = ref<string | null>(null)
const initialSize = ref({ width: 0, height: 0 })
const initialPos = ref({ x: 0, y: 0 })

const style = computed(() => {
  if (!props.state)
    return {}

  return {
    left: `${props.state.x}px`,
    top: `${props.state.y}px`,
    width: `${props.state.width}px`,
    height: `${props.state.height}px`,
    zIndex: props.state.zIndex,
    display: props.state.minimized ? 'none' : 'flex',
    userSelect: (isDragging.value || isResizing.value) ? 'none' as const : undefined,
  }
})

const constraints = computed(() => props.definition.floatingConstraints ?? {})

function handleMouseDown(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('[data-resize-handle]'))
    return

  emit('focus')
  isDragging.value = true

  const rect = widgetRef.value?.getBoundingClientRect()
  if (rect) {
    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    const x = Math.max(0, event.clientX - dragOffset.value.x)
    const y = Math.max(0, event.clientY - dragOffset.value.y)
    emit('update:state', { x, y })
  }
  else if (isResizing.value && resizeDirection.value) {
    handleResize(event)
  }
}

function handleMouseUp() {
  isDragging.value = false
  isResizing.value = false
  resizeDirection.value = null
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

function handleResizeStart(event: MouseEvent, direction: string) {
  event.stopPropagation()
  event.preventDefault()
  emit('focus')
  isResizing.value = true
  resizeDirection.value = direction
  initialSize.value = {
    width: props.state?.width ?? 400,
    height: props.state?.height ?? 300,
  }
  initialPos.value = {
    x: props.state?.x ?? 0,
    y: props.state?.y ?? 0,
  }
  dragOffset.value = { x: event.clientX, y: event.clientY }

  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleResize(event: MouseEvent) {
  const dx = event.clientX - dragOffset.value.x
  const dy = event.clientY - dragOffset.value.y
  const dir = resizeDirection.value

  let newWidth = initialSize.value.width
  let newHeight = initialSize.value.height
  let newX = initialPos.value.x
  let newY = initialPos.value.y

  const minWidth = constraints.value.minWidth ?? 100
  const maxWidth = constraints.value.maxWidth ?? Infinity
  const minHeight = constraints.value.minHeight ?? 100
  const maxHeight = constraints.value.maxHeight ?? Infinity

  if (dir?.includes('e')) {
    newWidth = Math.min(maxWidth, Math.max(minWidth, initialSize.value.width + dx))
  }
  if (dir?.includes('w')) {
    const proposedWidth = initialSize.value.width - dx
    const clampedWidth = Math.min(maxWidth, Math.max(minWidth, proposedWidth))
    const actualDx = initialSize.value.width - clampedWidth
    newWidth = clampedWidth
    newX = initialPos.value.x + actualDx
  }
  if (dir?.includes('s')) {
    newHeight = Math.min(maxHeight, Math.max(minHeight, initialSize.value.height + dy))
  }
  if (dir?.includes('n')) {
    const proposedHeight = initialSize.value.height - dy
    const clampedHeight = Math.min(maxHeight, Math.max(minHeight, proposedHeight))
    const actualDy = initialSize.value.height - clampedHeight
    newHeight = clampedHeight
    newY = initialPos.value.y + actualDy
  }

  emit('update:state', { width: newWidth, height: newHeight, x: newX, y: newY })
}

function handleClick() {
  emit('focus')
}
</script>

<template>
  <div
    ref="widgetRef"
    class="fixed bg-background rounded-lg border border-border shadow-lg flex flex-col pointer-events-auto overflow-hidden"
    :style="style"
    @mousedown="handleClick"
  >
    <WidgetContainer
      :definition="definition"
      :instances="instances"
      position="floating"
      @header-mousedown="handleMouseDown"
    />

    <!-- Overlay to prevent iframe from capturing mouse events during drag/resize -->
    <div
      v-if="isDragging || isResizing"
      class="absolute inset-0 z-10"
    />

    <!-- Ручки ресайза поверх контента (z-20), область захвата 8px -->
    <div
      data-resize-handle
      class="absolute top-0 left-0 z-20 w-2 h-full cursor-ew-resize hover:bg-primary/10"
      @mousedown="handleResizeStart($event, 'w')"
    />
    <div
      data-resize-handle
      class="absolute top-0 right-0 z-20 w-2 h-full cursor-ew-resize hover:bg-primary/10"
      @mousedown="handleResizeStart($event, 'e')"
    />
    <div
      data-resize-handle
      class="absolute top-0 left-0 z-20 h-2 w-full cursor-ns-resize hover:bg-primary/10"
      @mousedown="handleResizeStart($event, 'n')"
    />
    <div
      data-resize-handle
      class="absolute bottom-0 left-0 z-20 h-2 w-full cursor-ns-resize hover:bg-primary/10"
      @mousedown="handleResizeStart($event, 's')"
    />
    <div
      data-resize-handle
      class="absolute top-0 left-0 z-20 w-2 h-2 cursor-nwse-resize hover:bg-primary/10 rounded-bl"
      @mousedown="handleResizeStart($event, 'nw')"
    />
    <div
      data-resize-handle
      class="absolute top-0 right-0 z-20 w-2 h-2 cursor-nesw-resize hover:bg-primary/10 rounded-br"
      @mousedown="handleResizeStart($event, 'ne')"
    />
    <div
      data-resize-handle
      class="absolute bottom-0 left-0 z-20 w-2 h-2 cursor-nesw-resize hover:bg-primary/10 rounded-tl"
      @mousedown="handleResizeStart($event, 'sw')"
    />
    <div
      data-resize-handle
      class="absolute bottom-0 right-0 z-20 w-2 h-2 cursor-nwse-resize hover:bg-primary/10 rounded-tl"
      @mousedown="handleResizeStart($event, 'se')"
    />
  </div>
</template>
