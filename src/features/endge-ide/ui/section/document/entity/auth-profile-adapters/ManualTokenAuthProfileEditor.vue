<script setup lang="ts">
import { computed } from 'vue'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  config: Record<string, unknown>
  credentialRefs: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:config': [Record<string, unknown>]
  'update:credentialRefs': [Record<string, unknown>]
}>()

const manualToken = computed({
  get: () => String(props.config?.manualToken ?? ''),
  set: value => emit('update:config', {
    ...(props.config ?? {}),
    manualToken: value,
  }),
})
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">Token</Label>
      <Input v-model="manualToken" autocomplete="off" />
      <div class="text-xs text-muted-foreground">
        Можно указать прямое значение или ссылку на Endge.workspace.variables.
      </div>
    </div>
  </div>
</template>
