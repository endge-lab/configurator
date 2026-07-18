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
  <div class="flex min-h-8 items-center justify-start px-2 py-1">
    <button
      type="button"
      class="inline-flex items-center rounded-sm bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    >
      {{ node.props.label }}
    </button>
  </div>
</template>
