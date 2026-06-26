<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { computed } from 'vue'

import { cn } from '@/lib/utils.ts'

interface Props {
  checked?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:checked', value: boolean): void
}>()

const isChecked = computed<boolean>({
  get: () => props.checked,
  set: (value: boolean) => {
    emit('update:checked', value)
  },
})

function toggle(): void {
  if (props.disabled)
    return
  isChecked.value = !isChecked.value
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isChecked"
    :data-state="isChecked ? 'checked' : 'unchecked'"
    :disabled="disabled"
    :class="cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:bg-input data-[state=checked]:bg-primary',
      props.class,
    )"
    @click="toggle"
  >
    <span
      :data-state="isChecked ? 'checked' : 'unchecked'"
      class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
    />
  </button>
</template>

