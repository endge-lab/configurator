<script setup lang="ts">
import type { EndgeJSONValue } from '@endge/core'

import { ref, watch } from 'vue'

import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const props = defineProps<{ modelValue: EndgeJSONValue, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: EndgeJSONValue] }>()
const text = ref(JSON.stringify(props.modelValue, null, 2))
const error = ref('')
watch(() => props.modelValue, (value) => {
  const next = JSON.stringify(value, null, 2)
  if (!error.value && text.value !== next) text.value = next
}, { deep: true })

function update(value: string): void {
  text.value = value
  try {
    const parsed = JSON.parse(value) as EndgeJSONValue
    error.value = ''
    emit('update:modelValue', parsed)
  }
  catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <ScriptEditor :model-value="text" language="json" format-language="json" :min-height="180" :show-toolbar="true" :read-only="disabled" @update:model-value="update" />
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
