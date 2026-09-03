<script setup lang="ts">
import { GitFork } from 'lucide-vue-next'

import { Button } from '@/shared/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

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
      {{ open ? $t('uiText.hideDependencies387a47a6') : $t('uiText.showDependencies8239edf7') }}
    </TooltipContent>
  </Tooltip>
</template>
