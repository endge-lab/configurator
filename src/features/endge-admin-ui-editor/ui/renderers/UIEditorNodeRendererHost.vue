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

const badge = computed(() => {
  if (!props.definition) {
    return 'Definition'
  }

  return props.definition.configKind
    ? `Definition · ${props.definition.configKind}`
    : 'Definition'
})
</script>

<template>
  <div
    class="border border-dashed px-3 py-2.5"
    :class="preview ? 'border-cyan-200/90 bg-cyan-50/70 dark:border-cyan-700/60 dark:bg-cyan-950/30' : 'border-cyan-300/80 bg-cyan-50/90 dark:border-cyan-700/70 dark:bg-cyan-950/35'"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="inline-flex items-center gap-1 rounded bg-cyan-600/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-300">
          <Blocks class="size-3" />
          <span>{{ badge }}</span>
        </div>

        <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ definition?.title ?? node.name }}
        </div>

        <div class="truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">
          {{ metaLine }}
        </div>

        <div class="text-xs text-slate-600/90 dark:text-slate-400">
          {{ definition?.stubDescription || 'Renderer host for configurable UI component.' }}
        </div>
      </div>
    </div>
  </div>
</template>
