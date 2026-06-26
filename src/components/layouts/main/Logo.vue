<script setup lang="ts">
import { computed } from 'vue'

import { useBranding } from '@/lib/branding.ts'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = withDefaults(defineProps<{
  /**
   * Высота иконки.
   * Можно передать число (px) или строку (например "2.5rem", "40px", "h-10").
   */
  iconHeight?: number | string
}>(), {
  iconHeight: 'h-10',
})

const { currentBranding } = useBranding()

const appVersion: string = __APP_VERSION__
const appVersionUpdated: string = __APP_VERSION_UPDATED__

const iconClass = computed<string>(() => {
  // Tailwind class вариант (по умолчанию)
  if (typeof props.iconHeight === 'string' && props.iconHeight.trim().startsWith('h-')) {
    return `${props.iconHeight} object-contain`
  }
  // если строка "40px"/"2.5rem" - оставим h-auto и зададим style
  return 'h-auto object-contain'
})

const iconStyle = computed<Record<string, string> | undefined>(() => {
  if (typeof props.iconHeight === 'number') {
    return { height: `${props.iconHeight}px` }
  }
  if (typeof props.iconHeight === 'string') {
    const v = props.iconHeight.trim()
    if (v.startsWith('h-')) {
      return undefined
    }
    return { height: v }
  }
  return undefined
})
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <div class="flex items-center gap-2 cursor-default">
          <img
            v-if="currentBranding.iconHref"
            :src="currentBranding.iconHref"
            alt="Конфигуратор"
            :class="iconClass"
            :style="iconStyle"
          >
        </div>
      </TooltipTrigger>

      <TooltipContent side="bottom" align="start">
        <div class="text-xs">
          Version {{ appVersion }} <br>
          Updated {{ appVersionUpdated }}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
