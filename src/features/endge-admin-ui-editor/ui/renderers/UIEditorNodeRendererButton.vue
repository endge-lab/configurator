<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

defineProps<{
  node: UIEditorNode<'button'>
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()
</script>

<template>
  <div class="flex items-start justify-start">
    <button
      type="button"
      class="inline-flex items-center rounded-sm bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    >
      {{ node.props.label }}
    </button>
    <span class="ml-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700/80 dark:text-sky-300/85">
      {{ definition?.title ?? 'Button' }}
    </span>
  </div>
</template>
