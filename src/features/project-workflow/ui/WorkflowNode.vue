<script setup lang="ts">
import type { WorkflowNodeData } from '../domain/ProjectWorkflow'

import { Handle, Position } from '@vue-flow/core'
import { ExternalLink, TriangleAlert } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentIcon from '@/features/document-presentation/ui/DocumentIcon.vue'

const props = defineProps<{ data: WorkflowNodeData, selected?: boolean }>()
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
}>()
const { t } = useI18n()
const isResource = computed(() => props.data.kind === 'data' || props.data.kind === 'resource')
const kindLabel = computed(() => {
  if (props.data.kind === 'composition') {
    return 'Composition'
  }
  if (props.data.kind === 'scope') {
    return 'Scope'
  }
  if (props.data.documentType === 'store') {
    return 'Store'
  }
  if (props.data.documentType === 'vocabs') {
    return 'Vocab'
  }
  if (props.data.documentType === 'i18n-bundles') {
    return 'i18n'
  }
  if (props.data.documentType === 'style') {
    return 'Style'
  }
  return props.data.documentType ?? props.data.kind
})
const statusLabel = computed(() => {
  if (props.data.status === 'missing') {
    return t('projectWorkflow.missing')
  }
  if (props.data.status === 'cycle') {
    return t('projectWorkflow.cycle')
  }
  if (props.data.status === 'compile-error' || props.data.diagnosticCount > 0) {
    return t('projectWorkflow.invalid')
  }
  return null
})
const canOpen = computed(() => props.data.documentType !== null && props.data.status !== 'missing')
</script>

<template>
  <article
    v-if="isResource"
    class="workflow-resource"
    :class="{ 'is-selected': selected }"
    :title="data.identity"
  >
    <DocumentIcon :presentation="data" size="workflowResource" class="workflow-resource-icon" />
    <button
      v-if="canOpen"
      type="button"
      class="nodrag nopan workflow-resource-title"
      :aria-label="t('projectWorkflow.openDocument', { name: data.title })"
      @click.stop="emit('openDocument', data)"
      @dblclick.stop
    >
      {{ data.title }}
    </button>
    <span v-else class="workflow-resource-title">{{ data.title }}</span>
    <div v-if="statusLabel" class="workflow-node-status">
      <TriangleAlert class="size-3.5" />{{ statusLabel }}
    </div>
    <Handle id="bottom" type="source" :position="Position.Bottom" :connectable="false" />
  </article>
  <article v-else class="workflow-node" :class="[data.colorClass, { 'is-selected': selected, 'is-invalid': statusLabel }]">
    <Handle id="left" type="target" :position="Position.Left" :connectable="false" />
    <Handle id="top" type="target" :position="Position.Top" :connectable="false" />
    <header class="workflow-node-heading">
      <DocumentIcon :presentation="data" size="workflowNode" />
      <span class="workflow-node-kind">{{ kindLabel }}</span>
      <span v-if="data.inactive || data.activationMode" class="workflow-node-activation">{{ data.inactive ? t('projectWorkflow.inactive') : data.activationMode }}</span>
      <button
        v-if="canOpen"
        type="button"
        class="nodrag nopan workflow-node-open"
        :aria-label="t('projectWorkflow.openDocument', { name: data.title })"
        :title="t('projectWorkflow.openDocument', { name: data.title })"
        @click.stop="emit('openDocument', data)"
        @dblclick.stop
      >
        <ExternalLink class="size-3.5" />
      </button>
    </header>
    <div class="workflow-node-body">
      <div class="workflow-node-title" :title="data.title">
        {{ data.title }}
      </div>
      <div class="workflow-node-identity" :title="data.identity">
        {{ data.identity }}
      </div>
      <div v-if="data.alias" class="workflow-node-alias">
        {{ data.alias }}
      </div>
      <div v-if="statusLabel" class="workflow-node-status">
        <TriangleAlert class="size-3.5" />{{ statusLabel }}
      </div>
    </div>
    <Handle id="right" type="source" :position="Position.Right" :connectable="false" />
  </article>
</template>

<style scoped>
.workflow-node { width: 248px; border: 1px solid color-mix(in srgb, currentColor 55%, var(--border)); border-radius: 9px; background: var(--card); box-shadow: 0 3px 10px #0000000c; transition: border-color 120ms, box-shadow 120ms; }
.workflow-node-heading { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, var(--border)); background: color-mix(in srgb, currentColor 12%, var(--card)); border-radius: 8px 8px 0 0; }
.workflow-node-kind { font-size: 11px; font-weight: 600; letter-spacing: .03em; }
.workflow-node-activation { margin-left: auto; font: 9px var(--font-mono, monospace); opacity: .75; }
.workflow-node-open { margin-left: auto; padding: 3px; border-radius: 4px; cursor: pointer; opacity: .65; }
.workflow-node-open:hover { opacity: 1; background: var(--accent); }
.workflow-node-body { padding: 13px 14px; color: var(--card-foreground); }
.workflow-node-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; line-height: 20px; }
.workflow-node-identity { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; font: 10px/16px var(--font-mono, monospace); color: var(--muted-foreground); }
.workflow-node-alias { display: inline-block; margin-top: 7px; border-radius: 4px; padding: 1px 5px; font: 10px/16px var(--font-mono, monospace); background: var(--muted); color: var(--muted-foreground); }
.workflow-node-status { display: flex; gap: 5px; align-items: center; margin-top: 6px; color: var(--destructive); font-size: 10px; }
.is-invalid { border-color: var(--destructive); }
.is-selected { border-color: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent); }
:is(.workflow-node, .workflow-resource) :deep(.vue-flow__handle) { width: 6px; height: 6px; min-width: 6px; min-height: 6px; border: 1px solid var(--card); background: currentColor; pointer-events: none; }
:is(.workflow-node, .workflow-resource) button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.workflow-resource { display: flex; flex-direction: column; align-items: center; width: 248px; padding: 12px 12px 16px; color: var(--foreground); }
.workflow-resource-icon { padding: 4px; overflow: visible; transition: filter 120ms, transform 120ms; }
.workflow-resource-title { max-width: 100%; margin-top: 12px; padding: 2px 4px; font-size: 13px; font-weight: 500; line-height: 20px; text-align: center; overflow-wrap: anywhere; }
button.workflow-resource-title { cursor: pointer; border-radius: 4px; }
button.workflow-resource-title:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.workflow-resource.is-selected { border: none; box-shadow: none; }
.workflow-resource.is-selected .workflow-resource-icon { filter: drop-shadow(0 0 7px currentColor); transform: scale(1.06); }
</style>
