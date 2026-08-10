<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import { onBeforeUnmount } from 'vue'

import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'

const dialogs = EndgeIDE.sourceEditorDialogs
const cancelDialog = (): void => dialogs.cancel()
const resolveDialog = (result: unknown): void => dialogs.resolve(result)

function onOpenChange(open: boolean): void {
  if (!open) { cancelDialog() }
}

onBeforeUnmount(cancelDialog)
</script>

<template>
  <component
    :is="dialogs.active.value.definition.component"
    v-if="dialogs.active.value"
    :open="true"
    :input="dialogs.active.value.input"
    @submit="resolveDialog"
    @cancel="cancelDialog"
    @update:open="onOpenChange"
  />
</template>
