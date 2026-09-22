<script setup lang="ts">
import { MonitorPlay, Workflow } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import RuntimePreviewSurface from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreviewSurface.vue'
import WorkspaceWorkflowView from '@/features/workspace-workflow/ui/WorkspaceWorkflow_View.vue'

const { t } = useI18n()
const preview = EndgeIDE.runtimePreview
const tab = ref<'preview' | 'workflow'>('preview')
watch([tab, preview.workflow], ([value, workflow]) => {
  if (value === 'workflow' && !workflow) {
    preview.prepareWorkflow()
  }
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 gap-1 border-b px-3 py-1" role="tablist" :aria-label="t('runtimeWorkflow.tabs')">
      <Button id="runtime-preview-tab" type="button" role="tab" :aria-selected="tab === 'preview'" aria-controls="runtime-preview-panel" :variant="tab === 'preview' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'preview'">
        <MonitorPlay class="mr-1.5 size-4" />{{ t('runtimeWorkflow.preview') }}
      </Button>
      <Button id="runtime-workflow-tab" type="button" role="tab" :aria-selected="tab === 'workflow'" aria-controls="runtime-workflow-panel" :variant="tab === 'workflow' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'workflow'">
        <Workflow class="mr-1.5 size-4" />{{ t('workspaceWorkflow.title') }}
      </Button>
    </div>
    <div v-show="tab === 'preview'" id="runtime-preview-panel" role="tabpanel" aria-labelledby="runtime-preview-tab" class="min-h-0 flex-1">
      <RuntimePreviewSurface />
    </div>
    <div v-if="tab === 'workflow'" id="runtime-workflow-panel" role="tabpanel" aria-labelledby="runtime-workflow-tab" class="flex min-h-0 flex-1 flex-col">
      <p class="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
        {{ t('runtimeWorkflow.activeOnly') }}
      </p>
      <WorkspaceWorkflowView
        v-if="preview.workflow.value"
        :workflow="preview.workflow.value"
        :runtime-active-ids="preview.activeWorkflowIds.value"
        @toggle-resources="preview.workflow.value?.toggleResources($event)"
        @viewport-change="preview.workflow.value?.setViewport($event)"
      />
    </div>
  </section>
</template>
