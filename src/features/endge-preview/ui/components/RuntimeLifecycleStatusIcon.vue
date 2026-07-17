<script setup lang="ts">
import type { PreviewLifecycleState } from '@/features/endge-preview/domain/types/preview.types'

import { CircleAlert, LoaderCircle, Pause, Play, Square } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{ state: PreviewLifecycleState }>()

const presentation = computed(() => {
  switch (props.state) {
    case 'active': return { icon: Play, label: 'Запущено', className: 'text-emerald-500' }
    case 'paused': return { icon: Pause, label: 'На паузе', className: 'text-amber-500' }
    case 'activating': return { icon: LoaderCircle, label: 'Запускается', className: 'animate-spin text-sky-500' }
    case 'pausing': return { icon: LoaderCircle, label: 'Останавливается', className: 'animate-spin text-amber-500' }
    case 'error': return { icon: CircleAlert, label: 'Ошибка', className: 'text-destructive' }
    case 'disposed': return { icon: Square, label: 'Завершено', className: 'text-muted-foreground/45' }
    default: return { icon: Square, label: 'Не запущено', className: 'text-muted-foreground/65' }
  }
})
</script>

<template>
  <span
    class="inline-flex size-5 shrink-0 items-center justify-center pointer-events-none"
    :title="presentation.label"
    :aria-label="presentation.label"
  >
    <component :is="presentation.icon" class="size-3.5" :class="presentation.className" stroke-width="2" />
  </span>
</template>
