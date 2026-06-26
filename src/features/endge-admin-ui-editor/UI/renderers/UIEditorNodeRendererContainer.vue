<script setup lang="ts">
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import { computed } from 'vue'

const props = defineProps<{
  node: UIEditorNode
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()

const metaLabel = computed(() => {
  if (props.node.kind === 'flex') {
    return props.node.props.direction === 'row'
      ? `row · gap ${props.node.props.gap}`
      : `column · gap ${props.node.props.gap}`
  }

  if (props.node.kind === 'grid') {
    return `${props.node.props.columns} cols · gap ${props.node.props.gap}`
  }

  if (props.definition?.configKind) {
    return `config-backed · ${props.definition.configKind}`
  }

  return props.node.definitionRef
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700/85">
          {{ definition?.title ?? node.name }}
        </div>
        <div class="truncate text-xs text-slate-600">
          {{ metaLabel }}
        </div>
      </div>

      <div
        v-if="node.kind === 'box'"
        class="truncate rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
      >
        {{ node.props.title }}
      </div>
    </div>

    <div
      class="rounded border border-dashed border-border/70 bg-background/60 p-2"
      :class="preview ? 'bg-slate-50/70' : 'bg-white/70'"
    >
      <slot />
    </div>
  </div>
</template>
