<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { BadgeVariants } from '@/components/ui/badge/index.ts'
import { cn } from '@/lib/utils.ts'
import { badgeVariants } from '@/components/ui/badge/index.ts'

const props = defineProps<{
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), props.class)">
    <slot />
  </div>
</template>
