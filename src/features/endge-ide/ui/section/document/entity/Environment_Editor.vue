<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { EndgeConfigurationContribution } from '@endge/core'

import { Endge } from '@endge/core'
import { Loader2, Save, Settings2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const tabs = EndgeIDE.tabs
const editor = computed(
  () =>
    (tabs.documentEditorModel.value as {
      id: number | string
      identity: string
      displayName: string
      configuration: EndgeConfigurationContribution
    } | null) ?? null,
)
const documentModel = computed(
  () => (tabs.documentModel.value as { isSystem?: boolean } | null) ?? null,
)
const isSystem = computed(() => documentModel.value?.isSystem === true)
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: (value) => {
    if (editor.value) {
      editor.value.configuration = value
    }
  },
})
const upstreamConfiguration = computed(() =>
  Endge.configuration.resolveUpstream('environment'),
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
      <div v-if="isSystem" class="flex min-w-0 items-center gap-1.5">
        <span class="shrink-0 text-muted-foreground">kind:</span>
        <span class="min-w-0 truncate font-mono text-foreground/80">system</span>
      </div>
    </template>

    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7 bg-background shadow-sm"
                aria-label="Основное"
              >
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Основное</TooltipContent>
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
                :disabled="isSystem || EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <ScrollArea class="min-h-0 flex-1">
      <div class="mx-auto max-w-3xl space-y-8 p-6">
        <section class="space-y-4">
          <div class="space-y-2">
            <Label for="environment-identity">Identity</Label>
            <Input
              id="environment-identity"
              v-model="editor.identity"
              :disabled="isSystem"
              placeholder="dev"
            />
          </div>
          <div class="space-y-2">
            <Label for="environment-display-name">Display name</Label>
            <Input
              id="environment-display-name"
              v-model="editor.displayName"
              :disabled="isSystem"
              placeholder="Development"
            />
          </div>
        </section>

        <Separator />

        <section class="flex h-[42rem] min-h-[32rem] flex-col gap-3">
          <div>
            <h2 class="text-sm font-semibold">
              Конфигурация
            </h2>
            <p class="text-xs text-muted-foreground">
              Переопределения конфигурации для этого окружения.
            </p>
          </div>
          <ConfigurationSettingsEditor
            v-model="configuration"
            class="min-h-0 flex-1"
            variant="contribution"
            :upstream="upstreamConfiguration"
            :disabled="isSystem"
          />
        </section>
      </div>
    </ScrollArea>
  </SourceDocumentEditorShell>
</template>
