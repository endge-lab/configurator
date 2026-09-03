<script setup lang="ts">
import type { EndgeConfiguration, EndgeDataMode } from '@endge/core'

import { Endge } from '@endge/core'
import { CircleHelp, Loader2, Save } from 'lucide-vue-next'
import { onScopeDispose, ref } from 'vue'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const configuration = ref<EndgeConfiguration>(clone(Endge.workspace.current.configuration))
const dataMode = ref<EndgeDataMode>(Endge.workspace.current.dataMode)
const workspaceIdentity = ref(Endge.workspace.current.identity)
const workspaceDisplayName = ref(Endge.workspace.current.displayName)
const workspaceDocumentId = ref(resolveWorkspaceDocumentId())

const offWorkspace = Endge.workspace.subscribe(() => {
  configuration.value = clone(Endge.workspace.current.configuration)
  dataMode.value = Endge.workspace.current.dataMode
  workspaceIdentity.value = Endge.workspace.current.identity
  workspaceDisplayName.value = Endge.workspace.current.displayName
  workspaceDocumentId.value = resolveWorkspaceDocumentId()
})
onScopeDispose(offWorkspace)

async function save(): Promise<void> {
  try {
    const previousEffectiveDataMode = Endge.context.dataMode
    await EndgeIDE.runBusy(Endge.domainRepository.saveDocument(Endge.workspace.current.identity, 'workspace', {
      model: {
        identity: Endge.workspace.current.identity,
        displayName: Endge.workspace.current.displayName,
        dataMode: dataMode.value,
        configuration: configuration.value,
      },
    }))
    if (previousEffectiveDataMode !== Endge.context.dataMode) {
      await EndgeIDE.runtimePreview.restartForDataModeChange()
    }
    toast.success('Рабочее пространство сохранено')
  }
  catch (error: any) {
    toast.error('Не удалось сохранить рабочее пространство', {
      description: String(error?.message ?? error),
    })
  }
}

function setWorkspaceMockMode(enabled: boolean): void {
  dataMode.value = enabled ? 'mock' : 'live'
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function resolveWorkspaceDocumentId(): string | null {
  return Endge.domainRepository.getLoadedSnapshot()?.workspace.state.id ?? null
}
</script>

<template>
  <SourceDocumentEditorShell
    :document-id="workspaceDocumentId"
    :identity="workspaceIdentity"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="min-h-0 flex-1 overflow-hidden p-4">
      <ConfigurationSettingsEditor v-model="configuration" variant="root">
        <template #general>
          <div class="max-w-2xl space-y-4">
            <DocumentIdField :document-id="workspaceDocumentId" />
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="workspace-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
                <DocumentIdentityInput id="workspace-identity" :model-value="workspaceIdentity" disabled />
              </div>
              <div class="space-y-2">
                <Label for="workspace-display-name">{{ $t('uiText.name3de49828') }}</Label>
                <Input id="workspace-display-name" :model-value="workspaceDisplayName" disabled />
              </div>
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
                :checked="dataMode === 'mock'"
                aria-label="Включить mock-данные Workspace по умолчанию"
                @update:checked="setWorkspaceMockMode"
              />
            </section>
          </div>
        </template>
      </ConfigurationSettingsEditor>
    </div>
  </SourceDocumentEditorShell>
</template>
