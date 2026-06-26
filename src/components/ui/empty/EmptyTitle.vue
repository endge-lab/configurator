<script setup lang="ts">
import type { EmptyMediaVariants } from '@/components/ui/empty/index.ts'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/lib/utils.ts'

import { emptyMediaVariants } from '@/components/ui/empty/index.ts'

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: EmptyMediaVariants['variant']
}>()
</script>

<template>
  <div
    data-slot="empty-icon"
    :data-variant="variant"
    :class="cn(emptyMediaVariants({ variant }), props.class)"
  >
    <slot />
  </div>
</template>
