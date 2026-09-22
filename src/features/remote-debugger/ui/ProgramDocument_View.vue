<script setup lang="ts">
import { Endge, restoreProgramArtifactSource } from '@endge/core'

import { Braces, Code2, Download, FileJson2, Settings2, TriangleAlert } from 'lucide-vue-next'
import { TabsList, TabsTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import { useSmartTabViewState } from '@/features/endge-ide/ui/smart-tabs'
import InspectionTextEditor from './InspectionText_Editor.vue'

const props = defineProps<{ documentKey: string }>()
const section = useSmartTabViewState<string>('inspection.section', {
  defaultValue: () => 'general',
})
const document = computed(
  () => Endge.program.catalog.documents[props.documentKey],
)
const selectedArtifact = useSmartTabViewState<string>('inspection.artifact', {
  defaultValue: () => document.value?.artifactKeys[0] ?? '',
})
const artifact = computed(() =>
  Endge.program
    .getArtifacts()
    .find(
      value =>
        `${value.ref.entityType}:${value.ref.id}` === selectedArtifact.value,
    ),
)
const ast = computed(
  () => (artifact.value?.payload as { ast?: unknown } | undefined)?.ast,
)
const text = computed(() => {
  if (!artifact.value) {
    return null
  }
  try {
    return restoreProgramArtifactSource(artifact.value)
  }
  catch {
    return null
  }
})
const { t } = useI18n()
const language = computed(() => artifact.value?.ref.entityType === 'component-sfc' ? 'html' : artifact.value?.ref.entityType === 'style' ? 'css' : 'typescript')
const sections = computed(() => [
  { id: 'general', label: t('bundleInspection.general'), icon: Settings2 },
  { id: 'text', label: t('bundleInspection.text'), icon: Code2 },
  { id: 'artifact', label: t('bundleInspection.artifact'), icon: FileJson2 },
  { id: 'ast', label: t('bundleInspection.ast'), icon: Braces },
  { id: 'diagnostics', label: t('bundleInspection.diagnostics'), icon: TriangleAlert },
])
</script>

<template>
  <Tabs v-model="section" class="flex h-full min-h-0 flex-col gap-0">
    <SourceDocumentEditorShell>
      <template #center>
        <TooltipProvider>
          <TabsList class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip v-for="item in sections" :key="item.id">
              <TooltipTrigger as-child>
                <TabsTrigger :value="item.id" as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :class="section === item.id ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
                    :aria-label="item.label"
                  >
                    <component :is="item.icon" class="size-4" />
                  </Button>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>{{ item.label }}</TooltipContent>
            </Tooltip>
          </TabsList>
          <template v-if="artifact">
            <Separator orientation="vertical" class="mx-0.5 h-5" />
            <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :aria-label="t('bundleInspection.exportArtifact')"
                    @click="Configurator.remoteDebugger.downloadArtifact(selectedArtifact)"
                  >
                    <Download class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t('bundleInspection.exportArtifact') }}</TooltipContent>
              </Tooltip>
            </div>
          </template>
        </TooltipProvider>
      </template>
      <div v-if="(document?.artifactKeys.length ?? 0) > 1" class="flex shrink-0 items-center gap-2 border-b p-2">
        <Select
          v-if="(document?.artifactKeys.length ?? 0) > 1"
          v-model="selectedArtifact"
        >
          <SelectTrigger class="w-52">
            <SelectValue />
          </SelectTrigger><SelectContent>
            <SelectItem
              v-for="key in document?.artifactKeys"
              :key="key"
              :value="key"
            >
              {{ key }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TabsContent value="general" class="m-0 min-h-0 flex-1 overflow-auto p-6">
        <div v-if="document" class="max-w-2xl space-y-5" data-testid="compiled-document-settings">
          <p class="text-xs text-muted-foreground">
            {{ t('bundleInspection.readOnlyDocument') }}
          </p>
          <div class="grid gap-5 sm:grid-cols-2">
            <div class="space-y-2">
              <Label :for="`${documentKey}-name`">{{ t('bundleInspection.documentName') }}</Label>
              <Input :id="`${documentKey}-name`" :model-value="document.displayName" readonly />
            </div>
            <div class="space-y-2">
              <Label :for="`${documentKey}-identity`">{{ t('bundleInspection.documentIdentity') }}</Label>
              <DocumentIdentityInput :id="`${documentKey}-identity`" :model-value="document.identity" readonly />
            </div>
            <DocumentIdField :document-id="document.id" />
            <div class="space-y-2">
              <Label :for="`${documentKey}-type`">{{ t('bundleInspection.documentType') }}</Label>
              <Input :id="`${documentKey}-type`" :model-value="document.entityType" readonly />
            </div>
          </div>
          <p class="text-sm">
            {{ document.status === 'compiled' ? t('bundleInspection.compiledDocument') : t('bundleInspection.noArtifact') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('bundleInspection.metadataUnavailable') }}
          </p>
          <details class="border-t pt-3">
            <summary class="cursor-pointer text-sm">
              {{ t('bundleInspection.catalogDetails') }}
            </summary>
            <SourceJsonTree :data="document" class="mt-3" />
          </details>
        </div>
      </TabsContent>
      <TabsContent value="text" class="m-0 flex min-h-0 flex-1 flex-col">
        <p v-if="text === null" class="shrink-0 px-3 py-2 text-xs text-muted-foreground">
          {{
            ast
              ? t('bundleInspection.unsupportedAstText')
              : t('bundleInspection.sourceUnavailable')
          }}
        </p>
        <InspectionTextEditor v-if="text !== null" :text="text" :language="language" class="flex-1" />
      </TabsContent>
      <TabsContent value="ast" class="m-0 min-h-0 flex-1 overflow-auto p-3">
        <SourceJsonTree v-if="ast" :data="ast" />
        <p v-else class="text-sm text-muted-foreground">
          {{ t('bundleInspection.noAst') }}
        </p>
      </TabsContent>
      <TabsContent value="artifact" class="m-0 min-h-0 flex-1 overflow-auto p-3">
        <SourceJsonTree v-if="artifact" :data="artifact" />
        <p v-else class="text-sm text-muted-foreground">
          {{ t('bundleInspection.noArtifact') }}
        </p>
      </TabsContent>
      <TabsContent
        value="diagnostics"
        class="m-0 min-h-0 flex-1 overflow-auto p-3"
      >
        <SourceJsonTree :data="artifact?.diagnostics ?? []" />
      </TabsContent>
    </SourceDocumentEditorShell>
  </Tabs>
</template>
