<script setup lang="ts">
import { computed } from 'vue'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = withDefaults(defineProps<{
  // Высота иконки.
  // Можно передать число (px) или строку (например "2.5rem", "40px", "h-10").
  iconHeight?: number | string
}>(), {
  iconHeight: 'h-10',
})

const appVersion: string = __APP_VERSION__
const appVersionUpdated: string = __APP_VERSION_UPDATED__

const iconClass = computed<string>(() => {
  // Tailwind class вариант (по умолчанию)
  if (typeof props.iconHeight === 'string' && props.iconHeight.trim().startsWith('h-')) {
    return `${props.iconHeight} w-auto shrink-0`
  }
  // если строка "40px"/"2.5rem" - оставим h-auto и зададим style
  return 'h-auto w-auto shrink-0'
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
          <svg
            role="img"
            aria-label="Endge"
            :class="iconClass"
            :style="iconStyle"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              class="fill-[#171B24] dark:fill-white"
              d="M12 6H52C55.3137 6 58 8.68629 58 12V16C58 19.3137 55.3137 22 52 22H22V42H52C55.3137 42 58 44.6863 58 48V52C58 55.3137 55.3137 58 52 58H12C8.68629 58 6 55.3137 6 52V12C6 8.68629 8.68629 6 12 6Z"
            />
            <rect
              class="fill-[#171B24] dark:fill-white"
              x="26"
              y="26"
              width="32"
              height="12"
              rx="4"
            />
          </svg>
        </div>
      </TooltipTrigger>

      <TooltipContent side="bottom" align="start">
        <div class="text-xs">
          {{ $t('uiText.text2da600bf') }} {{ appVersion }} <br>
          {{ $t('uiText.textA001860e') }} {{ appVersionUpdated }}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
