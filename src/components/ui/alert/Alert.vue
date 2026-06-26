<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { AlertVariants } from '@/components/ui/alert/index.ts'
import { cn } from '@/lib/utils.ts'
import { alertVariants } from '@/components/ui/alert/index.ts'

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: AlertVariants['variant']
}>()
</script>

<template>
  <div :class="cn(alertVariants({ variant }), props.class)" role="alert">
    <slot />
  </div>
</template>
