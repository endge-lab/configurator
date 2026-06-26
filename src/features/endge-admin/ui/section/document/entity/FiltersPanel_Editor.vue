<script setup lang="ts">
import { Raph } from '@endge/raph'
import { Loader2, Save } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelectChips } from '@/components/ui/multi-select-chips'
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
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'


type FilterValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'array'
  | 'json'

type FilterMode = 'manual' | 'static' | 'dynamic' | 'expression'

interface FilterStaticOption {
  value: string
  label?: string
}

interface FilterDynamicSource {
  sourceType?: 'vocab' | 'payloadCollection' | 'query' | null
  vocabIdentity?: string | null
  vocabCollection?: string | null
  collectionSlug?: string | null
  queryIdentity?: string | null
  path?: string | null
  valueField?: string | null
  labelField?: string | null
  where?: any
}

interface RuntimeFilterField {
  id?: string
  key: string
  valueType: FilterValueType
  mode: FilterMode
  staticOptions?: FilterStaticOption[]
  dynamicSource?: FilterDynamicSource | null
  expression?: string | null
  label?: string
  description?: string
}

// -------------------- localStorage helpers --------------------

const LS_KEY = 'endge:parameters'
type FiltersStore = Record<string, any> // identity -> payload

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadAllSaved(): FiltersStore {
  return safeParseJSON<FiltersStore>(localStorage.getItem(LS_KEY), {})
}

function saveAllSaved(store: FiltersStore): void {
  localStorage.setItem(LS_KEY, JSON.stringify(store))
}

function loadSavedByIdentity(identity: string): any | null {
  const all = loadAllSaved()
  return all?.[identity] ?? null
}

function saveByIdentity(identity: string, payload: any): void {
  const all = loadAllSaved()
  all[identity] = payload
  saveAllSaved(all)
}

// -------------------- state --------------------

const tabs = EndgeAdmin.tabs
async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
/** Редактор параметра (форма привязана к нему). */
const editor = computed<any | null>(() => tabs.documentEditorModel.value ?? null)

const identity = computed(() => String(editor.value?.identity ?? '').trim())
const raphKey = computed(() => {
  const id = identity.value
  if (!id) return ''
  return id.startsWith('parameters.') ? id : `parameters.${id}`
})

// -------------------- utils --------------------

function getByPath(obj: any, path: string | null | undefined): any {
  if (!path) return obj
  const p = String(path).trim()
  if (!p) return obj
  return p.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj)
}

function toOptionLabelValue(
  item: any,
  valueField?: string | null,
  labelField?: string | null,
): { label: string; value: any } | null {
  if (item == null) return null

  if (typeof item !== 'object') {
    const v = item
    return { value: v, label: String(v) }
  }

  const vf = String(valueField ?? '').trim()
  const lf = String(labelField ?? '').trim()

  const value = vf
    ? item?.[vf]
    : (item?.value ?? item?.id ?? item?.code ?? item)
  const label = lf
    ? item?.[lf]
    : (item?.label ?? item?.name ?? item?.title ?? item?.code ?? value)

  if (value == null) return null
  return { value, label: String(label ?? value) }
}

/**
 * Достаём опции для dynamic поля из Raph.
 * Важно: для vocabs берём по ключу:
 *    vocabs:<vocabIdentity>/<vocabCollection>
 * пример:
 *   vocabs:base/airlines
 */
function resolveDynamicOptions(
  field: RuntimeFilterField,
): { label: string; value: any }[] {
  const ds = field.dynamicSource
  if (!ds || !ds.sourceType) return []

  let raw: any = null

  if (ds.sourceType === 'vocab') {
    const vid = String(ds.vocabIdentity ?? '').trim()
    const col = String(ds.vocabCollection ?? '').trim()
    if (!vid || !col) return []

    //  ВОТ ТУТ ПОДПРАВЛЕНО: новый ключ vocabs:<base>/<словарь>
    const key = `vocabs:${vid}/${col}` // например "vocabs:base/airlines"
    raw = Raph.get(key)
    raw = getByPath(raw, ds.path)
  } else if (ds.sourceType === 'payloadCollection') {
    const slug = String(ds.collectionSlug ?? '').trim()
    if (!slug) return []
    raw = Raph.get(`payload-${slug}`)
    raw = getByPath(raw, ds.path)
  } else if (ds.sourceType === 'query') {
    const qid = String(ds.queryIdentity ?? '').trim()
    if (!qid) return []
    raw = Raph.get(`query-${qid}`)
    raw = getByPath(raw, ds.path)
  }

  let arr: any[] | null = null
  if (Array.isArray(raw)) arr = raw
  else if (raw?.docs && Array.isArray(raw.docs)) arr = raw.docs
  else if (raw?.items && Array.isArray(raw.items)) arr = raw.items
  else if (raw?.data && Array.isArray(raw.data)) arr = raw.data
  else if (raw && typeof raw === 'object') {
    const maybe = Object.values(raw).find((v) => Array.isArray(v))
    if (Array.isArray(maybe)) arr = maybe as any[]
  }
  if (!arr) return []

  const opts: { label: string; value: any }[] = []
  for (const it of arr) {
    const o = toOptionLabelValue(it, ds.valueField, ds.labelField)
    if (o) opts.push(o)
  }

  const seen = new Set<string>()
  return opts.filter((o) => {
    const k = String(o.value)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// -------------------- fields -> RuntimeFilterField[] --------------------

const fields = computed<RuntimeFilterField[]>(() => {
  const e = editor.value
  if (!e) return []

  const rawFields: any = e.fields
  if (!rawFields) return []

  let list: any[] = []
  if (rawFields instanceof Map || rawFields?.constructor?.name === 'Map') {
    list = Array.from(rawFields.values())
  } else if (Array.isArray(rawFields)) {
    list = rawFields
  } else if (typeof rawFields === 'object') {
    list = Object.values(rawFields)
  }

  return list
    .filter((fld) => fld && fld.key)
    .map(
      (fld: any): RuntimeFilterField => ({
        id: fld.id,
        key: fld.key,
        valueType: (fld.valueType as FilterValueType) ?? 'string',
        mode: (fld.mode as FilterMode) ?? 'manual',
        staticOptions: (fld.staticOptions ?? []).map((o: any) => ({
          value: String(o.value),
          label: o.label ?? String(o.value),
        })),
        dynamicSource: fld.dynamicSource ?? null,
        expression: fld.expression ?? null,
        label: fld.label ?? fld.key,
        description: fld.description,
      }),
    )
})

// -------------------- form --------------------

const form = ref<Record<string, any>>({})

function initFormDefaults(fs: RuntimeFilterField[]): Record<string, any> {
  const next: Record<string, any> = {}
  for (const field of fs) {
    if (field.mode === 'expression') {
      next[field.key] = field.expression ?? null
      continue
    }

    switch (field.valueType) {
      case 'array':
        next[field.key] = []
        break
      case 'boolean':
        next[field.key] = false
        break
      case 'number':
      case 'date':
      case 'datetime':
        next[field.key] = null
        break
      case 'json':
        next[field.key] = ''
        break
      default:
        next[field.key] = ''
    }
  }
  return next
}

function applySavedToForm(
  saved: any,
  fs: RuntimeFilterField[],
  base: Record<string, any>,
): Record<string, any> {
  if (!saved || typeof saved !== 'object') return base

  const out = { ...base }
  for (const field of fs) {
    const key = field.key
    if (!(key in saved)) continue

    let val = saved[key]

    if (
      (field.valueType === 'date' || field.valueType === 'datetime') &&
      typeof val === 'string'
    ) {
      const d = new Date(val)
      if (!Number.isNaN(d.getTime())) val = d
    }

    if (field.valueType === 'json') {
      if (typeof val === 'object' && val !== null) {
        try {
          val = JSON.stringify(val, null, 2)
        } catch {}
      }
    }

    out[key] = val
  }

  return out
}

watch(
  [fields, identity],
  ([fs, id]) => {
    const defaults = initFormDefaults(fs)
    const saved = id ? loadSavedByIdentity(id) : null
    form.value = applySavedToForm(saved, fs, defaults)
  },
  { immediate: true },
)

// -------------------- result json --------------------

const resultJson = computed<Record<string, any>>(() => {
  const out: Record<string, any> = {}

  for (const field of fields.value) {
    const key = field.key

    if (field.mode === 'expression') {
      if (field.expression) out[key] = field.expression
      continue
    }

    let val = form.value[key]
    if (val == null) continue

    if (field.valueType === 'array' && Array.isArray(val) && val.length === 0)
      continue
    if (
      (field.valueType === 'string' || field.valueType === 'json') &&
      val === ''
    )
      continue

    if (
      (field.valueType === 'date' || field.valueType === 'datetime') &&
      val instanceof Date
    ) {
      val = val.toISOString()
    }

    if (field.valueType === 'json' && typeof val === 'string') {
      try {
        val = JSON.parse(val)
      } catch {
        // оставляем строкой
      }
    }

    out[key] = val
  }

  return out
})

// -------------------- UI helpers --------------------

const fieldLabel = (f: RuntimeFilterField) => f.label || f.key

const isStaticArray = (f: RuntimeFilterField) =>
  f.valueType === 'array' && f.mode === 'static'

const isStaticSingle = (f: RuntimeFilterField) =>
  f.valueType !== 'array' && f.mode === 'static'

const isManualDate = (f: RuntimeFilterField) =>
  f.valueType === 'date' && f.mode === 'manual'

const isManualDateTime = (f: RuntimeFilterField) =>
  f.valueType === 'datetime' && f.mode === 'manual'

const isManualNumber = (f: RuntimeFilterField) =>
  f.valueType === 'number' && f.mode === 'manual'

const isManualBoolean = (f: RuntimeFilterField) =>
  f.valueType === 'boolean' && f.mode === 'manual'

const isManualString = (f: RuntimeFilterField) =>
  f.valueType === 'string' && f.mode === 'manual'

const isManualJson = (f: RuntimeFilterField) =>
  f.valueType === 'json' && f.mode === 'manual'

const isDynamic = (f: RuntimeFilterField) => f.mode === 'dynamic'
const isExpression = (f: RuntimeFilterField) => f.mode === 'expression'

const isDynamicArray = (f: RuntimeFilterField) =>
  isDynamic(f) && f.valueType === 'array'

const isDynamicSingle = (f: RuntimeFilterField) =>
  isDynamic(f) && f.valueType !== 'array'

function dynamicSourceLabel(field: RuntimeFilterField): string {
  const ds = field.dynamicSource
  if (!ds || !ds.sourceType) return 'Динамический источник'

  if (ds.sourceType === 'vocab') {
    const vid = ds.vocabIdentity ?? ''
    const col = ds.vocabCollection ?? ''
    return `Vocab: vocabs:${vid}/${col}`
  }
  if (ds.sourceType === 'payloadCollection') {
    return `Payload collection: ${ds.collectionSlug ?? ''}`
  }
  if (ds.sourceType === 'query') {
    return `Query: ${ds.queryIdentity ?? ''} @ ${ds.path ?? ''}`
  }
  return 'Динамический источник'
}

/**
 * Применить фильтр:
 * 1) localStorage endge:parameters[identity]
 * 2) Raph.set(parameters.<identity>, payload)
 */
function applyFilter(): void {
  const id = identity.value
  if (!id) return

  const key = raphKey.value
  const payload = resultJson.value

  saveByIdentity(id, payload)
  if (key) Raph.set(key, payload)

  console.log('[FiltersPanel] APPLY', { identity: id, key, payload })
}
</script>

<template>
  <div v-if="!filter" class="p-4 text-sm text-muted-foreground">
    Нет данных для вкладки
  </div>
  <div v-else class="w-full h-full flex flex-col">
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b bg-card">
      <div class="flex flex-col gap-1 min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          {{ filter?.displayName || filter?.name || 'Без названия' }}
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
      <div v-if="identity" class="text-xs text-muted-foreground font-mono shrink-0">
        {{ identity }}
      </div>
    </div>

    <div class="flex-1 min-h-0 flex flex-col">
      <Tabs class="flex-1 flex flex-col min-h-0" default-value="form">
        <div class="border-b px-3 py-2">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="form">Форма</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="form" class="flex-1 min-h-0 p-0 m-0">
          <ScrollArea class="h-full">
            <div class="p-4 space-y-4">
              <div class="flex items-center justify-between">
                <Label class="text-xs font-semibold uppercase text-muted-foreground">
                  Поля фильтра
                </Label>
                <Button size="sm" @click="applyFilter">
                  Применить
                </Button>
              </div>

              <div v-if="!fields.length" class="text-sm text-muted-foreground">
                Для этого фильтра пока не задано ни одного поля.
              </div>

              <div v-else class="flex flex-col gap-3">
                <Card
                  v-for="field in fields"
                  :key="field.id ?? field.key"
                  class="p-3"
                >
                  <div class="flex flex-col gap-2">
                    <div class="flex justify-between items-center gap-2">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium">{{ fieldLabel(field) }}</span>
                        <span class="text-xs text-muted-foreground">
                          key: <span class="font-mono">{{ field.key }}</span> ·
                          type: <span class="font-mono">{{ field.valueType }}</span> ·
                          mode: <span class="font-mono">{{ field.mode }}</span>
                        </span>
                      </div>
                    </div>
                    <p v-if="field.description" class="text-xs text-muted-foreground">
                      {{ field.description }}
                    </p>

                    <!-- STATIC ARRAY -->
                    <div v-if="isStaticArray(field)" class="mt-1">
                      <MultiSelectChips
                        v-model="form[field.key]"
                        :options="(field.staticOptions ?? []).map(o => ({ value: o.value, label: o.label }))"
                        placeholder="Выберите значения…"
                      />
                    </div>

                    <!-- STATIC SINGLE -->
                    <div v-else-if="isStaticSingle(field)" class="mt-1">
                      <Select v-model="form[field.key]">
                        <SelectTrigger class="w-full">
                          <SelectValue placeholder="Выберите значение…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="opt in (field.staticOptions ?? [])"
                            :key="String(opt.value)"
                            :value="String(opt.value)"
                          >
                            {{ opt.label ?? opt.value }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <!-- MANUAL DATE -->
                    <div v-else-if="isManualDate(field)" class="mt-1">
                      <Input
                        :model-value="form[field.key] instanceof Date ? (form[field.key] as Date).toISOString().slice(0, 10) : form[field.key]"
                        type="date"
                        @update:model-value="(v) => (form[field.key] = v ? new Date(v as string) : '')"
                      />
                    </div>

                    <!-- MANUAL DATETIME -->
                    <div v-else-if="isManualDateTime(field)" class="mt-1">
                      <Input
                        :model-value="form[field.key] instanceof Date ? (form[field.key] as Date).toISOString().slice(0, 16) : form[field.key]"
                        type="datetime-local"
                        @update:model-value="(v) => (form[field.key] = v ? new Date(v as string) : '')"
                      />
                    </div>

                    <!-- MANUAL NUMBER -->
                    <div v-else-if="isManualNumber(field)" class="mt-1">
                      <Input
                        v-model="form[field.key]"
                        type="number"
                        placeholder="Введите число…"
                      />
                    </div>

                    <!-- MANUAL BOOLEAN -->
                    <div v-else-if="isManualBoolean(field)" class="mt-1 flex items-center gap-2">
                      <Checkbox
                        :model-value="!!form[field.key]"
                        @update:model-value="(v) => (form[field.key] = !!v)"
                      />
                      <span class="text-sm">Включено</span>
                    </div>

                    <!-- MANUAL STRING -->
                    <div v-else-if="isManualString(field)" class="mt-1">
                      <Input
                        v-model="form[field.key]"
                        placeholder="Введите значение…"
                      />
                    </div>

                    <!-- MANUAL JSON -->
                    <div v-else-if="isManualJson(field)" class="mt-1">
                      <Textarea
                        v-model="form[field.key]"
                        class="w-full"
                        :rows="4"
                        placeholder='Введите JSON (например: ["SU","S7"])'
                      />
                    </div>

                    <!-- DYNAMIC ARRAY -->
                    <div v-else-if="isDynamicArray(field)" class="mt-1">
                      <div class="text-xs text-muted-foreground mb-1">
                        {{ dynamicSourceLabel(field) }}
                      </div>
                      <MultiSelectChips
                        v-model="form[field.key]"
                        :options="resolveDynamicOptions(field).map(o => ({ value: String(o.value), label: o.label }))"
                        placeholder="Выберите значения…"
                      />
                    </div>

                    <!-- DYNAMIC SINGLE -->
                    <div v-else-if="isDynamicSingle(field)" class="mt-1">
                      <div class="text-xs text-muted-foreground mb-1">
                        {{ dynamicSourceLabel(field) }}
                      </div>
                      <Select v-model="form[field.key]">
                        <SelectTrigger class="w-full">
                          <SelectValue placeholder="Выберите значение…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="opt in resolveDynamicOptions(field)"
                            :key="String(opt.value)"
                            :value="String(opt.value)"
                          >
                            {{ opt.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <!-- EXPRESSION -->
                    <div v-else-if="isExpression(field)" class="mt-1">
                      <div class="text-xs text-muted-foreground mb-1">Выражение (readonly)</div>
                      <Input
                        :model-value="field.expression"
                        disabled
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="json" class="flex-1 min-h-0 p-0 m-0">
          <ScrollArea class="h-full">
            <div class="p-4 space-y-4">
              <div class="flex items-center justify-between">
                <Label class="text-xs font-semibold uppercase text-muted-foreground">
                  Итоговый JSON фильтра
                </Label>
                <Button size="sm" @click="applyFilter">
                  Применить
                </Button>
              </div>
              <pre class="text-xs rounded-md border p-3 overflow-auto bg-muted/30">{{ JSON.stringify(resultJson, null, 2) }}</pre>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
