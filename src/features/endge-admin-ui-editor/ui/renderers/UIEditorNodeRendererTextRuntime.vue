<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

defineProps<{
  node: UIEditorNode
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()
</script>

<template>
  <div class="relative overflow-hidden rounded border border-sky-200/80 bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(240,249,255,0.9))] px-4 py-3 shadow-sm dark:border-sky-800/70 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.72),rgba(15,23,42,0.94))]">
    <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700/80 dark:text-sky-300/85">
      {{ definition?.title ?? 'Text' }} Preview
    </div>
    <div class="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
      {{ node.props.text }}
    </div>
  </div>
</template>
