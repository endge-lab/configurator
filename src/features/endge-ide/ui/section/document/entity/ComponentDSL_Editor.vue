<script setup lang="ts">
import { Loader2, Save, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import TypeRegistrySelect from '@/features/endge-ide/ui/components/TypeRegistrySelect.vue'

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
    Нет редактора
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
          <i class="ti ti-file-type-jsx text-purple-500 text-2xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            DSL - {{ editor?.name ?? '-' }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
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
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card class="flex-1 min-h-0">
        <Tabs v-model="tab" class="h-full flex flex-col min-h-0">
          <div class="border-b px-3 py-2">
            <TabsList class="flex flex-wrap gap-1">
              <TabsTrigger value="general">
                Основное
              </TabsTrigger>
              <TabsTrigger value="0">
                JSX шаблон
              </TabsTrigger>
              <TabsTrigger value="2">
                Данные
              </TabsTrigger>
              <TabsTrigger value="parameters">
                Фильтры
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4 max-w-2xl">
                <div class="space-y-2">
                  <Label>ID компонента</Label>
                  <Input :model-value="editor.id" readonly />
                </div>
                <div class="space-y-2">
                  <Label>Название компонента</Label>
                  <Input v-model="editor.name" />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-3">
                <div class="space-y-2">
                  <Label class="font-semibold">JSX шаблон</Label>
                  <ScriptEditor v-model="editor.jsxScript" :type="editor.type" />
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">Legacy setup source (data only)</Label>
                  <ScriptEditor v-model="editor.setupScript" :type="editor.type" />
                  <p class="text-xs text-muted-foreground">
                    This field is preserved in the document but is no longer executed.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="parameters" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <Label class="font-semibold">Runtime filters (persisted only)</Label>
                  <Input
                    :model-value="(editor.runtimeFilters ?? []).join(', ')"
                    placeholder="schedule, telegraph"
                    @update:model-value="(value) => editor.runtimeFilters = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)"
                  />
                  <p class="text-xs text-muted-foreground">
                    Stored for document fidelity; this list no longer starts legacy component runtime.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="2" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <p class="text-sm text-muted-foreground">
                  Входные требования для компонента.
                </p>
                <div class="rounded-lg border overflow-hidden">
                  <div class="bg-muted/40 border-b">
                    <div class="grid grid-cols-[1.2fr_1fr_80px_56px] gap-0 text-xs font-medium text-muted-foreground">
                      <div class="px-3 py-2">Имя переменной</div>
                      <div class="px-3 py-2">Тип данных</div>
                      <div class="px-3 py-2">Массив?</div>
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
                      Полей пока нет.
                    </div>
                  </div>
                </div>
                <Button variant="outline" @click="addInputField">
                  Добавить переменную
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

        </Tabs>
      </Card>
    </div>
  </div>
</template>
