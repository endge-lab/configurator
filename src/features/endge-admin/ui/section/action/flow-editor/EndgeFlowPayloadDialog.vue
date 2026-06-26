<script setup lang="ts">
import { computed } from 'vue'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  payload: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const model = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <Dialog v-model:open="model">
    <DialogContent class="flex h-[85vh] max-h-[85vh] max-w-3xl flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle>Сгенерированный код payload</DialogTitle>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-auto rounded-xl border bg-slate-950 p-4">
        <pre class="whitespace-pre overflow-x-auto text-sm text-slate-100">{{ payload }}</pre>
      </div>
    </DialogContent>
  </Dialog>
  <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
</template>
