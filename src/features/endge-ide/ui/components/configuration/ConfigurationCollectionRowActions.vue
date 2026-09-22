<script setup lang="ts">
import { CircleMinus, Trash2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  excluded?: boolean
  excludable?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggleExcluded: []
  remove: []
}>()

const EXCLUDE_TOOLTIP = 'Исключить это значение из наследуемой конфигурации.'
const RESTORE_TOOLTIP = 'Исключение включено. Нажмите, чтобы снова добавить или переопределить значение.'
const REMOVE_TOOLTIP = 'Удалить эту локальную строку'
</script>

<template>
  <div class="flex shrink-0 items-center gap-1">
    <Tooltip v-if="excludable">
      <TooltipTrigger as-child>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          class="size-8"
          :class="excluded
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
            : 'text-muted-foreground'"
          :disabled="disabled"
          :aria-pressed="excluded"
          :aria-label="excluded ? 'Вернуть значение в конфигурацию' : 'Исключить унаследованное значение'"
          @click="emit('toggleExcluded')"
        >
          <CircleMinus class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {{ excluded ? RESTORE_TOOLTIP : EXCLUDE_TOOLTIP }}
      </TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          class="size-8"
          :disabled="disabled"
          aria-label="Удалить строку"
          @click="emit('remove')"
        >
          <Trash2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {{ REMOVE_TOOLTIP }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
