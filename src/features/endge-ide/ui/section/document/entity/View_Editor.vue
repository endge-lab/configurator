<script setup lang="ts">
import { DomainSectionType, Endge } from '@endge/core'
import { Copy, Eye, Loader2, Save, ScanEye } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useDomainStore } from '@endge/vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import PresentationBindingEditor from '@/features/endge-ide/ui/components/PresentationBindingEditor.vue'
import OpenEntityButton from '@/features/endge-ide/ui/components/OpenEntityButton.vue'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const domainStore = useDomainStore()
const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as {
  id: number
  identity: string
  displayName: string
  description: string
  componentId: number | null
  filterId: number | null
  queryId: number | null
} | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { isSystem?: boolean } | null ?? null)
const isSystem = computed(() => documentModel.value?.isSystem === true)
const projectId = computed(() => normalizeRelationId((tabs.documentModel.value as { project?: unknown } | null)?.project))

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

const SELECT_NONE = '__none__'

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

const componentOptions = computed(() => {
  const list = domainStore.components ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((c: any) => ({
      value: c?.id != null ? String(c.id) : '',
      label: `${c?.name ?? c?.displayName ?? c?.identity ?? c?.id ?? ''}`.trim() || String(c?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})
const filterOptions = computed(() => {
  const list = domainStore.filters ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((f: any) => ({
      value: f?.id != null ? String(f.id) : '',
      label: `${f?.displayName ?? f?.name ?? f?.identity ?? f?.id ?? ''}`.trim() || String(f?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})
const queryOptions = computed(() => {
  const list = domainStore.queries ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((q: any) => ({
      value: q?.id != null ? String(q.id) : '',
      label: `${q?.name ?? q?.displayName ?? q?.identity ?? q?.id ?? ''}`.trim() || String(q?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})

const viewIdentity = computed(() => editor.value?.identity ?? '')

/** Блок 1: код для setup (import, useEndge.view, onMounted). */
const setupSnippet = computed(() => {
  const id = viewIdentity.value || 'view-id'
  return `import { EndgeComponent, useEndge } from '@endge/vue'

const { comRt, refresh, filter } = useEndge.view('${id}')

onMounted(async () => {
  await refresh()
})`
})

/** Блок 2: компонент вида. */
const componentSnippet = computed(() =>
  '<EndgeComponent v-if="comRt" :runtime="comRt" enabled-status-bar />')

/** Поля текущего фильтра вида (для выбора в модалке). */
const filterFields = computed(() => {
  const filterId = editor.value?.filterId
  if (filterId == null) return []
  const f = Endge.domain.getFilter(filterId)
  const fields = f?.fields
  return Array.isArray(fields) ? fields : []
})

const copyCodeDialogOpen = ref(false)
/** Выбранные ключи полей фильтра (массив для надёжной реактивности). */
const selectedFilterFieldKeys = ref<string[]>([])

watch(copyCodeDialogOpen, (open) => {
  if (open) {
    selectedFilterFieldKeys.value = filterFields.value.map((x: { key: string }) => x.key)
  }
})

/** Блок 3: фильтр (с :field-keys если выбраны не все поля). Метод - чтобы обновлялся при каждом рендере после смены чекбоксов. */
function getFilterSnippet(): string {
  const keys = selectedFilterFieldKeys.value.slice()
  const allKeys = filterFields.value.map((x: { key: string }) => x.key)
  if (keys.length === 0 || keys.length >= allKeys.length)
    return `<FilterGenerator
      v-if="filter"
      :filter="filter"
      :labels-enabled="true"
    />`
  const keysStr = keys.map(k => `'${k}'`).join(', ')
  return `<FilterGenerator
      v-if="filter"
      :filter="filter"
      :labels-enabled="true"
      :field-keys="[${keysStr}]"
    />`
}

function isFilterFieldSelected(key: string): boolean {
  return selectedFilterFieldKeys.value.includes(key)
}

function setFilterFieldChecked(key: string, checked: boolean): void {
  if (checked)
    selectedFilterFieldKeys.value = [...selectedFilterFieldKeys.value, key]
  else
    selectedFilterFieldKeys.value = selectedFilterFieldKeys.value.filter(k => k !== key)
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Скопировано в буфер обмена')
  } catch {
    toast.error('Не удалось скопировать')
  }
}

const demonstrationLoading = ref(false)
/** Запуск демонстрации: выполнить запрос вида, подставить в «Помощь» и открыть виджет. */
async function openDemonstration(): Promise<void> {
  const queryId = normalizeRelationId(editor.value?.queryId)
  const componentId = normalizeRelationId(editor.value?.componentId)
  if (queryId == null) {
    toast.error('Выберите запрос вида')
    return
  }
  if (componentId == null) {
    toast.error('Выберите компонент вида')
    return
  }
  demonstrationLoading.value = true
  try {
    await EndgeIDE.demonstration.runQueryAndShowTable(queryId, componentId)
  } finally {
    demonstrationLoading.value = false
  }
}

const demonstrationDisabled = computed(() =>
  normalizeRelationId(editor.value?.queryId) == null
  || normalizeRelationId(editor.value?.componentId) == null
  || demonstrationLoading.value,
)
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <!-- Заголовок: иконка, название, бейдж, кнопки - в одну строку -->
    <div class="flex items-center gap-3 px-3 py-3 border-b shrink-0 min-h-[52px]">
      <div class="size-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
        <Eye class="size-4 text-indigo-500" />
      </div>
      <div class="min-w-0 flex-1 flex flex-col gap-0.5">
        <div class="text-lg font-semibold truncate">
          Вид - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600 w-fit mt-0.5">
          Системный
        </Badge>
      </div>
      <TooltipProvider :delay-duration="120">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="isSystem || isBusy" @click="save">
              <Loader2 v-if="isBusy" class="h-4 w-4 animate-spin" />
              <Save v-else class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="h-9 w-9 shrink-0"
              aria-label="Демонстрация вида"
              :disabled="demonstrationDisabled"
              @click="openDemonstration"
            >
              <ScanEye v-if="!demonstrationLoading" class="h-4 w-4" />
              <Loader2 v-else class="h-4 w-4 animate-spin" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Выполнить запрос вида и показать таблицу в виджете «Демонстрация»</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog v-model:open="copyCodeDialogOpen">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <DialogTrigger as-child>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0">
                  <Copy class="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Копировать код вида</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DialogContent class="copy-code-dialog max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Код для вставки</DialogTitle>
          </DialogHeader>
          <div class="flex flex-col gap-4 overflow-y-auto pr-2">
            <div class="space-y-2">
              <div class="text-sm font-medium text-muted-foreground">Setup</div>
              <div class="relative rounded-lg border bg-muted/50">
                <pre class="p-4 pr-12 overflow-x-auto text-sm"><code>{{ setupSnippet }}</code></pre>
                <Button
                  variant="ghost"
                  size="sm"
                  class="absolute top-2 right-2 h-7 gap-1"
                  @click="copyToClipboard(setupSnippet)"
                >
                  <Copy class="size-3.5" />
                  Copy
                </Button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-medium text-muted-foreground">Компонент</div>
              <div class="relative rounded-lg border bg-muted/50">
                <pre class="p-4 pr-12 overflow-x-auto text-sm"><code>{{ componentSnippet }}</code></pre>
                <Button
                  variant="ghost"
                  size="sm"
                  class="absolute top-2 right-2 h-7 gap-1"
                  @click="copyToClipboard(componentSnippet)"
                >
                  <Copy class="size-3.5" />
                  Copy
                </Button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-medium text-muted-foreground">Фильтр</div>
              <div v-if="filterFields.length > 0" class="flex flex-wrap gap-x-4 gap-y-1.5 pb-2">
                <label
                  v-for="field in filterFields"
                  :key="field.key"
                  class="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    :model-value="isFilterFieldSelected(field.key)"
                    @update:model-value="(value: boolean | 'indeterminate') => setFilterFieldChecked(field.key, value === true)"
                  />
                  <span class="truncate">{{ field.label ?? field.key }}</span>
                </label>
              </div>
              <div class="relative rounded-lg border bg-muted/50">
                <pre class="p-4 pr-12 overflow-x-auto text-sm"><code>{{ getFilterSnippet() }}</code></pre>
                <Button
                  variant="ghost"
                  size="sm"
                  class="absolute top-2 right-2 h-7 gap-1"
                  @click="copyToClipboard(getFilterSnippet())"
                >
                  <Copy class="size-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="flex flex-wrap items-start gap-4">
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Компонент</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Component]"
              @update:model-value="editor && (editor.componentId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.componentId != null ? String(editor.componentId) : SELECT_NONE"
                  :options="componentOptions"
                  :disabled="isSystem"
                  placeholder="Выберите компонент"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.componentId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.componentId ?? null"
                  :section-type="DomainSectionType.Component"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Фильтр</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Filters]"
              @update:model-value="editor && (editor.filterId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.filterId != null ? String(editor.filterId) : SELECT_NONE"
                  :options="filterOptions"
                  :disabled="isSystem"
                  placeholder="Выберите фильтр"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.filterId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.filterId ?? null"
                  :section-type="DomainSectionType.Filters"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Запрос</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Query]"
              @update:model-value="editor && (editor.queryId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.queryId != null ? String(editor.queryId) : SELECT_NONE"
                  :options="queryOptions"
                  :disabled="isSystem"
                  placeholder="Выберите запрос"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.queryId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.queryId ?? null"
                  :section-type="DomainSectionType.Query"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
        </div>
        <div class="space-y-2">
          <Label>Описание</Label>
          <textarea
            :value="editor?.description ?? ''"
            :disabled="isSystem"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Краткое описание вида"
            @input="editor && (editor.description = (($event.target as HTMLTextAreaElement).value ?? ''))"
          />
        </div>
        <div class="rounded-md border p-3">
          <BehaviorBindingEditor
            :editor-model="editor"
            owner-type="view"
            :owner-id="editor?.id ?? null"
            target-type="view"
            :target-id="editor?.id ?? null"
            :project-id="projectId"
            document-type="view"
          />
        </div>
        <div class="rounded-md border p-3">
          <PresentationBindingEditor
            :editor-model="editor"
            owner-type="view"
            :owner-id="editor?.id ?? null"
            target-type="view"
            :target-id="editor?.id ?? null"
            :project-id="projectId"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<style>
/* Ширина модалки «Код для вставки» (диалог в портале, переопределяем sm:max-w-lg). */
.copy-code-dialog {
  max-width: min(72rem, calc(100vw - 2rem)) !important;
  width: 100%;
}
</style>
