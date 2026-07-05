<script setup lang="ts">
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'

defineProps<{
  node: UIEditorNode
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()
</script>

<template>
  <div
    class="rounded border px-3 py-2"
    :class="preview ? 'border-amber-200/80 bg-amber-50/70' : 'border-amber-300/70 bg-amber-50/95'"
  >
    <div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/90">
      {{ definition?.title ?? 'Text' }}
    </div>
    <div class="mt-1 text-sm font-medium leading-5 text-amber-950">
      {{ node.props.text }}
    </div>
  </div>
</template>
