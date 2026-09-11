<script setup lang="ts">
import type { WorkflowNodeData } from '@/features/workspace-workflow/domain/WorkspaceWorkflow'
import { Endge } from '@endge/core'
import { CircleHelp, Layers3, Loader2, Save, Settings2, Workflow } from 'lucide-vue-next'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { buildWorkflowDependencyTree } from '@/features/endge-ide/tools/workflow-dependency-tree'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const WorkspaceWorkflow_View = defineAsyncComponent(() => import('@/features/workspace-workflow/ui/WorkspaceWorkflow_View.vue'))
const WorkspaceFacetsPanel = defineAsyncComponent(() => import('@/features/endge-ide/ui/components/facets/WorkspaceFacetsPanel.vue'))
const { t } = useI18n()
const workspace = EndgeIDE.workspace
workspace.open()
const editor = workspace.editor
const activeTab = computed<'general' | 'workflow'>({
  get: () => EndgeIDE.tabs.getTabViewState('workspace-settings', 'workspace.active-tab')?.value === 'workflow' ? 'workflow' : 'general',
  set: value => EndgeIDE.tabs.setTabViewState('workspace-settings', 'workspace.active-tab', { version: 1, value }),
})
const workspaceSettingsSection = ref('general')
const facetSettingsActive = computed(() => activeTab.value === 'general' && workspaceSettingsSection.value === 'additional:workspace-facets')
const workspaceDocumentId = computed(() => {
  void editor.value?.identity
  return Endge.domainRepository.getLoadedSnapshot()?.workspace.state.id ?? null
})
const workspaceDirty = computed(() => editor.value?.dirty === true || workspace.metadataSession.value?.dirty === true)
const workflowDependencies = computed(() => {
  if (activeTab.value !== 'workflow' || !editor.value || !workspace.root.value) {
    return null
  }
  const root = workspace.root.value
  const selection = editor.value.workflow.selection
  return buildWorkflowDependencyTree(selection.length ? selection : [{ node: root, usages: [], dependencies: root.children }], {
    selection: t('workspaceWorkflow.selectedElements'),
    usages: t('workspaceWorkflow.usedBy'),
    dependencies: t('uiText.dependencies898afdf0'),
  })
})
watch([activeTab, editor], ([tab]) => {
  if (tab === 'workflow') {
    workspace.prepareWorkflow()
  }
}, { immediate: true })

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function setWorkspaceMockMode(enabled: boolean): void {
  if (editor.value) {
    editor.value.dataMode = enabled ? 'mock' : 'live'
  }
}

function openWorkflowDocument(data: WorkflowNodeData): void {
  if (data.documentType === 'workspace') {
    activeTab.value = 'general'
  }
  else if (data.documentType) {
    EndgeIDE.tabs.openDocument(data.identity, data.documentType)
  }
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="workspaceDocumentId"
    :identity="editor.identity"
    :display-name="editor.displayName"
    :document-type="activeTab === 'workflow' ? 'workspace' : undefined"
    :dependency-tree="workflowDependencies"
  >
    <template #center>
      <TooltipProvider>
        <div role="group" :aria-label="t('workspaceWorkflow.sections')" class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-for="item in [{ value: 'general', icon: Settings2, label: t('workspaceWorkflow.general') }, { value: 'workflow', icon: Workflow, label: t('workspaceWorkflow.title') }] as const" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="activeTab === item.value ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
                :aria-label="item.label"
                :aria-pressed="activeTab === item.value"
                @click="activeTab = item.value"
              >
                <component :is="item.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ item.label }}</TooltipContent>
          </Tooltip>
        </div>
        <div v-if="!facetSettingsActive" class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value || !editor.displayName.trim()"
                @click="save"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
        <span v-if="!facetSettingsActive && workspaceDirty" class="mx-1 size-1.5 rounded-full bg-amber-500" role="status" :aria-label="t('workspaceWorkflow.unsaved')" :title="t('workspaceWorkflow.unsaved')" />
      </TooltipProvider>
    </template>

    <WorkspaceWorkflow_View
      v-if="activeTab === 'workflow'"
      :workflow="editor.workflow"
      @open-document="openWorkflowDocument"
      @toggle-resources="workspace.toggleResources($event)"
      @viewport-change="workspace.setViewport($event)"
      @arrange="workspace.arrange()"
    />
    <div v-else class="min-h-0 flex-1 bg-muted/25 p-4">
      <ConfigurationSettingsEditor
        v-model="editor.configuration"
        variant="root"
        document-metadata
        :metadata-session="workspace.metadataSession.value"
        :after-general-section="{ identity: 'workspace-facets', label: t('facets.navigation'), icon: Layers3 }"
        @section-change="workspaceSettingsSection = $event"
      >
        <template #general>
          <div class="max-w-2xl space-y-4">
            <DocumentIdField :document-id="workspaceDocumentId" />
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="workspace-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
                <DocumentIdentityInput id="workspace-identity" :model-value="editor.identity" disabled />
              </div>
              <div class="space-y-2">
                <Label for="workspace-display-name">{{ $t('uiText.name3de49828') }}</Label>
                <Input id="workspace-display-name" v-model="editor.displayName" :disabled="EndgeIDE.busy.value" />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="workspace-document-structure">{{ t('workspaceWorkflow.metamodel.label') }}</Label>
              <Select v-model="editor.documentStructure" :disabled="EndgeIDE.busy.value">
                <SelectTrigger id="workspace-document-structure" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frontend">
                    {{ t('workspaceWorkflow.metamodel.frontend') }}
                  </SelectItem>
                  <SelectItem value="custom">
                    {{ t('workspaceWorkflow.metamodel.custom') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <section class="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-card/70 px-4 py-3">
              <div class="flex min-w-0 items-center gap-1.5">
                <p class="text-sm font-medium text-foreground">
                  {{ $t('uiText.defaultMockDataca5eb787') }}
                </p>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        class="size-6 shrink-0 text-muted-foreground"
                        aria-label="О mock-данных Workspace"
                      >
                        <CircleHelp class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-80 text-xs leading-5">
                      {{ $t('uiText.defaultModeForRuntimeApplicationsWhenEnabledExternal0cadcba0') }}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                :checked="editor.dataMode === 'mock'"
                aria-label="Включить mock-данные Workspace по умолчанию"
                @update:checked="setWorkspaceMockMode"
              />
            </section>
          </div>
        </template>
        <template #after-general>
          <WorkspaceFacetsPanel />
        </template>
      </ConfigurationSettingsEditor>
    </div>
  </SourceDocumentEditorShell>
</template>
