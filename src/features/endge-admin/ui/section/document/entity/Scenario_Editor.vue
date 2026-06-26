<script setup lang="ts">
import { Endge } from '@endge/core'
import { MountScenario } from '@endge/vue'
import { Loader2, Save } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import ScriptEditor from '@/features/endge-admin/ui/components/ScriptEditor.vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = EndgeAdmin.tabs
const editor = computed(() => tabs.documentEditorModel.value ?? null)
const previewModel = computed(() => tabs.documentModel.value)

const tab = ref('0')

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}

onMounted(() => {
  Endge.script.declareScenario()
})
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
          <i class="ti ti-code text-teal-500 text-2xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            Сценарий - {{ editor?.name ?? '-' }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeAdmin.busy.value" @click="save">
                <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin" />
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
              <TabsTrigger value="0">Основные</TabsTrigger>
              <TabsTrigger value="1">Запрос</TabsTrigger>
              <TabsTrigger value="2">Предпросмотр</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-2">
                <div class="text-sm font-semibold">Setup скрипт</div>
                <ScriptEditor v-model="editor.setupScript" />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="1" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-2">
                <div class="text-sm font-semibold">Пример контекстного запроса</div>
                <VueJsonPretty
                  v-if="previewModel?.previewQuery?.json"
                  :data="previewModel.previewQuery.json"
                />
                <p v-else class="text-sm text-muted-foreground">
                  Сохраните для обновления превью
                </p>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="2" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <div class="w-full max-w-full overflow-x-auto min-w-fit">
                  <MountScenario
                    v-if="previewModel"
                    :scenario="previewModel"
                  />
                  <p v-else class="text-sm text-muted-foreground">
                    Нет данных для превью
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
