<script setup lang="ts">
import type { DomainDocumentType, RType } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Loader2, Save } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'

const domainStore = useDomainStore()
async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value ?? null)
const queryDocumentType = computed<DomainDocumentType | undefined>(() =>
  (editor.value as { type?: DomainDocumentType } | null)?.type,
)
function normalizeRelationId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text)
    return null
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}
const projectId = computed(() =>
  normalizeRelationId((tabs.documentModel.value as { project?: unknown } | null)?.project),
)

const tab = ref('0')

const componentInputOptions = computed(() =>
  domainStore.types.map((x: RType) => ({ name: x.name, code: x.name })),
)
const componentTypeOptions = computed(() =>
  domainStore.queriesNames.map((x: string) => ({ name: x, code: x })),
)
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <i class="ti ti-brand-graphql text-indigo-500 text-2xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            GraphQL - {{ editor?.name ?? '-' }}
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
            <TabsList class="grid grid-cols-3 w-full">
              <TabsTrigger value="0">Запрос</TabsTrigger>
              <TabsTrigger value="1">Отладка</TabsTrigger>
            <TabsTrigger value="events">События</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <Label class="font-semibold">Точка доступа</Label>
                  <Input v-model="editor.endpoint" type="text" />
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">Запрос</Label>
                  <Input v-model="editor.query" type="text" />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="1" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <Label class="font-semibold">Mock данные</Label>
                <Textarea v-model="editor.mockData" :rows="10" />
                <div class="flex items-center gap-2">
                  <Checkbox
                    :model-value="!!editor.mockDataEnabled"
                    @update:model-value="(v) => (editor.mockDataEnabled = !!v)"
                  />
                  <Label class="font-semibold">Включить Mock-режим?</Label>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="events" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <BehaviorBindingEditor
                  :editor-model="editor"
                  owner-type="query"
                  :owner-id="editor?.id ?? null"
                  target-type="query"
                  :target-id="editor?.id ?? null"
                  :project-id="projectId"
                  :document-type="queryDocumentType"
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
