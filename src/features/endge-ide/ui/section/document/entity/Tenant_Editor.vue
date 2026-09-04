<script setup lang="ts">
import type { EndgeConfigurationContribution } from '@endge/core'

import { Endge } from '@endge/core'
import { Loader2, Save, Settings2, SlidersHorizontal } from 'lucide-vue-next'
import { computed } from 'vue'

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
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import { useSmartTabSelection } from '@/features/endge-ide/ui/smart-tabs'

const tabs = EndgeIDE.tabs
const editor = computed(
  () =>
    (tabs.documentEditorModel.value as {
      id: number | string
      identity: string
      displayName: string
      code: string
      description: string
      configuration: EndgeConfigurationContribution
    } | null) ?? null,
)
const documentModel = computed(
  () => (tabs.documentModel.value as { managedBy?: 'system' | 'integration' | 'user' } | null) ?? null,
)
const systemManaged = computed(() => documentModel.value?.managedBy === 'system')
const integrationManaged = computed(() => documentModel.value?.managedBy === 'integration')
const externallyManaged = computed(() => systemManaged.value || integrationManaged.value)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'general',
  ['general', 'configuration'] as const,
)
const tabButtons = [
  { value: 'general', icon: Settings2, label: 'Основное' },
  { value: 'configuration', icon: SlidersHorizontal, label: 'Конфигурация' },
] as const
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: (value) => {
    if (editor.value) {
      editor.value.configuration = value
    }
  },
})
const upstreamConfiguration = computed(() =>
  Endge.configuration.resolveUpstream('tenant'),
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #metadata-after>
      <div v-if="externallyManaged" class="flex min-w-0 items-center gap-1.5">
        <span class="shrink-0 text-muted-foreground">{{ $t('uiText.kind2b617982') }}</span>
        <span class="min-w-0 truncate font-mono text-foreground/80">{{ systemManaged ? $t('uiText.system317f1e76') : $t('uiText.integration06eff510') }}</span>
      </div>
    </template>

    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-for="item in tabButtons" :key="item.value">
            <TooltipTrigger as-child>
              <Button
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
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="externallyManaged || EndgeIDE.busy.value"
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

    <div class="min-h-0 flex-1 bg-muted/25 p-4">
      <div class="h-full w-full overflow-hidden rounded-xl border border-border/80 bg-card/85 shadow-sm dark:rounded-none dark:bg-editor-surface">
        <ScrollArea v-if="activeTab === 'general'" class="h-full">
          <div class="w-full p-6 lg:p-8">
            <section class="max-w-2xl space-y-4">
              <DocumentIdField :document-id="editor.id" />
              <div class="space-y-2">
                <Label for="tenant-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
                <DocumentIdentityInput
                  id="tenant-identity"
                  v-model="editor.identity"
                  :disabled="externallyManaged"
                  placeholder="tenant-default"
                />
              </div>
              <div class="space-y-2">
                <Label for="tenant-display-name">{{ $t('uiText.displayNamec7874aaa') }}</Label>
                <Input
                  id="tenant-display-name"
                  v-model="editor.displayName"
                  :disabled="externallyManaged"
                  placeholder="Основной тенант"
                />
              </div>
              <div class="space-y-2">
                <Label for="tenant-code">{{ $t('uiText.code67088374') }}</Label>
                <Input
                  id="tenant-code"
                  v-model="editor.code"
                  :disabled="externallyManaged"
                  placeholder="TENANT_DEFAULT"
                />
              </div>
              <div class="space-y-2">
                <Label for="tenant-description">{{ $t('uiText.descriptionF5441f6a') }}</Label>
                <Textarea
                  id="tenant-description"
                  v-model="editor.description"
                  :disabled="externallyManaged"
                  :rows="4"
                  placeholder="Описание тенанта"
                />
              </div>
            </section>
          </div>
        </ScrollArea>

        <div v-else class="h-full min-h-0 p-4 lg:p-5">
          <ConfigurationSettingsEditor
            v-model="configuration"
            class="min-h-0"
            variant="contribution"
            :upstream="upstreamConfiguration"
            :disabled="externallyManaged"
          />
        </div>
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
