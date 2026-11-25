<script setup lang="ts">
import type { ComponentSFCExpressionCompletionScope } from '@endge/core'
import { FunctionSquare } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ComponentSFCExpressionInput from './ComponentSFCExpressionInput.vue'

const props = defineProps<{
  value: string
  binding: boolean
  label: string
  scope: ComponentSFCExpressionCompletionScope
  bindings: Readonly<Record<string, unknown>>
  expressionExample?: string
}>()
const emit = defineEmits<{ change: [value: string, binding: boolean], toggle: [] }>()
const draft = ref(props.value)
watch(() => props.value, (value) => {
  draft.value = value
})
function commit() {
  if (draft.value !== props.value) {
    emit('change', draft.value, props.binding)
  }
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <div class="min-w-0 flex-1">
      <ComponentSFCExpressionInput
        v-if="binding"
        v-model="draft"
        :scope="scope"
        :bindings="bindings"
        :aria-label="label"
        :placeholder="expressionExample"
        input-class="h-8 w-full px-2 font-mono text-xs md:text-xs"
        @commit="commit"
      />
      <Input
        v-else
        v-model="draft"
        :aria-label="label"
        class="h-8 w-full px-2 text-xs md:text-xs"
        @change="commit"
      />
    </div>
    <Button
      type="button"
      size="icon"
      :variant="binding ? 'secondary' : 'ghost'"
      class="size-8 shrink-0"
      :aria-pressed="binding"
      :aria-label="$t('timelineEditor.toggleExpression', { field: label })"
      :title="$t('timelineEditor.toggleExpression', { field: label })"
      @click="emit('toggle')"
    >
      <FunctionSquare class="size-4" />
    </Button>
  </div>
</template>
