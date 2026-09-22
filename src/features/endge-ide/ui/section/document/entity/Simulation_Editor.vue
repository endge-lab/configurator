<script setup lang="ts">
import type { SimulationSourceCompileResult } from '@endge/core'
import type { RSimulationEditor } from '@/features/endge-ide/domain/entities/RSimulationEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  FileJson,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/services/diagnostics/editor-diagnostics-entity-ref'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentGeneralSettingsPanel from '@/features/endge-ide/ui/components/DocumentGeneralSettingsPanel.vue'
import SimulationSourceEditor from '@/features/endge-ide/ui/components/SimulationSourceEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import { useSmartTabSelection } from '@/features/endge-ide/ui/smart-tabs'

interface SourceEditorHandle {
  formatDocument: () => Promise<void>
}

const editor = computed(
  () => EndgeIDE.tabs.documentEditorModel.value as RSimulationEditor | null,
)
const activeTab = useSmartTabSelection('editor.active-tab', 'source', [
  'general',
  'source',
  'artifact',
  'diagnostics',
] as const)
const sourceEditorRef = ref<SourceEditorHandle | null>(null)
const domainVersion = ref(0)
const unsubscribeDomain = Endge.domain.subscribe(() => {
  domainVersion.value += 1
})
onBeforeUnmount(unsubscribeDomain)
const compiled = computed(() => {
  void domainVersion.value
  return editor.value ? Endge.source.compile('simulation', editor.value.source) : null
})
const artifactJson = computed(() =>
  JSON.stringify(compiled.value?.artifact ?? null, null, 2),
)
const authoringDiagnostics = computed(() =>
  (compiled.value?.diagnostics ?? []) as SimulationSourceCompileResult['diagnostics'],
)
const diagnosticsEntityRef = computed(() =>
  createEditorDiagnosticsEntityRef('simulation', editor.value),
)
function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}
const launchLoading = ref(false)
async function launchPreview(): Promise<void> {
  if (!editor.value) {
    return
  }
  launchLoading.value = true
  try {
    editor.value.refreshDiagnostics()
    await EndgeIDE.runtimePreview.launchEditor(editor.value)
  }
  finally {
    launchLoading.value = false
  }
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
    :display-name="editor.name"
    document-type="simulation"
    :dependency-source="editor.source"
    :dependency-draft="editor"
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
                :class="
                  activeTab === 'general'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="$t('uiText.basic127492c2')"
                @click="activeTab = 'general'"
              >
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.basic127492c2') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'source'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Source"
                @click="activeTab = 'source'"
              >
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.sourceda13add2') }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="launchLoading"
                aria-label="Запустить preview симуляции"
                @click="launchPreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.runRuntimePreviewCtrlEnterF142bef6') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'artifact'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Артифакт"
                @click="activeTab = 'artifact'"
              >
                <FileJson class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.artifactA171cb33') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'diagnostics'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="$t('uiText.diagnosis9ba1e22a')"
                @click="activeTab = 'diagnostics'"
              >
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.diagnosis9ba1e22a') }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="EndgeIDE.busy.value"
                :aria-label="$t('uiText.save4864057d')"
                @click="EndgeIDE.tabs.save()"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <SourceFormatButton
            v-if="activeTab === 'source'"
            @click="sourceEditorRef?.formatDocument()"
          />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :aria-label="$t('uiText.resetSourceC19e2677')"
                @click="editor.resetSource()"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.resetSourceC19e2677') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DocumentGeneralSettingsPanel v-if="activeTab === 'general'">
        <div class="max-w-2xl space-y-5">
          <DocumentIdField :document-id="editor.id" />
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="simulation-name">{{ $t('uiText.displayNamec7874aaa') }}</Label>
              <Input id="simulation-name" v-model="editor.name" />
            </div>
            <div class="space-y-2">
              <Label for="simulation-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
              <DocumentIdentityInput
                id="simulation-identity"
                v-model="editor.identity"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="simulation-description">{{ $t('uiText.descriptionF5441f6a') }}</Label>
            <Textarea
              id="simulation-description"
              v-model="editor.description"
              :rows="4"
            />
          </div>
          <div class="max-w-xs space-y-2">
            <Label for="simulation-source-version">{{ $t('uiText.sourceVersionb94adbb6') }}</Label>
            <Input
              id="simulation-source-version"
              v-model.number="editor.sourceVersion"
              type="number"
              min="1"
              max="1"
              readonly
            />
          </div>
        </div>
      </DocumentGeneralSettingsPanel>
      <SimulationSourceEditor
        v-else-if="activeTab === 'source'"
        ref="sourceEditorRef"
        :model-value="editor.source"
        :owner-identity="editor.identity"
        @update:model-value="updateSource"
      />
      <pre
        v-else-if="activeTab === 'artifact'"
        class="h-full overflow-auto bg-muted/30 p-4 text-xs"
      >{{ artifactJson }}</pre>
      <EntityProblemsPanel
        v-else-if="diagnosticsEntityRef"
        :entity-ref="diagnosticsEntityRef"
        :authoring-diagnostics="authoringDiagnostics"
        class="h-full"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
