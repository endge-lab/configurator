<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  label: string
  description: string
}>()
</script>

<template>
  <header class="flex min-h-12 shrink-0 items-center gap-1.5 border-b border-border/70 px-5 py-2.5">
    <h2 class="text-sm font-semibold">
      {{ label }}
    </h2>

    <TooltipProvider :delay-duration="120">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="`О разделе «${label}»`"
          >
            <CircleHelp class="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-80 leading-relaxed">
          {{ description }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <div v-if="$slots.actions" class="ml-auto flex min-w-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
