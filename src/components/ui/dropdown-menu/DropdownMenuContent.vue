<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui'

import { cn } from '@/lib/utils.ts'

const props = withDefaults(
  defineProps<DropdownMenuContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    sideOffset: 4,
  },
)
const emits = defineEmits<DropdownMenuContentEmits & { mouseenter: [e: MouseEvent]; mouseleave: [e: MouseEvent] }>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

/** Не передаём mouseenter/mouseleave в reka-ui (фрагментный корень не наследует их - Vue warn). */
const forwardedWithoutMouse = computed(() => {
  const f = forwarded.value as Record<string, unknown>
  const { onMouseenter, onMouseleave, ...rest } = f ?? {}
  return rest
})
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="forwardedWithoutMouse"
      :class="cn('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[10001] max-h-(--reka-dropdown-menu-content-available-height) min-w-[8rem] origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md', props.class)"
    >
      <div
        class="contents"
        @mouseenter="(e: MouseEvent) => emits('mouseenter', e)"
        @mouseleave="(e: MouseEvent) => emits('mouseleave', e)"
      >
        <slot />
      </div>
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
