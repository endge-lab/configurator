<script setup lang="ts">
import type { EndgeConfigurationContribution } from '@endge/core'
import type { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  FileJson,
  Loader2,
  Play,
  Save,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import CompositionSourceEditor from '@/features/endge-ide/ui/components/CompositionSourceEditor.vue'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import { useSmartTabSelection } from '@/features/endge-ide/ui/smart-tabs'

const props = defineProps<{
  tabContext?: { editor?: RProjectEditor }
}>()

const { t } = useI18n()

const editor = computed<RProjectEditor | null>(
  () => props.tabContext?.editor ?? null,
)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'general',
  ['general', 'composition', 'configuration', 'artifact', 'diagnostics'] as const,
)
const launchLoading = ref(false)
const sourceEditorRef = ref<{ formatDocument: () => Promise<void> } | null>(null)
const artifactJson = computed(() => JSON.stringify(
  editor.value ? Endge.source.compile('composition', editor.value.source).artifact ?? null : null,
  null,
  2,
))
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('project', editor.value))
const tabGroups = computed(() => [
  {
    label: 'Разделы проекта',
    items: [
      { value: 'general', icon: Settings2, label: 'Основное' },
      { value: 'composition', icon: Code2, label: 'Композиция' },
    ],
  },
  {
    label: 'Конфигурация проекта',
    items: [{ value: 'configuration', icon: SlidersHorizontal, label: 'Конфигурация' }],
  },
] as const)
const runtimeTabs = computed(() => [
  { value: 'diagnostics', icon: TriangleAlert, label: t('uiText.diagnosis9ba1e22a') },
  { value: 'artifact', icon: FileJson, label: t('uiText.artifactA171cb33') },
] as const)

const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: (value) => {
    if (editor.value) {
      editor.value.configuration = value
    }
  },
})
const upstreamConfiguration = computed(() =>
  Endge.configuration.resolveUpstream('project'),
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

async function launchRuntimePreview(): Promise<void> {
  if (!editor.value) {
    return
  }
  launchLoading.value = true
  try {
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
    :display-name="editor.displayName"
    document-type="project"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <template v-for="group in tabGroups" :key="group.label">
          <div role="group" :aria-label="group.label" class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip v-for="item in group.items" :key="item.value">
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7"
                  :class="
                    activeTab === item.value
                      ? 'bg-editor-control shadow-sm'
                      : 'text-muted-foreground'
                  "
                  :aria-label="item.label"
                  @click="activeTab = item.value"
                >
                  <component :is="item.icon" class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ item.label }}</TooltipContent>
            </Tooltip>
          </div>
          <Separator orientation="vertical" class="mx-0.5 h-5" />
        </template>
        <div role="group" aria-label="Запуск и диагностика" class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Запустить Runtime Preview"
                :disabled="!editor.identity || launchLoading"
                @click="launchRuntimePreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ $t('uiText.runProjectRuntimePreviewCtrlEnter64161c9b') }}
            </TooltipContent>
          </Tooltip>
          <Tooltip v-for="item in runtimeTabs" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="activeTab === item.value ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
                :aria-label="item.label"
                @click="activeTab = item.value"
              >
                <component :is="item.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ item.label }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
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
      <SourceFormatButton v-if="activeTab === 'composition'" @click="sourceEditorRef?.formatDocument()" />
    </template>

    <div class="min-h-0 flex-1" :class="activeTab === 'composition' ? '' : 'bg-muted/25 p-4'">
      <div class="h-full w-full overflow-hidden" :class="activeTab === 'composition' ? '' : 'rounded-xl border border-border/80 bg-card/85 shadow-sm dark:rounded-none dark:bg-editor-surface'">
        <CompositionSourceEditor
          v-if="activeTab === 'composition'"
          ref="sourceEditorRef"
          v-model="editor.source"
          class="h-full"
          owner-type="project"
          :owner-id="editor.id"
          :owner-identity="editor.identity"
        />
        <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto p-4 text-xs">{{ artifactJson }}</pre>
        <EntityProblemsPanel v-else-if="activeTab === 'diagnostics' && diagnosticsEntityRef" :entity-ref="diagnosticsEntityRef" />
        <ScrollArea v-else-if="activeTab === 'general'" class="h-full">
          <div class="w-full p-6 lg:p-8">
            <section class="max-w-2xl space-y-4">
              <DocumentIdField :document-id="editor.id" />
              <div class="space-y-2">
                <Label for="project-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
                <DocumentIdentityInput
                  id="project-identity"
                  v-model="editor.identity"
                  placeholder="my-project"
                />
              </div>
              <div class="space-y-2">
                <Label for="project-display-name">{{ $t('uiText.displayNamec7874aaa') }}</Label>
                <Input
                  id="project-display-name"
                  v-model="editor.displayName"
                  placeholder="Мой проект"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ $t('uiText.slugURLfd185dc1') }}</Label>
                <Input
                  :model-value="editor?.slug ?? ''"
                  placeholder="my-project"
                  @update:model-value="
                    (value) =>
                      editor && (editor.slug = value == null ? null : String(value))
                  "
                />
              </div>
              <div class="space-y-2">
                <Label>{{ $t('uiText.descriptionF5441f6a') }}</Label>
                <Textarea
                  :model-value="editor.description ?? ''"
                  :rows="4"
                  placeholder="Краткое описание проекта"
                  @update:model-value="
                    (value) =>
                      editor && (editor.description = String(value || '') || null)
                  "
                />
              </div>
              <div class="space-y-2">
                <Label>{{ $t('uiText.sortOrderf6529d95') }}</Label>
                <Input
                  type="number"
                  :model-value="editor?.order ?? ''"
                  placeholder="0"
                  @update:model-value="
                    (v) =>
                      editor
                      && (editor.order = v === '' || v == null ? null : Number(v))
                  "
                />
              </div>
            </section>
          </div>
        </ScrollArea>

        <div v-else-if="activeTab === 'configuration'" class="h-full min-h-0 p-4 lg:p-5">
          <ConfigurationSettingsEditor
            v-model="configuration"
            class="min-h-0"
            variant="contribution"
            :upstream="upstreamConfiguration"
          />
        </div>
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
