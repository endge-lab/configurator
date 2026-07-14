<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  outputVisible?: boolean
  minPrimary?: number
  maxPrimary?: number
  separatorLabel?: string
}>(), {
  outputVisible: false,
  minPrimary: 0.4,
  maxPrimary: 0.82,
  separatorLabel: 'Изменить ширину редактора и output',
})

const ratio = defineModel<number>('ratio', { default: 0.7 })
const container = ref<HTMLDivElement | null>(null)
const dragging = ref(false)

function clamp(value: number): number {
  return Math.max(props.minPrimary, Math.min(props.maxPrimary, value))
}

function setRatio(value: number): void {
  ratio.value = clamp(value)
}

function adjustRatio(delta: number): void {
  setRatio(ratio.value + delta)
}

function startDragging(event: MouseEvent): void {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  dragging.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
}

function updateRatio(event: MouseEvent): void {
  if (!dragging.value || !container.value) {
    return
  }

  const rect = container.value.getBoundingClientRect()
  if (!rect.width) {
    return
  }

  setRatio((event.clientX - rect.left) / rect.width)
}

function stopDragging(): void {
  dragging.value = false
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

onMounted(() => {
  document.addEventListener('mousemove', updateRatio)
  document.addEventListener('mouseup', stopDragging)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', updateRatio)
  document.removeEventListener('mouseup', stopDragging)
  stopDragging()
})
</script>

<template>
  <div ref="container" class="source-editor-split-view">
    <section
      class="source-editor-split-view__primary"
      :data-split="outputVisible"
      :style="outputVisible ? { width: `${clamp(ratio) * 100}%` } : undefined"
    >
      <slot name="editor" />
    </section>

    <template v-if="outputVisible">
      <div
        class="source-editor-split-view__separator"
        role="separator"
        :aria-label="separatorLabel"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(clamp(ratio) * 100)"
        :aria-valuemin="Math.round(minPrimary * 100)"
        :aria-valuemax="Math.round(maxPrimary * 100)"
        tabindex="0"
        @mousedown="startDragging"
        @keydown.left.prevent="adjustRatio(-0.03)"
        @keydown.right.prevent="adjustRatio(0.03)"
      >
        <div class="source-editor-split-view__handle" />
      </div>

      <aside class="source-editor-split-view__output">
        <slot name="output" />
      </aside>
    </template>
  </div>
</template>

<style scoped>
.source-editor-split-view {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  background: #1e1e1e;
}

.source-editor-split-view__primary {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.source-editor-split-view__primary[data-split='true'] {
  flex: 0 0 auto;
}

.source-editor-split-view__separator {
  position: relative;
  z-index: 2;
  display: flex;
  width: 7px;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  background: rgb(15 23 42);
  outline: none;
}

.source-editor-split-view__separator:hover,
.source-editor-split-view__separator:focus-visible {
  background: rgb(30 41 59);
}

.source-editor-split-view__handle {
  width: 2px;
  height: 34px;
  border-radius: 999px;
  background: rgb(71 85 105);
}

.source-editor-split-view__separator:hover .source-editor-split-view__handle,
.source-editor-split-view__separator:focus-visible .source-editor-split-view__handle {
  background: rgb(56 189 248 / 0.75);
}

.source-editor-split-view__output {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  background: rgb(15 23 42);
}
</style>
