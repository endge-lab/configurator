<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { computed } from 'vue'

import { validateMetadataJSON } from '@/features/endge-ide/services/document-metadata-session'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  readOnly?: boolean
  message?: string | null
  externalError?: string | null
  viewStateKey?: string
}>(), {
  readOnly: false,
  message: null,
  externalError: null,
  viewStateKey: 'document.metadata',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'validation': [error: string | null]
  'commit': []
}>()

const validationError = computed(() => props.externalError ?? validateMetadataJSON(props.modelValue))

function update(value: string): void {
  emit('update:modelValue', value)
  emit('validation', validateMetadataJSON(value))
}

function commit(): void {
  const error = validateMetadataJSON(props.modelValue)
  emit('validation', error)
  if (!error) {
    emit('commit')
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div v-if="message" class="flex shrink-0 items-start gap-2 border-b border-amber-500/25 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300">
      <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
      <span>{{ message }}</span>
    </div>
    <ScriptEditor
      :model-value="modelValue"
      :view-state-key="viewStateKey"
      language="json"
      format-language="json"
      show-toolbar
      class="min-h-0 flex-1"
      min-height="100%"
      :read-only="readOnly"
      @update:model-value="update"
      @blur="commit"
      @format="commit"
    />
    <div v-if="validationError" class="flex shrink-0 items-start gap-2 border-t border-destructive/25 bg-destructive/5 px-4 py-2 text-[11px] text-destructive">
      <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
      <span>{{ validationError }}</span>
    </div>
  </section>
</template>
