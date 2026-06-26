<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

interface PopoverCtx {
  triggerEl: { value: HTMLElement | null }
}

const popover = inject<PopoverCtx>('popover')
if (!popover)
  throw new Error('PopoverTrigger must be used inside Popover')

const el = ref<HTMLElement | null>(null)

onMounted(() => {
  popover.triggerEl.value = el.value
})
</script>

<template>
  <div
    ref="el"
    data-popover-trigger
    class="inline-block w-full"
    @pointerdown.stop
  >
    <slot />
  </div>
</template>
