<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'

import { SFC_RuntimeRenderer } from '@endge/vue'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { UI_EDITOR_BREAKPOINTS } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import { UIEditorRuntimePreviewSession } from '@/features/endge-admin-ui-editor/entities/ui-editor-runtime-preview'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const session = new UIEditorRuntimePreviewSession()
const refreshTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const breakpoint = computed(() => UI_EDITOR_BREAKPOINTS.find(item => item.id === props.state.activeBreakpoint) ?? UI_EDITOR_BREAKPOINTS[0]!)
const surfaceStyle = computed(() => breakpoint.value.id === 'desktop'
  ? { width: '100%', minHeight: '100%' }
  : { width: `${breakpoint.value.width}px`, minHeight: '100%' })
const statusLabel = computed(() => {
  if (session.status.value === 'preparing') {
    return 'Preparing runtime'
  }
  if (session.status.value === 'stale') {
    return 'Last valid preview'
  }
  if (session.status.value === 'error') {
    return 'Preview unavailable'
  }
  return 'Runtime preview'
})

function scheduleRefresh(): void {
  session.markStale()
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
  }
  refreshTimer.value = setTimeout(() => {
    refreshTimer.value = null
    void session.launch(props.state.source)
  }, 320)
}

function restart(): void {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
    refreshTimer.value = null
  }
  void session.launch(props.state.source)
}

watch(() => props.state.source, scheduleRefresh)
onMounted(restart)
onBeforeUnmount(() => {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value)
  }
  void session.dispose()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-background">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/20 px-3">
      <span
        class="size-1.5 rounded-full"
        :class="{
          'bg-emerald-500': session.status.value === 'active',
          'bg-amber-500': session.status.value === 'stale',
          'bg-destructive': session.status.value === 'error',
          'animate-pulse bg-sky-500': session.status.value === 'preparing',
          'bg-muted-foreground/40': session.status.value === 'idle',
        }"
      />
      <span class="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
        {{ statusLabel }}
      </span>
      <Button
        variant="ghost"
        size="icon"
        class="size-7"
        title="Restart runtime preview"
        :disabled="session.status.value === 'preparing'"
        @click="restart"
      >
        <RefreshCw class="size-3.5" />
      </Button>
      <span class="min-w-0 flex-1" />
    </header>

    <div class="relative min-h-0 flex-1 overflow-auto p-3">
      <div
        v-if="session.error.value"
        class="sticky top-0 z-20 mb-3 flex items-start gap-2 border border-amber-500/30 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur dark:bg-amber-950/90 dark:text-amber-100"
      >
        <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
        <span>{{ session.error.value }}</span>
      </div>

      <div
        v-if="session.status.value === 'preparing' && !session.runtime.value"
        class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <LoaderCircle class="size-4 animate-spin" />
        Building preview runtime…
      </div>

      <div
        v-if="session.runtime.value"
        class="mx-auto min-h-full"
        :style="surfaceStyle"
      >
        <SFC_RuntimeRenderer
          :host="session.runtime.value"
          :input="session.input.value"
        />
      </div>
    </div>
  </section>
</template>
