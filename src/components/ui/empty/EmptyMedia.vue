<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { EmptyMediaVariants } from '@/components/ui/empty/index.ts'

import { emptyMediaVariants } from '@/components/ui/empty/index.ts'

import { cn } from '@/shared/tools/utils.ts'

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
