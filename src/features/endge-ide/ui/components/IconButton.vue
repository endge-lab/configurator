<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  active?: boolean
  tooltip?: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'w-6 h-6 text-xs'
    case 'sm':
      return 'w-8 h-8 text-sm'
    case 'md':
      return 'w-10 h-10 text-base'
    case 'lg':
      return 'w-12 h-12 text-lg'
    case 'xl':
      return 'w-14 h-14 text-xl'
    default:
      return 'w-10 h-10 text-base'
  }
})
</script>

<template>
  <div
    v-tooltip.bottom="props.tooltip || ''"
    class="icon-button"
    :class="[sizeClasses, $attrs.class, active ? 'active' : '']"
    @click="emit('click')"
  >
    <i :class="icon" class="text-inherit" />
  </div>
</template>

<style scoped lang="scss">
.icon-button {
  @apply flex items-center justify-center rounded-sm transition-colors cursor-pointer;

  background-color: var(--control-bg);
  color: var(--color-text);

  &:hover {
    background-color: var(--color-primary);
    color: white;
  }

  &.active {
    color: white;
    background-color: var(--color-primary);
  }

  :global(.dark) & {
    background-color: var(--control-bg-dark, #1e1e1e);
    color: white;

    &:hover {
      background-color: var(--color-primary);
      color: white;
    }
  }
}
</style>
