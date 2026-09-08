<script setup lang="ts">
import type { Component } from 'vue'
import type { DomainDocumentPresentation } from '../types/document-presentation'

import { computed } from 'vue'
import { getIconComponent } from '@/components/layouts/grid/icons'
import { DOCUMENT_ICON_BADGE_SIZE, DOCUMENT_ICON_SIZES, DOCUMENT_ICON_STROKE_WIDTH, FALLBACK_PRESENTATION } from '../config/document-presentation'

const props = withDefaults(defineProps<{
  presentation: DomainDocumentPresentation
  size?: keyof typeof DOCUMENT_ICON_SIZES
}>(), { size: 'tree' })
const icon = computed(() => (getIconComponent(props.presentation.icon) ?? getIconComponent(FALLBACK_PRESENTATION.icon)) as Component)
const badge = computed(() => getIconComponent(props.presentation.badgeIcon ?? undefined) as Component | null)
</script>

<template>
  <span class="relative inline-flex shrink-0" :class="[DOCUMENT_ICON_SIZES[size], presentation.colorClass]" aria-hidden="true">
    <component :is="icon" class="size-full" :class="presentation.colorClass" :stroke-width="size === 'workflowResource' ? DOCUMENT_ICON_STROKE_WIDTH.resource : DOCUMENT_ICON_STROKE_WIDTH.normal" />
    <component
      :is="badge"
      v-if="badge"
      class="absolute -bottom-1 -right-1 rounded-[2px] bg-background p-px"
      :class="DOCUMENT_ICON_BADGE_SIZE"
    />
  </span>
</template>
