<script setup lang="ts">
import type { DomainDocumentType, RQueryAuth } from '@endge/core'
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'

import { DomainSectionType, Endge, RQueryFilter } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2, Variable } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import QuerySourceEditor from '@/features/endge-ide/ui/components/QuerySourceEditor.vue'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const domainStore = useDomainStore()
const tabs = EndgeIDE.tabs
const editor = computed<RQueryEditor | null>(() => tabs.documentEditorModel.value as RQueryEditor | null)
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

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

const authModeOptions: { label: string, value: RQueryAuth['mode'] }[] = [
  { label: 'Без авторизации', value: 'none' },
  { label: 'Токен', value: 'token' },
]

/** Гарантирует наличие auth при переключении на вкладку «Авторизация». */
function ensureAuth(): void {
  if (editor.value && (editor.value.auth == null || typeof editor.value.auth !== 'object'))
    editor.value.auth = { mode: 'token' }
}

const authMode = computed({
  get() {
    ensureAuth()
    return editor.value?.auth?.mode ?? 'token'
  },
  set(v: RQueryAuth['mode']) {
    ensureAuth()
    if (editor.value?.auth)
      editor.value.auth.mode = v
  },
})

const tokenSource = computed<'endge' | 'manual'>({
  get() {
    const a = editor.value?.auth
    return a?.mode === 'token' && a?.manualToken ? 'manual' : 'endge'
  },
  set(next) {
    ensureAuth()
    if (editor.value?.auth?.mode !== 'token')
      return
    editor.value.auth.manualToken = next === 'endge' ? undefined : (editor.value.auth.manualToken ?? '')
  },
})

const filtersList = computed({
  get() {
    if (!editor.value)
      return []
    if (!Array.isArray(editor.value.filters))
      editor.value.filters = []
    return editor.value.filters
  },
  set(_) { /* массив мутируется на месте */ },
})

/** Опции для выбора фильтра из коллекции (RFilter), не параметры */
const allFilterOptions = computed(() => {
  const filters = domainStore.filters ?? []
  return filters
    .map((f: any) => {
      const identity = String(f?.identity ?? f?.id ?? '').trim()
      if (!identity)
        return null
      const displayName = String(f?.displayName ?? f?.name ?? identity).trim()
      const description = f?.description ? String(f.description) : ''
      const label = description ? `${identity} - ${displayName} - ${description}` : `${identity} - ${displayName}`
      return { label, value: identity }
    })
    .filter(Boolean) as { label: string, value: string }[]
})

function addFilterInline(): void {
  if (!editor.value)
    return
  if (!Array.isArray(editor.value.filters))
    editor.value.filters = []
  editor.value.filters.push(new RQueryFilter({ mode: 'inline', inlineJson: '{}', filterId: null }))
}

function addFilterReference(): void {
  if (!editor.value)
    return
  if (!Array.isArray(editor.value.filters))
    editor.value.filters = []
  editor.value.filters.push(new RQueryFilter({ mode: 'reference', filterId: null, inlineJson: null }))
}

function removeFilter(index: number): void {
  editor.value?.filters?.splice(index, 1)
}

function moveFilter(index: number, delta: number): void {
  const list = editor.value?.filters
  if (!list || index + delta < 0 || index + delta >= list.length)
    return
  const [item] = list.splice(index, 1)
  if (!item)
    return
  list.splice(index + delta, 0, item)
}

function setSendAsFormUrlencoded(value: boolean): void {
  if (editor.value)
    editor.value.sendAsFormUrlencoded = value
}

function setMockDataEnabled(value: boolean): void {
  if (editor.value)
    editor.value.mockDataEnabled = value
}

function setInlineFilterJson(filter: RQueryFilter, value: string | number): void {
  filter.inlineJson = String(value)
}

function setFilterId(filter: RQueryFilter, value: unknown): void {
  filter.filterId = value == null ? null : String(value)
}

const endpointInputRef = ref<HTMLInputElement | null>(null)
const varsPopoverOpen = ref(false)

/** Заголовки как массив строк для таблицы; синхронизация с editor.headers */
const headersRows = ref<{ name: string, value: string }[]>([])
watch(
  () => editor.value?.headers,
  (h) => {
    if (h && typeof h === 'object')
      headersRows.value = Object.entries(h).map(([name, value]) => ({ name, value: String(value ?? '') }))
    else
      headersRows.value = []
  },
  { immediate: true },
)
watch(
  headersRows,
  () => {
    if (!editor.value)
      return
    const obj: Record<string, string> = {}
    for (const row of headersRows.value)
      obj[String(row?.name ?? '')] = String(row?.value ?? '')
    editor.value.headers = obj
  },
  { deep: true },
)
function addHeaderRow(): void {
  headersRows.value = [...headersRows.value, { name: '', value: '' }]
}
function removeHeaderRow(i: number): void {
  headersRows.value = headersRows.value.filter((_, idx) => idx !== i)
}

const generalVars = computed(() => {
  const settings = Endge.domain.getSetting('general') as { vars?: Array<{ name: string }> } | null
  const vars = settings?.vars ?? []
  return vars
    .map(v => (v?.name ? String(v.name).trim() : ''))
    .filter(Boolean)
})

function insertVarIntoEndpoint(name: string): void {
  if (!editor.value || !name)
    return
  varsPopoverOpen.value = false
  const snippet = `{${name}}`
  const current = String(editor.value.endpoint ?? '')
  const input = endpointInputRef.value
  if (input) {
    const start = input.selectionStart ?? current.length
    const end = input.selectionEnd ?? start
    editor.value.endpoint = current.slice(0, start) + snippet + current.slice(end)
    nextTick(() => {
      input.focus()
      const pos = start + snippet.length
      input.setSelectionRange(pos, pos)
    })
  }
  else {
    editor.value.endpoint = current + snippet
  }
}

watch(tab, (t) => {
  if (t === 'auth')
    ensureAuth()
})
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="size-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <i class="ti ti-api text-orange-500 text-2xl" />
          </div>
          <div class="min-w-0">
            <div class="text-lg font-semibold truncate">
              REST - {{ editor?.name ?? '-' }}
            </div>
            <div class="text-xs text-muted-foreground truncate">
              id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
            </div>
          </div>
        </div>
        <div class="shrink-0">
          <TooltipProvider :delay-duration="120">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="outline" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
                  <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                  <Save v-else class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Сохранить</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Card class="flex flex-1 min-h-[calc(100vh-220px)] flex-col overflow-hidden">
        <Tabs v-model="tab" class="flex flex-1 min-h-0 flex-col">
          <div class="border-b px-3 py-2">
            <TabsList class="flex flex-wrap gap-1">
              <TabsTrigger value="0">
                Запрос
              </TabsTrigger>
              <TabsTrigger value="filter">
                Фильтры
              </TabsTrigger>
              <TabsTrigger value="auth">
                Авторизация
              </TabsTrigger>
              <TabsTrigger value="debug">
                Отладка
              </TabsTrigger>
              <TabsTrigger value="source">
                Source
              </TabsTrigger>
              <TabsTrigger value="events">
                События
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="0" class="flex-1 min-h-0 p-0 m-0 overflow-hidden">
            <ScrollArea class="h-full w-full">
              <div class="p-4 space-y-4 w-full min-w-0">
                <div class="space-y-2 w-full min-w-0">
                  <Label class="font-semibold">Точка доступа</Label>
                  <div class="flex w-full gap-2 min-w-0">
                    <div class="min-w-0 flex-1 overflow-hidden">
                      <Input
                        ref="endpointInputRef"
                        v-model="editor.endpoint"
                        type="text"
                        class="w-full min-w-0 max-w-full"
                      />
                    </div>
                    <div class="shrink-0">
                      <Popover v-model:open="varsPopoverOpen">
                        <PopoverTrigger as-child>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Переменные из general-settings"
                            @click="varsPopoverOpen = !varsPopoverOpen"
                          >
                            <Variable class="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-56 p-1" align="end">
                          <div v-if="!generalVars.length" class="px-2 py-3 text-sm text-muted-foreground">
                            Нет переменных в general-settings
                          </div>
                          <button
                            v-for="v in generalVars"
                            :key="v"
                            type="button"
                            class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                            @click="insertVarIntoEndpoint(v)"
                          >
                            {{ v }}
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">Запрос (путь)</Label>
                  <Input v-model="editor.query" type="text" class="w-full" />
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">HTTP-метод</Label>
                  <Select v-model="editor.method">
                    <SelectTrigger class="w-full max-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">
                        GET
                      </SelectItem>
                      <SelectItem value="POST">
                        POST
                      </SelectItem>
                      <SelectItem value="PUT">
                        PUT
                      </SelectItem>
                      <SelectItem value="PATCH">
                        PATCH
                      </SelectItem>
                      <SelectItem value="DELETE">
                        DELETE
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <Label class="font-semibold">Заголовки</Label>
                    <Button type="button" size="sm" variant="outline" @click="addHeaderRow">
                      <Plus class="size-3.5" /> Добавить
                    </Button>
                  </div>
                  <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b bg-muted/50">
                          <th class="text-left font-medium p-2 w-[40%]">
                            Название
                          </th>
                          <th class="text-left font-medium p-2">
                            Значение
                          </th>
                          <th class="w-10 p-0" />
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(row, idx) in headersRows"
                          :key="idx"
                          class="border-b last:border-b-0"
                        >
                          <td class="p-1">
                            <Input
                              v-model="row.name"
                              type="text"
                              placeholder="Accept"
                              class="h-8 w-full border-0 bg-transparent focus-visible:ring-1"
                            />
                          </td>
                          <td class="p-1">
                            <Input
                              v-model="row.value"
                              type="text"
                              placeholder="application/json"
                              class="h-8 w-full border-0 bg-transparent focus-visible:ring-1"
                            />
                          </td>
                          <td class="p-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              class="size-7"
                              @click="removeHeaderRow(idx)"
                            >
                              <Trash2 class="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                        <tr v-if="!headersRows.length">
                          <td colspan="3" class="p-3 text-muted-foreground text-sm">
                            Нет заголовков. Нажмите «Добавить».
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">Таймаут (мс)</Label>
                  <Input v-model.number="editor.timeoutMs" type="number" class="w-full max-w-[140px]" placeholder="не задан" />
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox
                    :model-value="!!editor.sendAsFormUrlencoded"
                    @update:model-value="(v) => setSendAsFormUrlencoded(!!v)"
                  />
                  <Label>Тело как application/x-www-form-urlencoded</Label>
                </div>
                <div class="space-y-2">
                  <Label class="font-semibold">Поле для сохранения</Label>
                  <Input v-model="editor.subField" type="text" class="w-full" />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="filter" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <Label class="font-semibold">Фильтры</Label>
                    <div class="flex gap-1">
                      <Button type="button" size="sm" variant="outline" @click="addFilterInline">
                        <Plus class="size-3.5" /> Inline JSON
                      </Button>
                      <Button type="button" size="sm" variant="outline" @click="addFilterReference">
                        <Plus class="size-3.5" /> Из коллекции
                      </Button>
                    </div>
                  </div>

                  <div v-if="!filtersList.length" class="text-sm text-muted-foreground py-2">
                    Нет фильтров. Добавьте элемент «Inline JSON» или «Из коллекции».
                  </div>

                  <div
                    v-for="(f, idx) in filtersList"
                    :key="idx"
                    class="rounded-lg border p-3 space-y-2 bg-muted/20"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-medium text-muted-foreground">
                        {{ idx + 1 }}. {{ f.mode === 'inline' ? 'Inline JSON' : 'Из коллекции' }}
                      </span>
                      <div class="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          class="size-7"
                          :disabled="idx === 0"
                          @click="moveFilter(idx, -1)"
                        >
                          <ChevronUp class="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          class="size-7"
                          :disabled="idx === filtersList.length - 1"
                          @click="moveFilter(idx, 1)"
                        >
                          <ChevronDown class="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          class="size-7 text-destructive"
                          @click="removeFilter(idx)"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div v-if="f.mode === 'inline'" class="space-y-1">
                      <Label class="text-xs">JSON</Label>
                      <Textarea
                        :model-value="f.inlineJson ?? ''"
                        :rows="4"
                        placeholder="{ &quot;key&quot;: &quot;value&quot; }"
                        class="font-mono text-sm"
                        @update:model-value="(v) => setInlineFilterJson(f, v)"
                      />
                    </div>

                    <div v-else class="space-y-1">
                      <Label class="text-xs">Фильтр из коллекции</Label>
                      <DomainEntityDropTarget
                        :accept-section-types="[DomainSectionType.Filters]"
                        @update:model-value="(v) => setFilterId(f, v)"
                      >
                        <Select
                          :model-value="f.filterId ?? undefined"
                          @update:model-value="(v) => setFilterId(f, v)"
                        >
                          <SelectTrigger class="w-full">
                            <SelectValue placeholder="Выбери фильтр…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="opt in allFilterOptions"
                              :key="opt.value"
                              :value="opt.value ?? ''"
                            >
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </DomainEntityDropTarget>
                    </div>
                  </div>
                </div>

                <div class="space-y-2 pt-2 border-t">
                  <Label class="font-semibold">Режим применения фильтров</Label>
                  <Select v-model="editor.filterMode">
                    <SelectTrigger class="w-full max-w-xs">
                      <SelectValue placeholder="Режим…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">
                        Слияние
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p class="text-xs text-muted-foreground">
                    Финальный фильтр собирается из списка выше по порядку: каждый следующий объединяется с предыдущим (слияние). Порядок элементов можно менять кнопками ↑/↓.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="auth" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <div class="space-y-2">
                  <Label class="font-semibold">Режим</Label>
                  <Select v-model="authMode">
                    <SelectTrigger class="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in authModeOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <template v-if="authMode === 'token'">
                  <div class="space-y-2">
                    <Label class="font-semibold">Источник токена</Label>
                    <Select v-model="tokenSource">
                      <SelectTrigger class="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="endge">
                          EndgeAuth
                        </SelectItem>
                        <SelectItem value="manual">
                          Ручной токен
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div v-if="tokenSource === 'manual'" class="space-y-2">
                    <Label class="font-semibold">Ручной токен</Label>
                    <Input
                      v-model.trim="editor.auth!.manualToken"
                      placeholder="eyJhbGciOi..."
                    />
                    <p class="text-xs text-muted-foreground">
                      Если заполнено - используется этот токен, иначе - из EndgeAuth.
                    </p>
                  </div>
                </template>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="debug" class="flex-1 min-h-0 p-0 m-0">
            <ScrollArea class="h-full">
              <div class="p-4 space-y-4">
                <Label class="font-semibold">Mock данные</Label>
                <Textarea v-model="editor.mockData" class="w-full" :rows="15" />
                <div class="flex items-center gap-2">
                  <Checkbox
                    :model-value="!!editor.mockDataEnabled"
                    @update:model-value="(v) => setMockDataEnabled(!!v)"
                  />
                  <Label>Использовать Mock данные?</Label>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="source" class="flex flex-1 h-full min-h-0 flex-col p-0 m-0 overflow-hidden">
            <QuerySourceEditor v-model="editor.source" />
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
