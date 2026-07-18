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
    class="flex min-h-8 w-full items-center whitespace-pre-wrap px-2 py-1.5 text-sm leading-5 text-foreground"
    :class="node.props.text ? '' : 'text-muted-foreground/70'"
  >
    {{ node.props.text || 'Empty text' }}
  </div>
</template>
