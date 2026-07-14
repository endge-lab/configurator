<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import { onBeforeUnmount } from 'vue'

import {
  cancelSourceEditorDialog,
  resolveSourceEditorDialog,
  sourceEditorDialogState,
} from '@/features/endge-ide/source-editor/core/source-editor-dialogs'

function onOpenChange(open: boolean): void {
  if (!open) { cancelSourceEditorDialog() }
}

onBeforeUnmount(cancelSourceEditorDialog)
</script>

<template>
  <component
    :is="sourceEditorDialogState.active.value.definition.component"
    v-if="sourceEditorDialogState.active.value"
    :open="true"
    :input="sourceEditorDialogState.active.value.input"
    @submit="resolveSourceEditorDialog"
    @cancel="cancelSourceEditorDialog"
    @update:open="onOpenChange"
  />
</template>
