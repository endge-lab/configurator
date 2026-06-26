<script setup lang="ts">
import type { RI18nBundleEditor } from '@/features/endge-admin/domain/entities/RI18nBundleEditor'

import { Endge } from '@endge/core'
import { Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: { editor?: RI18nBundleEditor }
}>()

const editor = computed<RI18nBundleEditor | null>(() => props.tabContext?.editor ?? null)

const localeCodes = computed(() => {
  const loc = editor.value?.locales
  if (!loc || typeof loc !== 'object') return ['ru', 'en']
  const keys = Object.keys(loc)
  return keys.length ? keys : ['ru', 'en']
})

const currentLocale = ref<string>('ru')

/** Режим редактирования: json — ручной JSON, table — иерархическая таблица ключ→значение */
const editMode = ref<'json' | 'table'>('table')

/** Разворачивает вложенный объект в плоский список ключей в точечной нотации */
function flattenObject(obj: Record<string, unknown>, prefix = ''): { key: string, value: string }[] {
  const out: { key: string, value: string }[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) {
      out.push(...flattenObject(v as Record<string, unknown>, path))
    } else {
      out.push({ key: path, value: typeof v === 'string' ? v : (v != null ? String(v) : '') })
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/** Собирает вложенный объект из плоского списка (точечная нотация) */
function unflattenObject(rows: { key: string, value: string }[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const { key, value } of rows) {
    if (!key.trim()) continue
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
  if (!editor.value) return
  const loc = editor.value.locales?.[currentLocale.value]
  const obj = (loc && typeof loc === 'object' && !Array.isArray(loc)) ? loc as Record<string, unknown> : {}
  tableRows.value = flattenObject(obj)
}

function applyTableRowsToLocale(): void {
  if (!editor.value) return
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

watch(
  [() => editor.value?.locales, currentLocale],
  () => syncTableRowsFromLocale(),
  { immediate: true },
)

watch(editMode, (mode) => {
  if (mode === 'table') syncTableRowsFromLocale()
  else if (mode === 'json') applyTableRowsToLocale()
})

const currentLocaleJson = computed({
  get: () => {
    const loc = editor.value?.locales?.[currentLocale.value]
    if (loc == null) return '{}'
    try {
      return JSON.stringify(loc, null, 2)
    } catch {
      return '{}'
    }
  },
  set: (value: string) => {
    if (!editor.value) return
    try {
      const parsed = JSON.parse(value || '{}')
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const prev = editor.value.locales ?? {}
        editor.value.locales = { ...prev, [currentLocale.value]: parsed }
        if (editMode.value === 'table')
          syncTableRowsFromLocale()
      }
    } catch {
      /* ignore invalid json */
    }
  },
})

watch(
  () => editor.value?.locales,
  () => {
    if (editor.value?.locales && !(currentLocale.value in editor.value.locales)) {
      currentLocale.value = localeCodes.value[0] ?? 'ru'
    }
  },
  { immediate: true },
)

async function save(): Promise<void> {
  if (editMode.value === 'table')
    applyTableRowsToLocale()
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center justify-between gap-3 shrink-0">
      <div class="text-lg font-semibold truncate">
        Словарь переводов — {{ editor?.displayName ?? '-' }}
      </div>
      <Button size="sm" :disabled="EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
        Сохранить
      </Button>
    </div>

    <ScrollArea class="flex-1 px-4 py-3">
      <div class="max-w-3xl space-y-6">
        <Card class="p-4 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">identity</Label>
              <Input v-model="editor!.identity" placeholder="base" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Название</Label>
              <Input v-model="editor!.displayName" placeholder="Базовый словарь" />
            </div>
          </div>
          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">Описание</Label>
            <Input v-model="editor!.description" placeholder="Краткое описание" />
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
                <Button type="button" variant="outline" size="sm" class="h-8 gap-1" @click="addTableRow">
                  <Plus class="size-3.5" />
                  Добавить
                </Button>
              </div>
              <div class="rounded-md border overflow-hidden">
                <div class="max-h-[320px] overflow-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/60 sticky top-0">
                      <tr>
                        <th class="text-left font-medium px-3 py-2 w-[40%]">Ключ</th>
                        <th class="text-left font-medium px-3 py-2">Значение</th>
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
                      <tr v-if="!tableRows.length" class="border-t border-border">
                        <td colspan="3" class="px-3 py-6 text-center text-muted-foreground text-xs">
                          Нет ключей. Нажмите «Добавить» или переключитесь на JSON.
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
                placeholder='{"common": {"save": "Сохранить"}}'
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
