<script setup lang="ts">
import { computed } from 'vue'

type UIEditorChromeHandle = 'north' | 'east' | 'south' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west'

const props = withDefaults(defineProps<{
  label: string
  sizeLabel?: string
  showHandles?: boolean
  labelPlacement?: 'inside' | 'outside'
  highlightSurface?: boolean
  editing?: boolean
  interactiveHandles?: UIEditorChromeHandle[]
  dragHandles?: UIEditorChromeHandle[]
}>(), {
  sizeLabel: '',
  showHandles: true,
  labelPlacement: 'inside',
  highlightSurface: false,
  editing: false,
  interactiveHandles: () => [],
  dragHandles: () => [],
})

const emit = defineEmits<{
  resizeHandle: [handle: UIEditorChromeHandle, event: MouseEvent]
  dragHandle: [handle: UIEditorChromeHandle, event: MouseEvent]
}>()

const handles: Array<{
  id: UIEditorChromeHandle
  className: string
  cursorClass: string
}> = [
  { id: 'north-west', className: '-left-1.5 -top-1.5', cursorClass: 'cursor-nwse-resize' },
  { id: 'north', className: 'left-1/2 -top-1.5 -translate-x-1/2', cursorClass: 'cursor-ns-resize' },
  { id: 'north-east', className: '-right-1.5 -top-1.5', cursorClass: 'cursor-nesw-resize' },
  { id: 'west', className: '-left-1.5 top-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
  { id: 'east', className: '-right-1.5 top-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
  { id: 'south-west', className: '-bottom-1.5 -left-1.5', cursorClass: 'cursor-nesw-resize' },
  { id: 'south', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-ns-resize' },
  { id: 'south-east', className: '-bottom-1.5 -right-1.5', cursorClass: 'cursor-nwse-resize' },
]

const interactiveHandleSet = computed(() => new Set(props.interactiveHandles))
const dragHandleSet = computed(() => new Set(props.dragHandles))
const labelClasses = computed(() =>
  props.labelPlacement === 'outside'
    ? '-top-5 left-0'
    : 'left-1.5 top-1.5',
)

function onHandleMouseDown(handle: UIEditorChromeHandle, event: MouseEvent): void {
  if (dragHandleSet.value.has(handle)) {
    emit('dragHandle', handle, event)
    return
  }

  if (!interactiveHandleSet.value.has(handle)) {
    return
  }

  emit('resizeHandle', handle, event)
}
</script>

<template>
  <div data-ui-editor-chrome="true" class="pointer-events-none absolute inset-0 z-30">
    <div
      class="absolute inset-0 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]"
      :class="highlightSurface
        ? 'border-2 border-sky-500/95 bg-sky-500/[0.035]'
        : 'border border-sky-500/90 bg-transparent'"
    />

    <div
      class="absolute inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
      :class="[labelClasses, editing ? 'bg-indigo-600' : 'bg-sky-500']"
    >
      {{ label }}
    </div>

    <div
      v-if="sizeLabel"
      class="absolute bottom-1.5 right-1.5 inline-flex items-center rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
    >
      {{ sizeLabel }}
    </div>

    <template v-if="showHandles">
      <template v-for="handle in handles" :key="handle.id">
        <button
          v-if="interactiveHandleSet.has(handle.id) || dragHandleSet.has(handle.id)"
          type="button"
          class="pointer-events-auto absolute flex h-3 w-3 items-center justify-center rounded-full border border-sky-500 bg-white shadow-sm dark:border-sky-400 dark:bg-slate-950"
          :class="[handle.className, dragHandleSet.has(handle.id) ? 'cursor-move' : handle.cursorClass]"
          @mousedown.stop.prevent="onHandleMouseDown(handle.id, $event)"
        />

        <div
          v-else
          class="absolute h-3 w-3 rounded-full border border-sky-500 bg-white shadow-sm dark:border-sky-400 dark:bg-slate-950"
          :class="handle.className"
        />
      </template>
    </template>
  </div>
</template>
