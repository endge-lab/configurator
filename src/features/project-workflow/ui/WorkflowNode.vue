<script setup lang="ts">
import type { WorkflowNodeData } from '../domain/ProjectWorkflow'

import { Handle, Position } from '@vue-flow/core'
import { ChevronDown, ChevronRight, ExternalLink, Folder, TriangleAlert } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentIcon from '@/features/document-presentation/ui/DocumentIcon.vue'

const props = withDefaults(defineProps<{
  data: WorkflowNodeData
  selected?: boolean
  focus: ReadonlyMap<string, number>
  selectedIds: ReadonlySet<string>
  opacity?: number
}>(), { opacity: 1 })
const emit = defineEmits<{
  openDocument: [data: WorkflowNodeData]
  toggleResources: [id: string]
  selectResource: [id: string, additive: boolean]
}>()
const { t } = useI18n()
const isResource = computed(() => props.data.documentType === 'store' && props.data.kind === 'data')
const resources = computed(() => props.data.resourceRows?.flatMap(row => row.items) ?? [])
const relatedCount = computed(() => resources.value.filter(item => props.focus.has(item.id)).length)
const resourceProblems = computed(() => resources.value.filter(item => item.status !== 'valid' || item.diagnosticCount > 0).length)
const rowLabels = computed<Record<string, string>>(() => ({
  'style': t('projectWorkflow.styles'),
  'i18n-bundles': t('projectWorkflow.translations'),
  'vocabs': t('projectWorkflow.vocabs'),
  'stream': t('projectWorkflow.streams'),
}))
const bindingLabels = computed(() => ({
  'explicit-provider': t('projectWorkflow.explicitProviderInvalid'),
  'ambiguous-provider': t('projectWorkflow.ambiguousProvider'),
  'missing-provider': t('projectWorkflow.missingProvider'),
}))
const headerOpacity = computed(() => props.selectedIds.size
  ? Math.min(1, (props.focus.get(props.data.id) ?? 0.22) / props.opacity)
  : 1)
function resourceOpacity(id: string): number {
  return props.selectedIds.size ? Math.min(1, (props.focus.get(id) ?? 0.22) / props.opacity) : 1
}
const kindLabel = computed(() => {
  if (props.data.kind === 'project') {
    return 'Project'
  }
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
  if (props.data.bindingIssue) {
    return bindingLabels.value[props.data.bindingIssue]
  }
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
    :style="{ opacity, 'width': `${data.width ?? 248}px`, '--resource-columns': data.resourceColumns ?? 3 }"
    :data-workflow-id="data.id"
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
    <span v-if="data.dataSource?.slot" class="workflow-store-slot">{{ data.dataSource.slot }}</span>
    <span v-if="data.dataSource?.resolution === 'isolated'" class="workflow-store-slot">{{ t('projectWorkflow.isolatedStore') }}</span>
    <div v-if="statusLabel" class="workflow-node-status">
      <TriangleAlert class="size-3.5" />{{ statusLabel }}
    </div>
    <Handle id="bottom" type="source" :position="Position.Bottom" :connectable="false" />
  </article>
  <article
    v-else
    class="workflow-node"
    :class="[data.colorClass, { 'is-selected': selected, 'is-invalid': statusLabel }]"
    :style="{ opacity, 'width': `${data.width ?? 248}px`, '--resource-columns': data.resourceColumns ?? 3 }"
    :data-workflow-id="data.id"
  >
    <div class="workflow-node-main">
      <Handle id="left" type="target" :position="Position.Left" :connectable="false" />
      <Handle id="top" type="target" :position="Position.Top" :connectable="false" />
      <header class="workflow-node-heading" :style="{ opacity: headerOpacity }">
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
      <div class="workflow-node-body" :style="{ opacity: headerOpacity }">
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
      <button
        v-if="resources.length"
        type="button"
        class="nodrag nopan workflow-resources-toggle"
        :aria-expanded="data.resourcesExpanded"
        :aria-label="data.resourcesExpanded ? t('projectWorkflow.collapseResources', { name: data.title }) : t('projectWorkflow.expandResources', { name: data.title })"
        @click.stop="emit('toggleResources', data.id)"
        @dblclick.stop
      >
        <component :is="data.resourcesExpanded ? ChevronDown : ChevronRight" class="size-3.5" />
        <Folder class="size-3.5" />
        <span>{{ t('projectWorkflow.resources') }}</span>
        <span class="workflow-resources-count">{{ resources.length }}</span>
        <span v-if="selectedIds.size && relatedCount && !selected" class="workflow-resources-related">{{ t('projectWorkflow.relatedResources', { count: relatedCount, total: resources.length }) }}</span>
        <TriangleAlert v-if="resourceProblems" class="size-3.5 text-destructive" :aria-label="t('projectWorkflow.resourceProblems', { count: resourceProblems })" />
      </button>
      <Handle id="right" type="source" :position="Position.Right" :connectable="false" />
    </div>
    <div v-if="data.resourcesExpanded && resources.length" class="workflow-resource-panel nodrag nopan">
      <div
        v-for="row in data.resourceRows"
        :key="row.type"
        class="workflow-resource-row"
        role="group"
        :aria-label="rowLabels[row.type] ?? t('projectWorkflow.resources')"
      >
        <div class="workflow-resource-row-kind" :title="`${rowLabels[row.type] ?? t('projectWorkflow.resources')} · ${row.items.length}`">
          <DocumentIcon :presentation="row.items[0]!" size="tree" />
        </div>
        <div class="workflow-resource-cells">
          <div
            v-for="item in row.items"
            :key="item.id"
            class="workflow-resource-cell"
            :class="{ 'is-resource-selected': selectedIds.has(item.id) }"
            :style="{ opacity: resourceOpacity(item.id) }"
            :data-workflow-resource="item.id"
          >
            <button
              type="button"
              class="workflow-resource-select"
              :aria-label="t('projectWorkflow.selectResource', { name: item.title })"
              :aria-pressed="selectedIds.has(item.id)"
              :title="`${item.title} · ${item.identity}${item.alias ? ` · ${item.alias}` : ''}${item.activationMode ? ` · ${item.activationMode}` : ''}`"
              @click.stop="emit('selectResource', item.id, $event.metaKey || $event.ctrlKey)"
              @dblclick.stop="emit('openDocument', item)"
            >
              <DocumentIcon :presentation="item" size="workflowCompactResource" />
              <TriangleAlert v-if="item.status !== 'valid' || item.diagnosticCount" class="workflow-resource-warning size-3" />
            </button>
            <button
              type="button"
              class="workflow-resource-caption"
              :disabled="item.status === 'missing'"
              :aria-label="t('projectWorkflow.openDocument', { name: item.title })"
              :title="item.title"
              @click.stop="emit('openDocument', item)"
              @dblclick.stop
            >
              {{ item.title }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.workflow-node { width: 248px; border: 1px solid color-mix(in srgb, currentColor 55%, var(--border)); border-radius: 9px; background: var(--card); box-shadow: 0 3px 10px #0000000c; transition: border-color 120ms, box-shadow 120ms, opacity 160ms; }
.workflow-node-heading { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, var(--border)); background: color-mix(in srgb, currentColor 12%, var(--card)); border-radius: 8px 8px 0 0; }
.workflow-node-kind { font-size: 11px; font-weight: 600; letter-spacing: .03em; }
.workflow-node-activation { margin-left: auto; font: 9px var(--font-mono, monospace); opacity: .75; }
.workflow-node-open { margin-left: auto; padding: 3px; border-radius: 4px; cursor: pointer; opacity: .65; }
.workflow-node-open:hover { opacity: 1; background: var(--accent); }
.workflow-node-body { flex: 1; padding: 13px 14px; color: var(--card-foreground); }
.workflow-node-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; line-height: 20px; }
.workflow-node-identity { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; font: 10px/16px var(--font-mono, monospace); color: var(--muted-foreground); }
.workflow-node-alias { display: inline-block; margin-top: 7px; border-radius: 4px; padding: 1px 5px; font: 10px/16px var(--font-mono, monospace); background: var(--muted); color: var(--muted-foreground); }
.workflow-node-status { display: flex; gap: 5px; align-items: center; margin-top: 6px; color: var(--destructive); font-size: 10px; }
.is-invalid { border-color: var(--destructive); }
.is-selected { border-color: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent); }
:is(.workflow-node, .workflow-resource) :deep(.vue-flow__handle) { width: 6px; height: 6px; min-width: 6px; min-height: 6px; border: 1px solid var(--card); background: currentColor; pointer-events: none; }
:is(.workflow-node, .workflow-resource) button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.workflow-resource { transition: opacity 160ms; display: flex; flex-direction: column; align-items: center; width: 248px; padding: 12px 12px 16px; color: var(--foreground); }
.workflow-resource-icon { padding: 4px; overflow: visible; transition: filter 120ms, transform 120ms; }
.workflow-resource-title { max-width: 100%; margin-top: 12px; padding: 2px 4px; font-size: 13px; font-weight: 500; line-height: 20px; text-align: center; overflow-wrap: anywhere; }
button.workflow-resource-title { cursor: pointer; border-radius: 4px; }
button.workflow-resource-title:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.workflow-resource.is-selected { border: none; box-shadow: none; }
.workflow-resource.is-selected .workflow-resource-icon { filter: drop-shadow(0 0 7px currentColor); transform: scale(1.06); }
.workflow-node-main { position: relative; display: flex; flex-direction: column; min-height: 174px; }
.workflow-node-main > :deep(.vue-flow__handle-left),
.workflow-node-main > :deep(.vue-flow__handle-right) { top: 86px; }
.workflow-node-heading, .workflow-node-body { transition: opacity 160ms; }
.workflow-store-slot { font: 10px/16px var(--font-mono, monospace); color: var(--muted-foreground); }
.workflow-resources-toggle { display: flex; align-items: center; gap: 5px; width: 100%; min-height: 32px; padding: 6px 10px; border-top: 1px solid var(--border); color: var(--muted-foreground); cursor: pointer; font-size: 10px; text-align: left; border-radius: 0 0 8px 8px; }
.workflow-resources-toggle:hover { color: var(--foreground); background: var(--accent); }
.workflow-resources-count { font-variant-numeric: tabular-nums; }
.workflow-resources-related { margin-left: auto; font-size: 9px; color: var(--primary); }
.workflow-resource-panel { padding: 8px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--muted) 30%, var(--card)); border-radius: 0 0 8px 8px; }
.workflow-resource-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; padding-bottom: 8px; }
.workflow-resource-row-kind { display: flex; justify-content: center; padding-top: 7px; opacity: .65; }
.workflow-resource-cells { display: grid; grid-template-columns: repeat(var(--resource-columns), minmax(0, 1fr)); column-gap: 6px; }
.workflow-resource-cell { position: relative; display: flex; flex-direction: column; align-items: center; height: 64px; border-radius: 5px; transition: opacity 160ms, background 160ms; }
.workflow-resource-select { position: relative; display: flex; justify-content: center; padding: 5px; cursor: pointer; border-radius: 5px; }
.workflow-resource-select:hover { background: var(--accent); }
.workflow-resource-caption { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; font-size: 10px; line-height: 12px; text-align: center; overflow-wrap: anywhere; cursor: pointer; color: var(--foreground); }
.workflow-resource-caption:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 2px; }
.workflow-resource-caption:disabled { cursor: default; }
.workflow-resource-warning { position: absolute; top: 0; right: 0; color: var(--destructive); }
.workflow-resource-cell :deep(.vue-flow__handle) { width: 3px; height: 3px; min-width: 3px; min-height: 3px; border: none; opacity: 0; }
.is-resource-selected { background: var(--accent); outline: 1px solid var(--ring); }
</style>
