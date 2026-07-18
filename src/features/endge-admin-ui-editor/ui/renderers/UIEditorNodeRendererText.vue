<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

defineProps<{
  node: UIEditorNode<'text'>
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()
</script>

<template>
  <div
    class="rounded border px-3 py-2"
    :class="preview ? 'border-amber-200/80 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-950/30' : 'border-amber-300/70 bg-amber-50/95 dark:border-amber-700/70 dark:bg-amber-950/40'"
  >
    <div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/90 dark:text-amber-300/90">
      {{ definition?.title ?? 'Text' }}
    </div>
    <div class="mt-1 text-sm font-medium leading-5 text-amber-950 dark:text-amber-100">
      {{ node.props.text }}
    </div>
  </div>
</template>
