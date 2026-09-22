<script setup lang="ts">
import type { TooltipTriggerProps } from 'reka-ui'

import { TooltipTrigger } from 'reka-ui'
import { computed } from 'vue'

import { areTooltipsDisabled } from '@/components/ui/tooltip/flags'

const props = defineProps<TooltipTriggerProps>()
const isDisabled = computed(() => areTooltipsDisabled())
</script>

<template>
  <slot v-if="isDisabled" />
  <TooltipTrigger
    v-else
    data-slot="tooltip-trigger"
    v-bind="props"
  >
    <slot />
  </TooltipTrigger>
</template>
