<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

import { computed } from 'vue'

import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCContentPreview,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'

const props = defineProps<{
  node: UIEditorNode<'custom-component'>
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()

const label = computed(() => getUIEditorSFCContentPreview(props.node) || 'Badge')
const tone = computed(() => {
  const binding = getUIEditorSFCAttributeBindings(props.node).find(candidate => candidate.name === 'tone')
  return binding?.resolved ? String(binding.previewValue ?? '').toLowerCase() : 'neutral'
})
const toneClass = computed(() => {
  switch (tone.value) {
    case 'success':
    case 'positive':
      return 'border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
    case 'warning':
      return 'border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300'
    case 'danger':
    case 'destructive':
    case 'error':
      return 'border-red-500/25 bg-red-500/12 text-red-700 dark:text-red-300'
    case 'info':
      return 'border-sky-500/25 bg-sky-500/12 text-sky-700 dark:text-sky-300'
    default:
      return 'border-border/70 bg-muted/55 text-foreground/75'
  }
})
</script>

<template>
  <div class="flex min-h-8 w-full items-center px-2 py-1.5">
    <span
      class="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-medium leading-4"
      :class="toneClass"
    >
      {{ label }}
    </span>
  </div>
</template>
