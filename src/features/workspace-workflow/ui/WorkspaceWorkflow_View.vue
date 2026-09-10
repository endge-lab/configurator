<script setup lang="ts">
import type { WorkspaceWorkflow } from '../domain/WorkspaceWorkflow'
import type { WorkflowNodeData, WorkflowViewport } from '@/features/project-workflow/domain/ProjectWorkflow'
import { useI18n } from 'vue-i18n'
import ProjectWorkflow_View from '@/features/project-workflow/ui/ProjectWorkflow_View.vue'

defineProps<{ workflow: WorkspaceWorkflow }>()
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
  toggleResources: [id: string]
  viewportChange: [viewport: WorkflowViewport]
}>()
const { t } = useI18n()
</script>

<template>
  <ProjectWorkflow_View
    :workflow="workflow"
    :aria-label="t('workspaceWorkflow.title')"
    @open-document="emit('openDocument', $event)"
    @toggle-resources="emit('toggleResources', $event)"
    @viewport-change="emit('viewportChange', $event)"
  />
</template>
