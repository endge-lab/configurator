<script setup lang="ts">
import type { EndgeConfigurationContribution } from '@endge/core'
import type { RFacetDocumentEditor } from '@/features/endge-ide/domain/entities/RFacetDocumentEditor'

import { Endge } from '@endge/core'
import { Loader2, Save, Settings2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RFacetDocumentEditor | null)
const metadataSession = computed<any>(() => EndgeIDE.tabs.documentMetadataSession.value ?? null)
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: (value) => {
    if (editor.value) {
      editor.value.configuration = value
    }
  },
})
const upstreamConfiguration = computed(() =>
  Endge.configuration.resolveUpstream({ facetIdentity: editor.value?.facetIdentity ?? '' }),
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell v-if="editor" :document-id="editor.id" :identity="editor.identity">
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Button type="button" size="icon" variant="ghost" class="h-7 w-7 bg-editor-control shadow-sm" aria-label="Настройки">
            <Settings2 class="size-4" />
          </Button>
        </div>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button type="button" size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value || !editor.identity.trim() || !editor.displayName.trim()" aria-label="Сохранить" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" /><Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('facets.save') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="min-h-0 flex-1 bg-muted/25 p-4">
      <div class="h-full overflow-hidden rounded-xl border bg-card/85 shadow-sm dark:rounded-none dark:bg-editor-surface">
        <div class="h-full min-h-0 p-4 lg:p-5">
          <ConfigurationSettingsEditor
            v-model="configuration"
            variant="contribution"
            contribution-mode="inherit-only"
            document-metadata
            :metadata-session="metadataSession"
            :upstream="upstreamConfiguration"
          >
            <template #general>
              <section class="max-w-2xl space-y-4">
                <DocumentIdField :document-id="editor.id" />
                <div class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {{ $t('facets.facet') }} <code>{{ editor.facetIdentity }}</code>
                </div>
                <div class="space-y-2">
                  <Label for="facet-document-identity">{{ $t('facets.identity') }}</Label><DocumentIdentityInput id="facet-document-identity" v-model="editor.identity" placeholder="moscow" />
                </div>
                <div class="space-y-2">
                  <Label for="facet-document-name">{{ $t('facets.name') }}</Label><Input id="facet-document-name" v-model="editor.displayName" placeholder="Москва" />
                </div>
                <div class="space-y-2">
                  <Label for="facet-document-description">{{ $t('facets.description') }}</Label><Textarea id="facet-document-description" v-model="editor.description" :rows="4" />
                </div>
              </section>
            </template>
          </ConfigurationSettingsEditor>
        </div>
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
