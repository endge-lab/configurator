<script setup lang="ts">
import EntityPreview from '@/features/endge-preview/ui/views/EntityPreview.vue'

withDefaults(defineProps<{
  showExternalLink?: boolean
}>(), {
  showExternalLink: false,
})
</script>

<template>
  <EntityPreview :show-external-link="showExternalLink" />
</template>
