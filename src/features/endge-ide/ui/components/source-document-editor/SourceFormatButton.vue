<script setup lang="ts">
import { AlignLeft } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'click'): void
}>()
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :disabled="disabled"
          aria-label="Форматировать"
          @click="emit('click')"
        >
          <AlignLeft class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ $t('uiText.format64a03c67') }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
