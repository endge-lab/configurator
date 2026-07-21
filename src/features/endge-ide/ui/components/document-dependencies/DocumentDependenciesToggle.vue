<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { GitFork } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="
          open
            ? 'bg-editor-control text-foreground shadow-sm'
            : 'text-muted-foreground'
        "
        :aria-pressed="open"
        :aria-label="open ? 'Скрыть зависимости документа' : 'Показать зависимости документа'"
        @click="emit('toggle')"
      >
        <GitFork class="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {{ open ? "Скрыть зависимости" : "Показать зависимости" }}
    </TooltipContent>
  </Tooltip>
</template>
