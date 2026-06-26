<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import { computed } from 'vue'

import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  tabContext?: { document?: { editor?: unknown; previewModel?: unknown; component?: unknown } }
}

const props = defineProps<Props>()

/** Сущность из документа (модель или редактор); inherited задаётся в REntity. */
const entity = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? props.tabContext?.document?.editor ?? null)

const inherited = computed(() => (entity.value as { inherited?: boolean } | null)?.inherited === true)
</script>

<template>
  <div v-if="entity != null" class="flex items-center gap-2">
    <Checkbox :checked="inherited" disabled />
    <label class="text-sm font-medium text-muted-foreground cursor-not-allowed">Унаследованный</label>
    <TooltipProvider :delay-duration="300">
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="inline-flex text-muted-foreground cursor-help" aria-label="Подсказка">
            <CircleHelp class="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[260px]">
          Сущность создана внутри другой сущности и привязана к нему. В корневых списках домена не отображается.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
