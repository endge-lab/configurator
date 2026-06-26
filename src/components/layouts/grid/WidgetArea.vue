<script setup lang="ts">
import type { WidgetPosition } from '@/components/layouts/grid/types.ts'
import { computed } from 'vue'
import { getLayoutState, getWidgetInstances, getWidgetsByPosition } from '@/components/layouts/grid/layout.ts'
import WidgetContainer from '@/components/layouts/grid/WidgetContainer.vue'

const props = defineProps<{
  position: 'left' | 'right' | 'bottom'
}>()

const { widgets } = getLayoutState()

const areaState = computed(() => widgets.value.areas[props.position])

const activeDefinition = computed(() => {
  const activeId = areaState.value.activeWidget
  if (!activeId)
    return null
  return widgets.value.definitions[activeId] ?? null
})

const activeInstances = computed(() => {
  if (!activeDefinition.value)
    return []
  return getWidgetInstances(activeDefinition.value.id)
})

const _widgetsInPosition = computed(() =>
  getWidgetsByPosition(props.position as WidgetPosition).filter(w =>
    getWidgetInstances(w.id).length > 0,
  ),
)

const hasContent = computed(() =>
  activeDefinition.value && activeInstances.value.length > 0,
)
</script>

<template>
  <div
    v-if="hasContent"
    class="h-full bg-background rounded-lg overflow-hidden flex flex-col"
  >
    <WidgetContainer
      v-if="activeDefinition"
      :definition="activeDefinition"
      :instances="activeInstances"
      :position="position"
    />
  </div>
</template>
