<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ task?: object }>()
const json = computed(() => {
  try {
    return JSON.stringify(props.task, null, 2)
  }
  catch {
    return undefined
  }
})
</script>

<template>
  <pre v-if="json !== undefined" class="m-0 min-h-full w-max min-w-full select-text bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground">{{ json }}</pre>
  <p v-else class="p-3 text-sm text-muted-foreground" role="status">
    {{ task ? $t('timelineEditor.recipes.sampleTaskJsonError') : $t('timelineEditor.recipes.sampleTaskUnavailable') }}
  </p>
</template>
