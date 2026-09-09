<script setup lang="ts">
import type { WorkflowNodeData } from '../domain/ProjectWorkflow'

import { ChevronDown, ChevronRight, Folder, TriangleAlert } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  data: WorkflowNodeData
  selectedIds: ReadonlySet<string>
  focus: ReadonlyMap<string, number>
}>()
const emit = defineEmits<{ toggleResources: [id: string] }>()
const { t } = useI18n()
const resources = computed(() => props.data.resourceRows?.flatMap(row => row.items) ?? [])
const relatedCount = computed(() => resources.value.filter(item => props.focus.has(item.id)).length)
const problems = computed(() => resources.value.filter(item => item.status !== 'valid' || item.diagnosticCount > 0).length)
</script>

<template>
  <button
    type="button"
    class="workflow-resources-toggle nodrag nopan"
    :style="{ width: `${data.width}px` }"
    :aria-expanded="data.resourcesExpanded"
    :aria-label="data.resourcesExpanded ? t('projectWorkflow.collapseResources', { name: data.title }) : t('projectWorkflow.expandResources', { name: data.title })"
    @click.stop="emit('toggleResources', data.id)"
    @dblclick.stop
  >
    <component :is="data.resourcesExpanded ? ChevronDown : ChevronRight" class="size-3.5" />
    <Folder class="size-3.5" />
    <span>{{ t('projectWorkflow.resources') }}</span>
    <span class="tabular-nums">{{ resources.length }}</span>
    <span v-if="selectedIds.size && relatedCount" class="ml-auto text-primary">
      {{ t('projectWorkflow.relatedResources', { count: relatedCount, total: resources.length }) }}
    </span>
    <TriangleAlert v-if="problems" class="size-3.5 text-destructive" :aria-label="t('projectWorkflow.resourceProblems', { count: problems })" />
  </button>
</template>

<style scoped>
.workflow-resources-toggle { display: flex; align-items: center; gap: 6px; height: 32px; padding: 4px 8px; border-radius: 5px; color: var(--muted-foreground); font-size: 10px; text-align: left; cursor: pointer; }
.workflow-resources-toggle:hover { color: var(--foreground); background: var(--accent); }
.workflow-resources-toggle:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
</style>
