<script setup lang="ts">
import { Loader2, Save } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  tooltip?: string
  ariaLabel?: string
}>(), {
  loading: false,
  disabled: false,
  tooltip: 'Сохранить',
  ariaLabel: 'Сохранить',
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          :aria-label="ariaLabel"
          :disabled="disabled || loading"
          @click="emit('click')"
        >
          <Loader2 v-if="loading" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
