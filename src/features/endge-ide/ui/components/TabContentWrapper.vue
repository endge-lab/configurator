<script setup lang="ts">
import type { SmartTabRef } from '@/features/endge-ide/ui/smart-tabs/types'

import { Endge } from '@endge/core'
import { computed } from 'vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

import { warnDebuggerEditAttempt } from '@/features/endge-ide/tools/warn-debugger-read-only'

const props = defineProps<{
  tab: SmartTabRef | null
}>()

const view = computed(() => {
  if (!props.tab) {
    return null
  }
  return EndgeIDE.tabs.getViewForTab(props.tab)
})
function preventInput(event: Event): void {
  if (Endge.mode !== 'debugger') {
    return
  }
  const target = event.target
  if (!(target instanceof Element) || target.closest('.monaco-editor')) {
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  warnDebuggerEditAttempt()
}
function preventControlChange(event: MouseEvent): void {
  if (Endge.mode !== 'debugger') {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest('select, input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"], [role="combobox"]')) {
    event.preventDefault()
    event.stopImmediatePropagation()
    warnDebuggerEditAttempt()
  }
}

function preventSourceEdit(event: KeyboardEvent): void {
  const target = event.target
  if (Endge.mode !== 'debugger' || !(target instanceof Element) || !target.closest('.monaco-editor') || target.closest('.find-widget')) {
    return
  }
  const modifier = event.ctrlKey || event.metaKey
  const edits = (!modifier && !event.altKey && event.key.length === 1)
    || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter'
    || (modifier && ['v', 'x'].includes(event.key.toLowerCase()))
  if (edits) {
    event.preventDefault()
    event.stopImmediatePropagation()
    warnDebuggerEditAttempt()
  }
}
</script>

<template>
  <div v-if="view" class="flex h-full min-h-0 w-full flex-col overflow-hidden" @beforeinput.capture="preventInput" @click.capture="preventControlChange" @keydown.capture="preventSourceEdit">
    <component
      :is="view.component"
      v-bind="view.props"
      class="min-h-0 flex-1"
    />
  </div>
  <div
    v-else
    class="h-full p-4 text-sm text-muted-foreground"
  >
    {{ $t('uiText.noDataForTab9c4b4a5b') }}
  </div>
</template>
