<script setup lang="ts">
import { Loader2, Save, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor.ts'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import TypeRegistrySelect from '@/features/endge-ide/ui/components/TypeRegistrySelect.vue'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useSmartTabSelection } from '@/shared/ui/smart-tabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const tabs = EndgeIDE.tabs
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null)
const tab = useSmartTabSelection('editor.active-tab', 'general', ['general', '0', '2', 'parameters'] as const)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function addInputField(): void {
  editor.value?.inputFields?.push(RFieldEditor.createDefault())
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    {{ $t('uiText.noEditorF03cf60f') }}
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
          <i class="ti ti-file-type-jsx text-purple-500 text-2xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            {{ $t('uiText.dsl7bbb4bb9') }} {{ editor?.name ?? '-' }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            {{ $t('uiText.idA078622f') }} {{ editor?.id ?? '-' }} {{ $t('uiText.identityD63b139a') }} {{ editor?.identity ?? '-' }}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card class="flex-1 min-h-0">
        <Tabs v-model="tab" class="h-full flex flex-col min-h-0">
          <div class="border-b px-3 py-2">
            <TabsList class="flex flex-wrap gap-1">
              <TabsTrigger value="general">
                {{ $t('uiText.basic127492c2') }}
              </TabsTrigger>
              <TabsTrigger value="0">
                {{ $t('uiText.text5e83ab73') }}
              </TabsTrigger>
              <TabsTrigger value="2">
                {{ $t('uiText.dataD8e5fd81') }}
              </TabsTrigger>
              <TabsTrigger value="parameters">
                {{ $t('uiText.filters67e16da2') }}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4 max-w-2xl">
                <div class="space-y-2">
                  <Label>{{ $t('uiText.text1b7b3b8a') }}</Label>
                  <Input :model-value="editor.id" readonly />
                </div>
                <div class="space-y-2">
                  <Label>{{ $t('uiText.identity7e5a975b') }}</Label>
                  <DocumentIdentityInput :model-value="editor.identity" readonly />
                </div>
                <div class="space-y-2">
                  <Label>{{ $t('uiText.componentName00651df7') }}</Label>
                  <Input v-model="editor.name" />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-3">
                <div class="space-y-2">
                  <Label class="font-semibold">{{ $t('uiText.text5e83ab73') }}</Label>
                  <ScriptEditor v-model="editor.jsxScript" :type="editor.type" view-state-key="component-dsl.jsx" />
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">{{ $t('uiText.legacySetupSourceDataOnly5a6ad2e7') }}</Label>
                  <ScriptEditor v-model="editor.setupScript" :type="editor.type" view-state-key="component-dsl.setup" />
                  <p class="text-xs text-muted-foreground">
                    {{ $t('uiText.thisFieldIsPreservedInTheDocumentBuEed553e4') }}
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="parameters" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <Label class="font-semibold">{{ $t('uiText.runtimeFiltersPersistedOnlyAa6b8c31') }}</Label>
                  <Input
                    :model-value="(editor.runtimeFilters ?? []).join(', ')"
                    placeholder="schedule, telegraph"
                    @update:model-value="(value) => editor.runtimeFilters = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{ $t('uiText.storedForDocumentFidelityThisListNoD3e80248') }}
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="2" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <p class="text-sm text-muted-foreground">
                  {{ $t('uiText.inputRequirementsForTheComponent2bc2ede5') }}
                </p>
                <div class="rounded-lg border overflow-hidden">
                  <div class="bg-muted/40 border-b">
                    <div class="grid grid-cols-[1.2fr_1fr_80px_56px] gap-0 text-xs font-medium text-muted-foreground">
                      <div class="px-3 py-2">
                        {{ $t('uiText.variableNameC2cd13eb') }}
                      </div>
                      <div class="px-3 py-2">
                        {{ $t('uiText.dataType3822a6c6') }}
                      </div>
                      <div class="px-3 py-2">
                        {{ $t('uiText.arrayE03e0002') }}
                      </div>
                      <div class="px-3 py-2" />
                    </div>
                  </div>
                  <div class="divide-y">
                    <div
                      v-for="(row, idx) in editor.inputFields"
                      :key="idx"
                      class="grid grid-cols-[1.2fr_1fr_80px_56px] items-center"
                    >
                      <div class="px-3 py-2">
                        <Input v-model="row.name" />
                      </div>
                      <div class="px-3 py-2">
                        <TypeRegistrySelect v-model="row.type" placeholder="Тип" />
                      </div>
                      <div class="px-3 py-2 flex justify-center">
                        <Checkbox
                          :model-value="!!row.isArray"
                          @update:model-value="(v) => (row.isArray = !!v)"
                        />
                      </div>
                      <div class="px-3 py-2 flex justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          class="text-destructive hover:text-destructive"
                          @click="editor.inputFields.splice(idx, 1)"
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div
                      v-if="editor.inputFields.length === 0"
                      class="p-6 text-sm text-muted-foreground"
                    >
                      {{ $t('uiText.noFieldsYetDdc4125b') }}
                    </div>
                  </div>
                </div>
                <Button variant="outline" @click="addInputField">
                  {{ $t('uiText.addVariable12dceaa7') }}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
