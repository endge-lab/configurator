<script setup lang="ts">
import type { DomainDocumentType, RType } from '@endge/core'
import { DomainSectionType, Endge } from '@endge/core'
import { ComponentPreview } from '@endge/vue'
import { useDomainStore } from '@endge/vue'
import { Loader2, Save, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor.ts'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import PresentationBindingEditor from '@/features/endge-ide/ui/components/PresentationBindingEditor.vue'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const domainStore = useDomainStore()
const tabs = EndgeIDE.tabs
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null)
const previewModel = computed<any>(() => tabs.documentModel.value)
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
const projectId = computed(() => normalizeRelationId((previewModel.value as { project?: unknown } | null)?.project))
const componentDocumentType = computed<DomainDocumentType | undefined>(() =>
  (editor.value as { type?: DomainDocumentType } | null)?.type,
)

const tab = ref('0')

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

onMounted(() => {
  Endge.script.declareJSX()
})

const componentInputOptions = computed(() =>
  domainStore.types.map((x: RType) => ({ name: x.name, code: x.name })),
)

function addInputField(): void {
  editor.value?.inputFields?.push(RFieldEditor.createDefault())
}

const filterConfig = computed(() => {
  if (!editor.value) return null
  if (!editor.value.filter) {
    editor.value.filter = {
      mode: 'runtime',
      schemaId: null,
      filterCustomIdentity: '',
      inlineJson: '',
    }
  }
  return editor.value.filter
})

const allRuntimeFilterOptions = computed(() => {
  const parameters = domainStore.parameters
  const map = new Map<string, { label: string; value: string }>()
  for (const f of parameters) {
    const arr = Array.isArray(f?.runtimeFilters) ? f.runtimeFilters : []
    for (const rf of arr) {
      const identity = String(rf?.identity ?? '').trim()
      if (!identity) continue
      const displayName = String(rf?.displayName ?? identity).trim()
      const description = rf?.description ? String(rf.description) : ''
      const label = description ? `${identity} - ${displayName} - ${description}` : `${identity} - ${displayName}`
      if (!map.has(identity)) map.set(identity, { label, value: identity })
    }
  }
  return Array.from(map.values())
})

const pickedRuntimeFilterIdentity = computed<string | ''>({
  get() {
    return filterConfig.value?.filterCustomIdentity || ''
  },
  set(v) {
    if (filterConfig.value)
      filterConfig.value.filterCustomIdentity = v ?? ''
  },
})
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
              <TabsTrigger v-if="!editor.hasCustomRenderer" value="0">
                JSX шаблон
              </TabsTrigger>
              <TabsTrigger v-if="editor.hasCustomRenderer" value="0">
                Управляемый компонент
              </TabsTrigger>
              <TabsTrigger value="2">
                Данные
              </TabsTrigger>
              <TabsTrigger value="parameters">
                Фильтры
              </TabsTrigger>
              <TabsTrigger value="3">
                Предпросмотр
              </TabsTrigger>
              <TabsTrigger value="bindings">
                События
              </TabsTrigger>
              <TabsTrigger value="presentation">
                Presentation
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-3">
                <div v-if="editor.hasCustomRenderer" class="text-sm text-muted-foreground">
                  Перехвачен исходным кодом проекта
                </div>
                <div v-else class="space-y-2">
                  <Label class="font-semibold">JSX шаблон</Label>
                  <ScriptEditor v-model="editor.jsxScript" :type="editor.type" />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="parameters" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <Label class="font-semibold">Режим фильтра</Label>
                  <Select v-model="filterConfig.mode">
                    <SelectTrigger class="w-full max-w-xs">
                      <SelectValue placeholder="Выберите режим" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline">
                        Задать вручную (inline JSON)
                      </SelectItem>
                      <SelectItem value="runtime">
                        Брать по custom filter identity
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div v-if="filterConfig.mode === 'inline'" class="space-y-2">
                  <Label class="font-semibold">Фильтр (inline JSON)</Label>
                  <Textarea
                    v-model="filterConfig.inlineJson"
                    :rows="8"
                    placeholder='Например: { "status": "ACTIVE", "limit": 100 }'
                  />
                  <p class="text-xs text-muted-foreground">
                    Сырой JSON как тело фильтра. Валидность - на авторе запроса.
                  </p>
                </div>

                <div v-else-if="filterConfig.mode === 'runtime'" class="space-y-2">
                  <Label class="font-semibold">Выбрать из runtime-parameters</Label>
                  <DomainEntityDropTarget
                    :accept-section-types="[DomainSectionType.Filters]"
                    @update:model-value="(v) => (pickedRuntimeFilterIdentity = v)"
                  >
                    <Select v-model="pickedRuntimeFilterIdentity">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Выбери runtime filter…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in allRuntimeFilterOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </DomainEntityDropTarget>
                  <p class="text-xs text-muted-foreground">
                    Заполняет <b>filterCustomIdentity</b>.
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
                        <Select v-model="row.type">
                          <SelectTrigger>
                            <SelectValue placeholder="Тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="opt in componentInputOptions"
                              :key="opt.code"
                              :value="opt.code"
                            >
                              {{ opt.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
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

          <TabsContent value="3" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <ComponentPreview
                  v-if="previewModel"
                  :preview-model="previewModel"
                />
                <p v-else class="text-sm text-muted-foreground">
                  Нет данных для превью
                </p>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bindings" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <BehaviorBindingEditor
                  :editor-model="editor"
                  owner-type="component"
                  :owner-id="editor?.id ?? null"
                  target-type="component"
                  :target-id="editor?.id ?? null"
                  :project-id="projectId"
                  :document-type="componentDocumentType"
                />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="presentation" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <PresentationBindingEditor
                  :editor-model="editor"
                  owner-type="component"
                  :owner-id="editor?.id ?? null"
                  target-type="component"
                  :target-id="editor?.id ?? null"
                  :project-id="projectId"
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
