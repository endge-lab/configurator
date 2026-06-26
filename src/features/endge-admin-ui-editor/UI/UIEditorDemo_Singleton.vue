<script setup lang="ts">
import { ensureUIEditorDemoCoreRenderersRegistered } from '@/features/endge-admin-ui-editor/entities/ui-editor-core-renderers'
import { uiEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import UIEditorDemoCanvas from '@/features/endge-admin-ui-editor/UI/UIEditorDemoCanvas.vue'
import UIEditorDemoToolbar from '@/features/endge-admin-ui-editor/UI/UIEditorDemoToolbar.vue'

ensureUIEditorDemoCoreRenderersRegistered()
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] text-foreground">
    <UIEditorDemoToolbar :state="uiEditorDemoState" />

    <div class="min-h-0 flex-1 overflow-hidden">
      <UIEditorDemoCanvas :state="uiEditorDemoState" />
    </div>
  </div>
</template>
