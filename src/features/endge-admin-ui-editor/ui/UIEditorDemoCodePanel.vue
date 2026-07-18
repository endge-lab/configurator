<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const draftSource = ref(props.state.toSFCSource())
const sourceLinesCount = computed(() => draftSource.value.replace(/\n$/, '').split('\n').length)
let sourceApplyTimer: ReturnType<typeof window.setTimeout> | null = null

watch(
  () => props.state.source,
  (source) => {
    if (source !== draftSource.value) {
      draftSource.value = source
    }
  },
)

function updateSource(source: string): void {
  draftSource.value = source
  if (sourceApplyTimer != null) {
    window.clearTimeout(sourceApplyTimer)
  }
  sourceApplyTimer = window.setTimeout(() => {
    sourceApplyTimer = null
    props.state.applySFCSource(draftSource.value)
  }, 320)
}

onBeforeUnmount(() => {
  if (sourceApplyTimer != null) {
    window.clearTimeout(sourceApplyTimer)
    sourceApplyTimer = null
    props.state.applySFCSource(draftSource.value)
  }
})
</script>

<template>
  <aside class="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-slate-800 bg-[#292d3e] pt-12 text-slate-200">
    <ScriptEditor
      :model-value="draftSource"
      language="html"
      format-language="vue"
      :min-height="0"
      class="min-h-0 flex-1"
      @update:model-value="updateSource"
    />

    <div
      class="flex min-h-7 shrink-0 items-center justify-between gap-3 border-t px-3 font-mono text-[9px] uppercase tracking-[0.12em]"
      :class="props.state.sourceDiagnostics.length > 0
        ? 'border-rose-900/70 bg-rose-950/45 text-rose-300'
        : 'border-slate-800/90 bg-slate-950/50 text-slate-500'"
    >
      <span class="truncate normal-case tracking-normal">
        {{ props.state.sourceDiagnostics[0] ?? 'Visual synchronized' }}
      </span>
      <span class="shrink-0">{{ sourceLinesCount }} lines</span>
    </div>
  </aside>
</template>
