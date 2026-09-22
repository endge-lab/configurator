<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'

import { TooltipProvider } from 'reka-ui'
import { computed } from 'vue'

import { areTooltipsDisabled } from '@/components/ui/tooltip/flags'

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 0,
})

const isDisabled = computed(() => areTooltipsDisabled())
</script>

<template>
  <slot v-if="isDisabled" />
  <TooltipProvider v-else v-bind="props">
    <slot />
  </TooltipProvider>
</template>
