<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineOptions({ inheritAttrs: false })
defineProps<{ label: string }>()
</script>

<template>
  <Tooltip :delay-duration="0" disable-hoverable-content>
    <TooltipTrigger as-child>
      <button type="button" :aria-label="label" v-bind="$attrs">
        <slot />
      </button>
    </TooltipTrigger>
    <TooltipContent class="z-[10001] animate-none">
      {{ label }}
    </TooltipContent>
  </Tooltip>
</template>
