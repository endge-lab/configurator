<script setup lang="ts">
import { ensureUIEditorDemoCoreRenderersRegistered } from '@/features/endge-admin-ui-editor/entities/ui-editor-core-renderers'
import { uiEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import UIEditorDemoCanvas from '@/features/endge-admin-ui-editor/ui/UIEditorDemoCanvas.vue'
import UIEditorDemoCodePanel from '@/features/endge-admin-ui-editor/ui/UIEditorDemoCodePanel.vue'
import UIEditorDemoToolbar from '@/features/endge-admin-ui-editor/ui/UIEditorDemoToolbar.vue'

ensureUIEditorDemoCoreRenderersRegistered()
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,#111827_0%,#0b1120_100%)]">
    <UIEditorDemoToolbar :state="uiEditorDemoState" />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        v-if="uiEditorDemoState.workspaceMode !== 'source'"
        class="min-w-0 flex-1"
      >
        <UIEditorDemoCanvas :state="uiEditorDemoState" />
      </div>

      <Transition name="code-panel">
        <div
          v-if="uiEditorDemoState.workspaceMode !== 'visual'"
          class="h-full"
          :class="uiEditorDemoState.workspaceMode === 'split'
            ? 'min-w-[360px] w-[42%] max-w-[640px]'
            : 'min-w-0 flex-1'"
        >
          <UIEditorDemoCodePanel :state="uiEditorDemoState" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.code-panel-enter-active,
.code-panel-leave-active {
  transition: width 180ms ease, min-width 180ms ease, opacity 140ms ease;
}

.code-panel-enter-from,
.code-panel-leave-to {
  width: 0;
  min-width: 0;
  opacity: 0;
}
</style>
