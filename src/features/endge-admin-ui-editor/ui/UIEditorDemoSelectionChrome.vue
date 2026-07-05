<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type UIEditorChromeHandle = 'north' | 'east' | 'south' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west'

const props = withDefaults(defineProps<{
  label: string
  sizeLabel?: string
  showDelete?: boolean
  showHandles?: boolean
  labelPlacement?: 'inside' | 'outside'
  interactiveHandles?: UIEditorChromeHandle[]
  dragHandles?: UIEditorChromeHandle[]
}>(), {
  sizeLabel: '',
  showDelete: false,
  showHandles: true,
  labelPlacement: 'inside',
  interactiveHandles: () => [],
  dragHandles: () => [],
})

const emit = defineEmits<{
  delete: []
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
    <div class="absolute inset-0 border border-sky-500/90 bg-transparent shadow-[0_0_0_1px_rgba(59,130,246,0.12)]" />

    <div
      class="absolute inline-flex items-center rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
      :class="labelClasses"
    >
      {{ label }}
    </div>

    <div
      v-if="sizeLabel"
      class="absolute bottom-1.5 right-1.5 inline-flex items-center rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
    >
      {{ sizeLabel }}
    </div>

    <Tooltip v-if="showDelete">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="pointer-events-auto absolute right-1.5 top-1.5 h-5 w-5 rounded-full border border-sky-200 bg-white p-0 text-sky-700 shadow-sm hover:border-destructive/40 hover:text-destructive"
          @click.stop="emit('delete')"
        >
          <Trash2 class="size-2.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Удалить блок</TooltipContent>
    </Tooltip>

    <template v-if="showHandles" v-for="handle in handles" :key="handle.id">
      <button
        v-if="interactiveHandleSet.has(handle.id) || dragHandleSet.has(handle.id)"
        type="button"
        class="pointer-events-auto absolute flex h-3 w-3 items-center justify-center rounded-full border border-sky-500 bg-white shadow-sm"
        :class="[handle.className, dragHandleSet.has(handle.id) ? 'cursor-move' : handle.cursorClass]"
        @mousedown.stop.prevent="onHandleMouseDown(handle.id, $event)"
      />

      <div
        v-else
        class="absolute h-3 w-3 rounded-full border border-sky-500 bg-white shadow-sm"
        :class="handle.className"
      />
    </template>
  </div>
</template>
