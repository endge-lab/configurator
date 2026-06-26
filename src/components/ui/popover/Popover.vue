<script setup lang="ts">
import { onBeforeUnmount, provide, ref, watch } from 'vue'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()

const open = ref<boolean>(false)
const triggerEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)

function close(): void {
  open.value = false
}
function toggle(): void {
  open.value = !open.value
}

// ✅ controlled -> sync from outside
watch(
  () => props.open,
  (v) => {
    if (typeof v === 'boolean')
      open.value = v
  },
  { immediate: true },
)

// ✅ emit changes to outside (for v-model:open)
watch(open, (v) => {
  emit('update:open', v)
})

function onDocPointerDown(e: PointerEvent): void {
  const t = e.target as Node | null
  if (!t)
    return
  if (triggerEl.value?.contains(t))
    return
  if (contentEl.value?.contains(t))
    return
  close()
}

document.addEventListener('pointerdown', onDocPointerDown)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
})

provide('popover', {
  open,
  triggerEl,
  contentEl,
  close,
  toggle,
})
</script>

<template>
  <slot />
</template>
