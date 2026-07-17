<script setup lang="ts">
import { Loader2, Save, Zap } from 'lucide-vue-next'
import type { EndgeConfigurationContribution } from '@endge/core'
import { Endge } from '@endge/core'
import { computed, ref } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'

const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as { id: number | string; identity: string; displayName: string; configuration: EndgeConfigurationContribution } | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { isSystem?: boolean } | null ?? null)
const isSystem = computed(() => documentModel.value?.isSystem === true)
const activeTab = ref<'general' | 'configuration'>('general')
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: value => { if (editor.value) editor.value.configuration = value },
})
const upstreamConfiguration = computed(() => Endge.configuration.resolveUpstream('environment'))

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-lime-500/10 flex items-center justify-center shrink-0">
        <Zap class="size-4 text-lime-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Окружение - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600">
          Системное
        </Badge>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
              <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col p-4">
        <TabsList class="grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="general">Окружение</TabsTrigger>
          <TabsTrigger value="configuration">Конфигурация</TabsTrigger>
        </TabsList>
        <TabsContent value="general" class="mt-4 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
        <div class="space-y-4 pr-4">
        <div class="space-y-2">
          <Label>Идентификатор</Label>
          <input
            :value="editor?.identity ?? ''"
            :disabled="isSystem"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="например: dev"
            @input="editor && (editor.identity = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>
        <div class="space-y-2">
          <Label>Название</Label>
          <input
            :value="editor?.displayName ?? ''"
            :disabled="isSystem"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Отображаемое имя"
            @input="editor && (editor.displayName = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>
        </div>
        </ScrollArea>
        </TabsContent>
        <TabsContent value="configuration" class="mt-4 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <div class="h-full min-h-0 pr-4">
            <ConfigurationSettingsEditor
              v-model="configuration"
              variant="contribution"
              :upstream="upstreamConfiguration"
            />
          </div>
        </TabsContent>
      </Tabs>
  </div>
</template>
