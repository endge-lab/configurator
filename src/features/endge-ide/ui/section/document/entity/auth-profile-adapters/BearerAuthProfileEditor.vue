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

const tokenRef = computed({
  get: () => String(props.credentialRefs.token ?? ''),
  set: value => emit('update:credentialRefs', { token: value }),
})
</script>

<template>
  <div class="space-y-1.5">
    <Label class="text-xs text-muted-foreground">Token credential ref</Label>
    <Input v-model="tokenRef" autocomplete="off" />
    <div class="text-xs text-muted-foreground">
      Core передаст ссылку host-приложению и не сохранит значение токена.
    </div>
  </div>
</template>
