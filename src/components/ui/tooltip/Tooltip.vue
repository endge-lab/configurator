<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui'

import { TooltipRoot, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'

import { areTooltipsDisabled } from '@/components/ui/tooltip/flags'

const props = defineProps<TooltipRootProps>()
const emits = defineEmits<TooltipRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
const isDisabled = computed(() => areTooltipsDisabled())
</script>

<template>
  <slot v-if="isDisabled" />
  <TooltipRoot
    v-else
    data-slot="tooltip"
    v-bind="forwarded"
  >
    <slot />
  </TooltipRoot>
</template>
