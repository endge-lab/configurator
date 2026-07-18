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
  <div class="min-h-8 w-full whitespace-pre-wrap px-2 py-1.5 text-sm leading-5 text-foreground">
    {{ node.props.text }}
  </div>
</template>
