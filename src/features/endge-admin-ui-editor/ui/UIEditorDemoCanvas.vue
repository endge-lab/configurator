<script setup lang="ts">
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorDragPayload } from '@/features/endge-admin-ui-editor/types'

import { computed, ref } from 'vue'

import { UI_EDITOR_BREAKPOINTS, UI_EDITOR_DND_MIME } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import UIEditorDemoNode from '@/features/endge-admin-ui-editor/ui/UIEditorDemoNode.vue'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const rootDropHovered = ref(false)

const breakpoint = computed(() => UI_EDITOR_BREAKPOINTS.find(item => item.id === props.state.activeBreakpoint) ?? UI_EDITOR_BREAKPOINTS[0]!)
const canvasShellStyle = computed<Record<string, string>>(() => {
  if (breakpoint.value.id === 'desktop') {
    return {
      width: '100%',
      minHeight: '100%',
    }
  }
  return {
    width: `${breakpoint.value.width}px`,
    minHeight: '100%',
  }
})

function onRootDragover(event: DragEvent): void {
  event.preventDefault()
  rootDropHovered.value = true
}

function onRootDrop(event: DragEvent): void {
  event.preventDefault()
  rootDropHovered.value = false
  const raw = event.dataTransfer?.getData(UI_EDITOR_DND_MIME)
  try {
    const payload = props.state.dragPayload ?? (raw
      ? JSON.parse(raw) as UIEditorDragPayload
      : null)

    props.state.endGridInteraction()
    if (!payload) {
      return
    }

    const normalizedPayload = payload as UIEditorDragPayload
    if (normalizedPayload.source === 'palette') {
      props.state.addPaletteItem(normalizedPayload, props.state.document.rootId)
    }
    if (normalizedPayload.source === 'node' && normalizedPayload.nodeId) {
      props.state.moveNode(normalizedPayload.nodeId, props.state.document.rootId)
    }
  }
  catch (error) {
    props.state.endGridInteraction()
    console.warn('[UIEditorDemoCanvas] root drop parse failed', error)
  }
}
</script>

<template>
  <div
    class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_35%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(241,245,249,0.92))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))]"
  >
    <div class="min-h-0 flex-1 overflow-auto">
      <div
        class="min-h-full w-full pb-6 pt-5"
      >
        <div
          class="mx-auto h-fit min-h-full shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition dark:shadow-[0_18px_48px_rgba(0,0,0,0.34)]"
          :class="rootDropHovered
            ? 'border border-sky-500 bg-sky-50/80 dark:border-sky-400 dark:bg-sky-950/45'
            : 'border border-dashed border-border/70 bg-white/60 dark:bg-slate-950/55'"
          :style="canvasShellStyle"
          @dragover="onRootDragover"
          @dragleave="rootDropHovered = false"
          @drop="onRootDrop"
        >
          <UIEditorDemoNode
            :state="state"
            :node-id="props.state.document.rootId"
          />
        </div>
      </div>
    </div>
  </div>
</template>
