<script setup lang="ts">
import type { FilterFieldItemSchema } from '@endge/core'

import { Endge } from '@endge/core'
import { FileJson, Loader2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import EntityInheritedInspector from '@/features/endge-admin/ui/section/inspectors/EntityInherited_Inspector.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: { document?: { editor?: any; previewModel?: any; component?: any } }
}>()

const filter = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? null)
const editor = computed(() => props.tabContext?.document?.editor ?? null)

/** Источник полей: редактор (реактивный выбор словаря) или модель */
const fieldsSource = computed(() => editor.value ?? filter.value)

/** Список полей из источника */
const fieldsList = computed<FilterFieldItemSchema[]>(() => {
  const f = fieldsSource.value
  if (!f?.fields) return []
  const raw = f.fields
  return Array.isArray(raw) ? raw : (raw instanceof Map ? Array.from(raw.values()) : [])
})

/** Индекс выбранного поля в редакторе (из Filter_Editor) */
const selectedFieldIndex = computed<number | null>(() => {
  const e = editor.value as { selectedFieldIndex?: number | null } | undefined
  const idx = e?.selectedFieldIndex
  if (typeof idx !== 'number' || idx < 0) return null
  if (idx >= fieldsList.value.length) return null
  return idx
})

/** Выбранное поле, если оно vocab с заданными набором и словарём - только тогда показываем пример и делаем запрос */
const currentVocabField = computed<FilterFieldItemSchema | null>(() => {
  const idx = selectedFieldIndex.value
  if (idx == null) return null
  const list = fieldsList.value
  const field = list[idx]
  if (!field || field.mode !== 'vocab') return null
  if (!field.vocabIdentity?.trim() || !field.vocabCollection?.trim()) return null
  return field
})

const vocabSampleJson = ref<string>('')
const vocabSampleData = ref<object | null>(null)
const vocabSampleLoading = ref(false)
const sampleCollapsed = ref(false)
const filterDemoCollapsed = ref(true)
const filterDemoJson = ref<string>('')
const filterDemoLoading = ref(false)
const spacesBlockCollapsed = ref(true)

const LS_FILTERS_KEY = 'endge:filters'

/** Пространства, в которых этот фильтр есть в localStorage (ключи вида identity.space) */
const usedInSpaces = computed(() => {
  const id = filter.value?.identity ?? filter.value?.id
  if (!id) return []
  try {
    const raw = localStorage.getItem(LS_FILTERS_KEY)
    const store = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const prefix = `${String(id)}.`
    const spaces: string[] = []
    for (const key of Object.keys(store)) {
      if (key.startsWith(prefix)) {
        const space = key.slice(prefix.length)
        if (space && !spaces.includes(space)) spaces.push(space)
      }
    }
    return spaces.sort()
  } catch {
    return []
  }
})

async function loadVocabSample(): Promise<void> {
  const field = currentVocabField.value
  if (!field?.vocabIdentity || !field?.vocabCollection) {
    vocabSampleJson.value = ''
    vocabSampleData.value = null
    return
  }
  vocabSampleLoading.value = true
  vocabSampleJson.value = ''
  vocabSampleData.value = null
  try {
    const docs = await Endge.vocabs.getSample(field.vocabIdentity, field.vocabCollection, 1)
    const first = docs?.[0]
    if (first != null) {
      vocabSampleJson.value = JSON.stringify(first, null, 2)
      vocabSampleData.value = first
    }
    else {
      vocabSampleJson.value = 'Нет данных'
    }
  }
  finally {
    vocabSampleLoading.value = false
  }
}

watch(
  () => [currentVocabField.value?.vocabIdentity, currentVocabField.value?.vocabCollection] as const,
  () => loadVocabSample(),
  { immediate: true },
)

function setPathOnSelectedField(key: 'valuePath' | 'displayNamePath', path: string): void {
  const idx = selectedFieldIndex.value
  if (idx != null && idx >= 0 && editor.value?.fields?.[idx]) {
    (editor.value.fields[idx] as Record<string, string>)[key] = path
  }
}

/** Значение по точечному пути в объекте */
function getNested(obj: any, path: string): any {
  if (path == null || path === '') return obj
  const parts = String(path).split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

/** Пример значения по режиму поля (не словарь) */
function placeholderForMode(f: FilterFieldItemSchema): any {
  switch (f.mode) {
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'date':
      return '2025-02-22'
    case 'time':
      return '14:30:00'
    case 'datetime':
      return '2025-02-22T12:00:00.000Z'
    case 'string':
      return 'пример'
    case 'static': {
      const opts = f.staticOptions?.map(o => o.value).filter(v => v != null && String(v).trim() !== '') ?? []
      if (f.multiple) {
        return opts.length ? opts : ['*']
      }
      return opts.length ? opts[0] : '*'
    }
    default:
      return 'пример'
  }
}

/** Применить цепочку конвертеров к значению (по очереди). Для массива - к каждому элементу */
function applyConverters(value: any, identities: string[] | undefined): any {
  const ids = Array.isArray(identities) ? identities.map(id => (typeof id === 'string' ? id : (id as any)?.identity)).filter(Boolean) : []
  if (!ids.length) return value
  if (Array.isArray(value)) {
    return value.map(item => applyConverters(item, identities))
  }
  let cur: any = value
  for (const id of ids) {
    const converter = Endge.domain.getConverter(id)
    if (!converter) break
    const next = converter.convert(cur)
    if (next === undefined || next === null) break
    cur = next
  }
  return cur
}

/** Строит пример выходного JSON фильтра: реальные данные для словарей, плейсхолдеры для остальных; для словаря с multiple - массив */
async function buildFilterDemoJson(): Promise<void> {
  const list = fieldsList.value
  if (!list.length) {
    filterDemoJson.value = '{}'
    return
  }
  filterDemoLoading.value = true
  filterDemoJson.value = ''
  try {
    const example: Record<string, any> = {}
    for (const f of list) {
      const key = (f.key && String(f.key).trim()) || 'key'
      const isVocab = f.mode === 'vocab' && f.vocabIdentity?.trim() && f.vocabCollection?.trim()
      const multiple = f.multiple !== false

      if (isVocab) {
        const limit = multiple ? 3 : 1
        const docs = await Endge.vocabs.getSample(f.vocabIdentity!, f.vocabCollection!, limit)
        const valuePath = (f.valuePath ?? '').trim()
        let raw: any
        if (docs?.length && valuePath) {
          const values = docs.map(d => getNested(d, valuePath)).filter(v => v !== undefined && v !== null)
          raw = multiple ? (values.length ? values : []) : (values[0] ?? '')
        }
        else {
          raw = multiple ? [] : ''
        }
        example[key] = applyConverters(raw, f.converterIdentities)
      }
      else {
        const raw = placeholderForMode(f)
        example[key] = applyConverters(raw, f.converterIdentities)
      }
    }
    filterDemoJson.value = JSON.stringify(example, null, 2)
  }
  finally {
    filterDemoLoading.value = false
  }
}

/** Показать демо выхода: свернуть пример словаря, развернуть демо и сгенерировать JSON */
async function showFilterDemo(): Promise<void> {
  sampleCollapsed.value = true
  filterDemoCollapsed.value = false
  await buildFilterDemoJson()
}

/** Фокус на путь до поля/названия: развернуть пример словаря, свернуть демо */
function onPathFocus(): void {
  sampleCollapsed.value = false
  filterDemoCollapsed.value = true
}

/** Рекурсивно собирает пути до примитивов (листья) в формате "a.b.c" */
function collectPaths(obj: any, prefix = ''): { path: string; key: string }[] {
  if (obj === null || obj === undefined) return []
  const out: { path: string; key: string }[] = []
  if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null) {
    for (const key of Object.keys(obj)) {
      const full = prefix ? `${prefix}.${key}` : key
      const val = obj[key]
      const isLeaf = val === null || typeof val !== 'object' || Array.isArray(val)
      if (isLeaf) out.push({ path: full, key })
      else out.push(...collectPaths(val, full))
    }
  }
  return out
}

const samplePaths = computed(() => {
  const data = vocabSampleData.value
  if (!data || typeof data !== 'object') return []
  return collectPaths(data).filter(p => p.path !== '')
})

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div v-if="!filter" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <p class="text-xs text-muted-foreground">
          Основные поля фильтра. Поля (key, label, словари и т.д.) редактируются в основной панели.
        </p>
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input v-model="filter.identity" placeholder="например: schedule-filter" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input v-model="filter.displayName" placeholder="Отображаемое имя" />
        </div>

        <div class="space-y-2">
          <EntityInheritedInspector :tab-context="tabContext" />
        </div>

        <!-- Пример сущности словаря: только если выбрано поле, оно - словарь и заданы набор + словарь -->
        <div
          v-if="currentVocabField"
          class="space-y-2 border-t pt-4"
        >
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-foreground hover:opacity-80"
            @click="sampleCollapsed = !sampleCollapsed; if (!sampleCollapsed) filterDemoCollapsed = true"
          >
            <span class="transition-transform" :class="sampleCollapsed ? '' : 'rotate-90'">▶</span>
            Пример сущности словаря ({{ currentVocabField.vocabIdentity }}/{{ currentVocabField.vocabCollection }})
          </button>
          <template v-if="!sampleCollapsed">
            <div v-if="vocabSampleLoading" class="text-xs text-muted-foreground">
              Загрузка…
            </div>
            <template v-else>
              <div class="grid grid-cols-1 gap-3">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-muted-foreground">Путь до значения (valuePath)</label>
                  <Select
                    :model-value="currentVocabField?.valuePath ?? ''"
                    @update:model-value="(v) => setPathOnSelectedField('valuePath', String(v ?? ''))"
                  >
                    <SelectTrigger class="h-8 text-xs" @focus="onPathFocus">
                      <SelectValue placeholder="Выберите цепочку полей" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="item in samplePaths" :key="item.path" :value="item.path" class="text-xs">
                        {{ item.path }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-muted-foreground">Путь до подписи (displayNamePath)</label>
                  <Select
                    :model-value="currentVocabField?.displayNamePath ?? ''"
                    @update:model-value="(v) => setPathOnSelectedField('displayNamePath', String(v ?? ''))"
                  >
                    <SelectTrigger class="h-8 text-xs" @focus="onPathFocus">
                      <SelectValue placeholder="Выберите цепочку полей" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="item in samplePaths" :key="item.path" :value="item.path" class="text-xs">
                        {{ item.path }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <pre class="p-3 rounded-md bg-muted text-xs overflow-auto max-h-48">{{ vocabSampleJson || '-' }}</pre>
            </template>
          </template>
        </div>

        <!-- Пример выхода фильтра (демо): сворачиваемый блок под примером сущности словаря -->
        <div
          v-if="fieldsList.length > 0"
          class="space-y-2 border-t pt-4"
        >
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-foreground hover:opacity-80"
            @click="filterDemoCollapsed = !filterDemoCollapsed; if (!filterDemoCollapsed) { sampleCollapsed = true; buildFilterDemoJson() }"
          >
            <span class="transition-transform" :class="filterDemoCollapsed ? '' : 'rotate-90'">▶</span>
            Пример выхода фильтра (демо)
          </button>
          <div v-if="!filterDemoCollapsed" class="rounded-md border bg-muted/30 p-3">
            <div v-if="filterDemoLoading" class="text-xs text-muted-foreground">
              Загрузка…
            </div>
            <pre v-else class="text-xs overflow-auto max-h-48 whitespace-pre-wrap">{{ filterDemoJson || '{}' }}</pre>
          </div>
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-3 space-y-2">
      <div class="rounded-md border bg-muted/30">
        <button
          type="button"
          class="flex items-center gap-2 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-2"
          @click="spacesBlockCollapsed = !spacesBlockCollapsed"
        >
          <span class="transition-transform" :class="spacesBlockCollapsed ? '' : 'rotate-90'">▶</span>
          Используется в пространствах
          <span v-if="usedInSpaces.length" class="text-[10px] opacity-80">({{ usedInSpaces.length }})</span>
        </button>
        <div v-if="!spacesBlockCollapsed" class="px-3 pb-3 pt-0">
          <p v-if="usedInSpaces.length === 0" class="text-xs text-muted-foreground">
            Нет данных в localStorage
          </p>
          <ul v-else class="text-xs text-muted-foreground space-y-0.5">
            <li v-for="space in usedInSpaces" :key="space" class="truncate">
              {{ space }}
            </li>
          </ul>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button class="flex-1 min-w-0" :disabled="EndgeAdmin.busy.value" @click="save">
          <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
          {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8 shrink-0"
                @click="showFilterDemo"
              >
                <FileJson class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Показать демо выхода фильтра</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </div>
</template>
