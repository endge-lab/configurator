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
  <div class="relative overflow-hidden rounded border border-sky-200/80 bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(240,249,255,0.9))] px-4 py-3 shadow-sm">
    <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700/80">
      {{ definition?.title ?? 'Text' }} Preview
    </div>
    <div class="text-base font-semibold leading-6 text-slate-900">
      {{ node.props.text }}
    </div>
  </div>
</template>
