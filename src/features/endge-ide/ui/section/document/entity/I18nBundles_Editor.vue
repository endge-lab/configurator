<script setup lang="ts">
import type { RI18nBundleEditor } from '@/features/endge-ide/domain/entities/RI18nBundleEditor'

import { Endge } from '@endge/core'
import {
  AlignLeft,
  Code2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import defaultI18nLocales from '@/features/endge-ide/domain/defaults/i18n-default-locales.json'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

interface ScriptEditorHandle {
  formatDocument: () => Promise<void>
}

const props = defineProps<{
  tabContext?: { editor?: RI18nBundleEditor }
}>()

const editor = computed<RI18nBundleEditor | null>(
  () => props.tabContext?.editor ?? null,
)

const workspaceLocaleCodes = computed(() =>
  Endge.workspace.locales.map(locale => locale.code),
)

const localeCodes = computed(() => {
  const loc = editor.value?.locales
  if (!loc || typeof loc !== 'object') { return workspaceLocaleCodes.value }
  const keys = Object.keys(loc)
  return keys.length ? keys : workspaceLocaleCodes.value
})

const currentLocale = ref<string>(Endge.workspace.defaultLocale)

const activePanel = ref<'source' | 'ui'>('source')
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)

/** Режим редактирования: json — ручной JSON, table — иерархическая таблица ключ→значение */
const editMode = ref<'json' | 'table'>('table')

const panelButtons = [
  { value: 'source', icon: Code2, label: 'Source' },
  { value: 'ui', icon: SlidersHorizontal, label: 'UI' },
] as const

/** Разворачивает вложенный объект в плоский список ключей в точечной нотации */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): { key: string, value: string }[] {
  const out: { key: string, value: string }[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (
      v != null
      && typeof v === 'object'
      && !Array.isArray(v)
      && Object.keys(v).length > 0
    ) {
      out.push(...flattenObject(v as Record<string, unknown>, path))
    }
    else {
      out.push({
        key: path,
        value: typeof v === 'string' ? v : v != null ? String(v) : '',
      })
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/** Собирает вложенный объект из плоского списка (точечная нотация) */
function unflattenObject(
  rows: { key: string, value: string }[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const { key, value } of rows) {
    if (!key.trim()) { continue }
    const parts = key.trim().split('.')
    let cur: Record<string, unknown> = out
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!
      if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) {
        cur[p] = {}
      }
      cur = cur[p] as Record<string, unknown>
    }
    cur[parts[parts.length - 1]!] = value
  }
  return out
}

/** Строки таблицы для текущей локали (ключ в точечной нотации, значение) */
const tableRows = ref<{ key: string, value: string }[]>([])

function syncTableRowsFromLocale(): void {
  if (!editor.value) { return }
  const loc = editor.value.locales?.[currentLocale.value]
  const obj
    = loc && typeof loc === 'object' && !Array.isArray(loc)
      ? (loc as Record<string, unknown>)
      : {}
  tableRows.value = flattenObject(obj)
}

function applyTableRowsToLocale(): void {
  if (!editor.value) { return }
  const prev = editor.value.locales ?? {}
  const nested = unflattenObject(tableRows.value)
  editor.value.locales = { ...prev, [currentLocale.value]: nested }
}

function addTableRow(): void {
  tableRows.value = [...tableRows.value, { key: '', value: '' }]
}

function removeTableRow(index: number): void {
  tableRows.value = tableRows.value.filter((_, i) => i !== index)
}

function restoreDefaultLocales(): void {
  const current = editor.value
  if (!current) { return }

  if (activePanel.value === 'source') {
    try {
      current.applySourceText()
    }
    catch {
      /* reset can recover an invalid source editor state */
    }
  }
  else if (editMode.value === 'table') {
    applyTableRowsToLocale()
  }

  current.locales = mergePlainObjects(
    clonePlainObject(current.locales ?? {}),
    clonePlainObject(defaultI18nLocales),
  ) as Record<string, Record<string, unknown>>
  current.syncSourceTextFromLocales()
  syncTableRowsFromLocale()
  toast.success('Системные переводы восстановлены')
}

function applySourceTextToLocales(): boolean {
  const current = editor.value
  if (!current) { return false }

  try {
    current.applySourceText()
    syncTableRowsFromLocale()
    return true
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error('Некорректный JSON словаря', { description: message })
    return false
  }
}

function syncLocalesToSourceText(): void {
  if (editMode.value === 'table') { applyTableRowsToLocale() }
  editor.value?.syncSourceTextFromLocales()
}

function switchPanel(panel: 'source' | 'ui'): void {
  if (activePanel.value === panel) { return }

  if (activePanel.value === 'source' && !applySourceTextToLocales()) { return }

  if (activePanel.value === 'ui' && panel === 'source') { syncLocalesToSourceText() }

  activePanel.value = panel
}

watch(
  [() => editor.value?.locales, currentLocale],
  () => syncTableRowsFromLocale(),
  { immediate: true },
)

watch(editMode, (mode) => {
  if (mode === 'table') { syncTableRowsFromLocale() }
  else if (mode === 'json') { applyTableRowsToLocale() }
})

const currentLocaleJson = computed({
  get: () => {
    const loc = editor.value?.locales?.[currentLocale.value]
    if (loc == null) { return '{}' }
    try {
      return JSON.stringify(loc, null, 2)
    }
    catch {
      return '{}'
    }
  },
  set: (value: string) => {
    if (!editor.value) { return }
    try {
      const parsed = JSON.parse(value || '{}')
      if (
        typeof parsed === 'object'
        && parsed !== null
        && !Array.isArray(parsed)
      ) {
        const prev = editor.value.locales ?? {}
        editor.value.locales = { ...prev, [currentLocale.value]: parsed }
        if (editMode.value === 'table') { syncTableRowsFromLocale() }
      }
    }
    catch {
      /* ignore invalid json */
    }
  },
})

watch(
  () => editor.value?.locales,
  () => {
    if (
      editor.value?.locales
      && !(currentLocale.value in editor.value.locales)
    ) {
      currentLocale.value
        = localeCodes.value[0] ?? Endge.workspace.defaultLocale
    }
  },
  { immediate: true },
)

async function save(): Promise<void> {
  if (activePanel.value === 'source') {
    if (!applySourceTextToLocales()) { return }
  }
  else {
    syncLocalesToSourceText()
  }

  await EndgeIDE.tabs.save()
}

function clonePlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mergePlainObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      target[key] = mergePlainObjects(
        target[key] as Record<string, unknown>,
        value,
      )
      continue
    }

    target[key] = value
  }

  return target
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
</script>

<template>
  <SourceDocumentEditorShell
    :document-id="editor?.id"
    :identity="editor?.identity"
  >
    <template #center>
      <TooltipProvider>
        <div
          class="flex shrink-0 items-center rounded-md border bg-muted/40 p-0.5"
        >
          <Tooltip v-for="item in panelButtons" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activePanel === item.value
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="item.label"
                @click="switchPanel(item.value)"
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
              <Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-if="activePanel === 'source'">
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Форматировать"
                @click="sourceEditorRef?.formatDocument()"
              >
                <AlignLeft class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Форматировать</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Восстановить системные переводы"
                @click="restoreDefaultLocales"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Восстановить системные переводы</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div
      v-if="activePanel === 'source'"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ScriptEditor
        ref="sourceEditorRef"
        v-model="editor!.sourceText"
        language="json"
        class="min-h-0 flex-1"
        min-height="100%"
        @blur="applySourceTextToLocales"
      />
    </div>

    <ScrollArea v-else class="flex-1 px-4 py-3">
      <div class="max-w-3xl space-y-6">
        <Card class="p-4 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">identity</Label>
              <Input v-model="editor!.identity" placeholder="base" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Название</Label>
              <Input
                v-model="editor!.displayName"
                placeholder="Базовый словарь"
              />
            </div>
          </div>
          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">Описание</Label>
            <Input
              v-model="editor!.description"
              placeholder="Краткое описание"
            />
          </div>
        </Card>

        <Card class="p-4 space-y-4">
          <div class="flex items-center gap-2">
            <Label class="text-xs text-muted-foreground shrink-0">Локаль</Label>
            <Select v-model="currentLocale">
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="code in localeCodes"
                  :key="code"
                  :value="code"
                >
                  {{ code }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs v-model="editMode" class="w-full">
            <TabsList class="grid w-full max-w-[320px] grid-cols-2">
              <TabsTrigger value="table">
                По ключам
              </TabsTrigger>
              <TabsTrigger value="json">
                JSON
              </TabsTrigger>
            </TabsList>
            <TabsContent value="table" class="mt-4 space-y-2">
              <div class="flex items-center justify-between">
                <Label class="text-xs text-muted-foreground">Ключ (точечная нотация, например common.save)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1"
                  @click="addTableRow"
                >
                  <Plus class="size-3.5" />
                  Добавить
                </Button>
              </div>
              <div class="rounded-md border overflow-hidden">
                <div class="max-h-[320px] overflow-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/60 sticky top-0">
                      <tr>
                        <th class="text-left font-medium px-3 py-2 w-[40%]">
                          Ключ
                        </th>
                        <th class="text-left font-medium px-3 py-2">
                          Значение
                        </th>
                        <th class="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, idx) in tableRows"
                        :key="idx"
                        class="border-t border-border hover:bg-muted/30"
                      >
                        <td class="px-3 py-1.5 align-top">
                          <Input
                            v-model="row.key"
                            class="h-8 font-mono text-xs"
                            placeholder="common.save"
                          />
                        </td>
                        <td class="px-3 py-1.5 align-top">
                          <Input
                            v-model="row.value"
                            class="h-8 text-xs"
                            placeholder="Сохранить"
                          />
                        </td>
                        <td class="px-1 py-1.5 align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            class="h-8 w-8 text-muted-foreground hover:text-destructive"
                            @click="removeTableRow(idx)"
                          >
                            <Trash2 class="size-4" />
                          </Button>
                        </td>
                      </tr>
                      <tr
                        v-if="!tableRows.length"
                        class="border-t border-border"
                      >
                        <td
                          colspan="3"
                          class="px-3 py-6 text-center text-muted-foreground text-xs"
                        >
                          Нет ключей. Нажмите «Добавить» или переключитесь на
                          JSON.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="json" class="mt-4 space-y-1">
              <Label class="text-xs text-muted-foreground">Сообщения (дерево в JSON)</Label>
              <Textarea
                v-model="currentLocaleJson"
                class="font-mono text-xs min-h-[280px]"
                placeholder="{&quot;common&quot;: {&quot;save&quot;: &quot;Сохранить&quot;}}"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </ScrollArea>
  </SourceDocumentEditorShell>
</template>
