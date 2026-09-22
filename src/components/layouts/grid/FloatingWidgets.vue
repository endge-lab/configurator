<script setup lang="ts">
import { computed } from 'vue'
import FloatingWidget from '@/components/layouts/grid/FloatingWidget.vue'
import { bringFloatingWidgetToFront, getLayoutState, getWidgetInstances, getWidgetsByPosition, updateFloatingWidgetState } from '@/components/layouts/grid/layout.ts'

const { widgets } = getLayoutState()

const floatingWidgets = computed(() =>
  getWidgetsByPosition('floating').filter(w =>
    getWidgetInstances(w.id).length > 0,
  ),
)

const floatingStates = computed(() => widgets.value.areas.floating.states)
</script>

<template>
  <div class="fixed inset-0 pointer-events-none z-[1000]">
    <FloatingWidget
      v-for="widget in floatingWidgets"
      :key="widget.id"
      :definition="widget"
      :instances="getWidgetInstances(widget.id)"
      :state="floatingStates[widget.id]"
      @update:state="(updates) => updateFloatingWidgetState(widget.id, updates)"
      @focus="bringFloatingWidgetToFront(widget.id)"
    />
  </div>
</template>
