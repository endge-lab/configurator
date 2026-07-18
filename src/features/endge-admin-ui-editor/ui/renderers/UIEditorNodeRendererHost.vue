<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

import { Blocks } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  node: UIEditorNode
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()

const metaLine = computed(() => {
  const sourceLabel = String(props.node.meta?.sourceLabel ?? '').trim()
  if (sourceLabel) {
    return sourceLabel
  }

  const sourceType = String(props.node.meta?.sourceType ?? '').trim()
  if (sourceType === 'preset') {
    return 'Preset component'
  }
  if (sourceType === 'jsx') {
    return 'JSX component'
  }
  return String((props.node.props as Record<string, unknown>).rendererRef ?? props.node.definitionRef)
})
</script>

<template>
  <div class="flex min-h-10 items-center gap-2 border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-muted-foreground">
    <Blocks class="size-3.5 shrink-0" />
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-medium text-foreground/85">
        {{ definition?.title ?? node.name }}
      </div>
      <div class="truncate font-mono text-[10px] text-muted-foreground">
        {{ metaLine }}
      </div>
    </div>
  </div>
</template>
