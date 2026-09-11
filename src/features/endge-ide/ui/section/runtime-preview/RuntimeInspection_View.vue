<script setup lang="ts">
import { Braces, Info, MonitorPlay, RefreshCw, Workflow } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import RuntimePreviewRenderable from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreviewRenderable.vue'
import StoreFieldsPreview from '@/features/endge-ide/ui/section/runtime-preview/StoreFieldsPreview.vue'
import WorkspaceWorkflowView from '@/features/workspace-workflow/ui/WorkspaceWorkflow_View.vue'

const { t } = useI18n()
const inspection = EndgeIDE.runtimeInspection
const session = Configurator.remoteDebugger
const tab = ref<'preview' | 'data' | 'workflow' | 'details'>('preview')
const capturedAt = computed(() => {
  const time = inspection.inspection.value.dataGeneratedAt
  return time ? new Date(time).toLocaleTimeString() : null
})
const fields = computed(() => {
  const host = inspection.selectedHost.value
  const data = inspection.selectedData.value
  if (host?.entityType !== 'store' || !data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const derived = new Set(Array.isArray(host.context.derivedFields) ? host.context.derivedFields : [])
  return Object.entries(data).map(([key, value]) => ({ key, value, kind: derived.has(key) ? 'derived' : 'value' }))
})
watch([tab, inspection.workflow], ([value, workflow]) => {
  if (value === 'workflow' && !workflow) {
    inspection.prepareWorkflow()
  }
})

async function refresh(): Promise<void> {
  try {
    await session.refreshInspection()
  }
  catch (error) {
    report(error)
  }
}

async function interval(event: Event): Promise<void> {
  try {
    await session.setInspectionInterval(Number((event.target as HTMLSelectElement).value))
  }
  catch (error) {
    report(error)
  }
}

function report(error: unknown): void {
  toast.error(t('runtimeInspection.refreshFailed'), { description: error instanceof Error ? error.message : String(error) })
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-1 border-b px-3 py-1">
      <div class="flex gap-1" role="tablist" :aria-label="t('runtimeInspection.tabs')">
        <Button id="inspection-preview-tab" role="tab" :aria-selected="tab === 'preview'" aria-controls="inspection-preview" :variant="tab === 'preview' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'preview'">
          <MonitorPlay class="mr-1.5 size-4" />{{ t('runtimeWorkflow.preview') }}
        </Button>
        <Button id="inspection-data-tab" role="tab" :aria-selected="tab === 'data'" aria-controls="inspection-data" :variant="tab === 'data' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'data'">
          <Braces class="mr-1.5 size-4" />{{ t('runtimeInspection.data') }}
        </Button>
        <Button id="inspection-workflow-tab" role="tab" :aria-selected="tab === 'workflow'" aria-controls="inspection-workflow" :variant="tab === 'workflow' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'workflow'">
          <Workflow class="mr-1.5 size-4" />{{ t('workspaceWorkflow.title') }}
        </Button>
        <Button id="inspection-details-tab" role="tab" :aria-selected="tab === 'details'" aria-controls="inspection-details" :variant="tab === 'details' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'details'">
          <Info class="mr-1.5 size-4" />{{ t('runtimeInspection.details') }}
        </Button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <select class="h-8 rounded-md border bg-background px-2 text-xs" :aria-label="t('runtimeInspection.interval')" :value="session.inspectionInterval.value" :disabled="!session.canControl.value || session.inspectionBusy.value || session.skipData.value" @change="interval">
          <option :value="0">
            {{ t('runtimeInspection.manual') }}
          </option>
          <option :value="1000">
            {{ t('runtimeInspection.every', { seconds: 1 }) }}
          </option>
          <option :value="5000">
            {{ t('runtimeInspection.every', { seconds: 5 }) }}
          </option>
          <option :value="10000">
            {{ t('runtimeInspection.every', { seconds: 10 }) }}
          </option>
        </select>
        <Button variant="ghost" size="sm" :disabled="!session.canControl.value || session.inspectionBusy.value" @click="refresh">
          <RefreshCw class="mr-1.5 size-3.5" :class="session.inspectionBusy.value && 'animate-spin'" />{{ t('runtimeInspection.refresh') }}
        </Button>
      </div>
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
      <span class="min-w-0 truncate">{{ inspection.selectedNode.value?.title ?? t('runtimeInspection.allData') }}</span>
      <span>{{ capturedAt ? t('runtimeInspection.capturedAt', { time: capturedAt }) : t('runtimeInspection.noData') }}</span>
    </div>
    <p v-if="inspection.inspection.value.dataError" class="shrink-0 border-b px-4 py-2 text-xs text-destructive" role="alert">
      {{ inspection.inspection.value.dataError }}
    </p>
    <div v-if="tab === 'preview'" id="inspection-preview" role="tabpanel" aria-labelledby="inspection-preview-tab" class="flex min-h-0 flex-1 flex-col">
      <p class="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
        {{ t('runtimeInspection.previewReadonly') }}
      </p>
      <div class="runtime-inspection-preview flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
        <section v-for="item in inspection.renderables.value" :key="item.key" class="runtime-inspection-renderable min-h-0 min-w-0">
          <RuntimePreviewRenderable :item="item" />
        </section>
        <p v-if="!inspection.renderables.value.length" class="py-8 text-center text-sm text-muted-foreground">
          {{ inspection.selectedNode.value ? t('runtimeInspection.noRenderables') : t('runtimeInspection.selectPreview') }}
        </p>
      </div>
    </div>
    <div v-else-if="tab === 'data'" id="inspection-data" role="tabpanel" aria-labelledby="inspection-data-tab" class="min-h-0 flex-1 overflow-auto p-4">
      <StoreFieldsPreview v-if="fields" :fields="fields" :value-label="t('runtimeInspection.snapshotValue')" />
      <SourceJsonTree v-else-if="inspection.inspection.value.dataGeneratedAt" :data="inspection.selectedData.value" :root-path="inspection.selectedHost.value?.basePath ?? 'data'" />
      <p v-else class="py-8 text-center text-sm text-muted-foreground">
        {{ t('runtimeInspection.noData') }}
      </p>
    </div>
    <div v-else-if="tab === 'details'" id="inspection-details" role="tabpanel" aria-labelledby="inspection-details-tab" class="min-h-0 flex-1 overflow-auto p-4">
      <SourceJsonTree :data="inspection.selectedDescriptor.value" root-path="runtime" />
    </div>
    <div v-else id="inspection-workflow" role="tabpanel" aria-labelledby="inspection-workflow-tab" class="flex min-h-0 flex-1 flex-col">
      <p class="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
        {{ t('runtimeInspection.activeOnly') }}
      </p>
      <WorkspaceWorkflowView v-if="inspection.workflow.value" :workflow="inspection.workflow.value" :runtime-active-ids="inspection.activeWorkflowIds.value" @toggle-resources="inspection.workflow.value?.toggleResources($event)" @viewport-change="inspection.workflow.value?.setViewport($event)" />
    </div>
  </section>
</template>

<style scoped>
.runtime-inspection-renderable:has(:deep([data-endge-layout-fill-height])) { display: flex; flex: 1 1 0; flex-direction: column; min-height: 15rem; }
.runtime-inspection-renderable:has(:deep([data-endge-layout-fill-height])) > :deep(*) { flex: 1 1 0; min-height: 0; }
.runtime-inspection-renderable :deep(.endge-sfc-table) { min-height: 0; }
</style>
