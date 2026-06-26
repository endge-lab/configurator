<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { Menu } from 'lucide-vue-next'

import { cn } from '@/lib/utils.ts'

import { useSidebar } from '@/components/ui/sidebar/utils.ts'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { toggleSidebar } = useSidebar()
</script>

<template>
  <div
    class="flex gap-1 items-center cursor-pointer"
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    :class="cn(props.class)"
    @click="toggleSidebar"
  >
    <Menu :size="16" />
    <slot />
  </div>
</template>
