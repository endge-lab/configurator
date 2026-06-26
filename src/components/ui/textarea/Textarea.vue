<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { useVModel } from '@vueuse/core'

import { cn } from '@/lib/utils.ts'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    class?: HTMLAttributes['class']
    rows?: number
    placeholder?: string
  }>(),
  { rows: 3 },
)

const emit = defineEmits<{ (e: 'update:modelValue', payload: string): void }>()
const modelValue = useVModel(props, 'modelValue', emit, { passive: true })
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :rows="rows"
    :placeholder="placeholder"
    :class="cn(
      'placeholder:text-muted-foreground border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y',
      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      props.class,
    )"
  />
</template>
