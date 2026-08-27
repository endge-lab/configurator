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
  <div class="min-h-full w-full">
    <slot />
  </div>
</template>
