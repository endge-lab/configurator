<script setup lang="ts">
import type { WorkflowNodeData } from '../domain/WorkspaceWorkflow'

import { TriangleAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import DocumentIcon from '@/features/document-presentation/ui/DocumentIcon.vue'

withDefaults(defineProps<{ data: WorkflowNodeData, selected: boolean, opacity: number, interactive?: boolean }>(), { interactive: true })
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
  selectResource: [id: string, additive: boolean]
}>()
const { t } = useI18n()
</script>

<template>
  <article
    class="workflow-compact-resource"
    :class="{ 'is-selected': selected }"
    :style="{ opacity, width: `${data.width}px` }"
    :data-workflow-resource="data.id"
  >
    <button
      type="button"
      class="workflow-resource-select nodrag nopan"
      :disabled="!interactive"
      :aria-label="t('workspaceWorkflow.selectResource', { name: data.title })"
      :aria-pressed="selected"
      :title="`${data.title} · ${data.identity}${data.alias ? ` · ${data.alias}` : ''}${data.activationMode ? ` · ${data.activationMode}` : ''}`"
      @click.stop="emit('selectResource', data.id, $event.metaKey || $event.ctrlKey)"
      @dblclick.stop="emit('openDocument', data)"
    >
      <DocumentIcon :presentation="data" size="workflowCompactResource" />
      <TriangleAlert v-if="data.status !== 'valid' || data.diagnosticCount" class="workflow-resource-warning size-3" />
    </button>
    <button
      type="button"
      class="workflow-resource-caption nodrag nopan"
      :disabled="!interactive || data.status === 'missing'"
      :aria-label="t('workspaceWorkflow.openDocument', { name: data.title })"
      :title="data.title"
      @click.stop="emit('openDocument', data)"
      @dblclick.stop
    >
      {{ data.title }}
    </button>
  </article>
</template>

<style scoped>
.workflow-compact-resource { display: flex; flex-direction: column; align-items: center; height: 72px; border-radius: 5px; transition: opacity 160ms, background 160ms; }
.workflow-compact-resource.is-selected { background: var(--accent); outline: 1px solid var(--ring); }
.workflow-resource-select { position: relative; display: flex; justify-content: center; padding: 5px; cursor: pointer; border-radius: 5px; }
.workflow-resource-select:hover:not(:disabled) { background: var(--accent); }
.workflow-resource-caption { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; font-size: 10px; line-height: 12px; text-align: center; overflow-wrap: anywhere; cursor: pointer; color: var(--foreground); }
.workflow-resource-caption:hover:not(:disabled) { text-decoration: underline; }
.workflow-resource-select:disabled, .workflow-resource-caption:disabled { cursor: default; }
.workflow-resource-warning { position: absolute; top: 0; right: 0; color: var(--destructive); }
button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
</style>
