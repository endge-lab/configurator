<script setup lang="ts">
import type { TimelineRecipeShape } from '@endge/core'
import { Circle, Diamond, Smile, Square, Triangle, Type } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TimelineRecipeToolButton from './TimelineRecipeToolButton.vue'

const emit = defineEmits<{ choose: [type: TimelineRecipeShape | 'icon' | 'text'] }>()
const { t } = useI18n()
const options = computed(() => [
  { type: 'rect', icon: Square, title: t('timelineEditor.recipes.primitive.rect') },
  { type: 'circle', icon: Circle, title: t('timelineEditor.recipes.primitive.circle') },
  { type: 'diamond', icon: Diamond, title: t('timelineEditor.recipes.primitive.diamond') },
  { type: 'triangle', icon: Triangle, title: t('timelineEditor.recipes.primitive.triangle') },
  { type: 'icon', icon: Smile, title: t('timelineEditor.recipes.primitive.icon') },
  { type: 'text', icon: Type, title: t('timelineEditor.recipes.primitive.text') },
] as const)
</script>

<template>
  <div class="flex gap-0.5" role="group" :aria-label="$t('timelineEditor.recipes.addTaskPrimitive')">
    <TimelineRecipeToolButton
      v-for="{ type, icon, title } in options" :key="type" :label="title"
      class="grid size-7 shrink-0 place-items-center rounded-sm hover:bg-accent focus-visible:bg-accent"
      @click="emit('choose', type)"
    >
      <component :is="icon" class="size-4" aria-hidden="true" />
    </TimelineRecipeToolButton>
  </div>
</template>
