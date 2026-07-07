<script setup lang="ts">
import type { FilterFieldItemSchema } from '@endge/core'

import {
  ComponentType,
  Endge,
  FilterType,
  QueryType,
  RComponentTable,
  RComponentTableColumn_TypeCtor,
  RField,
  RFilter,
  RQuery,
  RView,
} from '@endge/core'
import { FlaskConical } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FieldRow {
  identity: string
  displayName: string
  exampleValue: string
  inFilter: boolean
}

const rows = ref<FieldRow[]>([])

const generatorTitle = ref('')

const genQuery = ref(true)
const genComponent = ref(true)
const genFilter = ref(true)
const genView = ref(true)
const inheritEntities = ref(true)

watch(genView, (v) => {
  if (!v) inheritEntities.value = false
})

function randomLetters(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function generateIdentity(kind: 'view' | 'component' | 'query' | 'filter'): string {
  return `gen-${kind}-${randomLetters(5)}`
}

function getNextNumericId(items: Array<{ id?: unknown }>): number {
  let maxId = 0
  for (const item of items) {
    const raw = item?.id
    const id = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(id) && id > maxId)
      maxId = id
  }
  return maxId + 1
}

function fillTestData(): void {
  rows.value = [
    { identity: 'identity', displayName: 'ID', exampleValue: '1112', inFilter: false },
    { identity: 'status', displayName: 'Статус', exampleValue: 'RUN', inFilter: true },
    { identity: 'type', displayName: 'Тип', exampleValue: 'SCR', inFilter: true },
    { identity: 'Q', displayName: 'Q', exampleValue: '-', inFilter: false },
    { identity: 'airline', displayName: 'Авиакомпания', exampleValue: 'U6', inFilter: true },
    { identity: 'senderLink', displayName: 'Ссылка на создателя сообщения', exampleValue: '-', inFilter: false },
    { identity: 'sender', displayName: 'Отправитель', exampleValue: 'SLOT@U6.RU', inFilter: false },
    { identity: 'topic', displayName: 'Тема/От', exampleValue: 'Slot coordination', inFilter: false },
    { identity: 'receivedAt', displayName: 'Время получения', exampleValue: new Date().toISOString(), inFilter: false },
  ]
  generatorTitle.value = 'Телеграфия'
}

function findTextComponentId(): number | null {
  const direct = Endge.domain.getComponent('text')
  if (direct?.id != null)
    return direct.id

  const all = Endge.domain.getComponents()
  const byIdentity = all.find(c => String((c as any)?.identity ?? '').toLowerCase() === 'text')
  if (byIdentity?.id != null)
    return byIdentity.id

  return null
}

function buildMockObject(fields: Array<{ identity: string; exampleValue: string }>): Record<string, any> {
  const obj: Record<string, any> = {}
  for (const f of fields) {
    const key = String(f.identity ?? '').trim()
    if (!key)
      continue
    obj[key] = f.exampleValue ?? ''
  }
  return obj
}

async function generate(): Promise<void> {
  const titleBase = generatorTitle.value.trim() || 'Generated'
  const displayName = `${titleBase} (Gen)`
  const inheritNames = genView.value && inheritEntities.value

  const cleanRows = rows.value
    .map(r => ({
      identity: String(r.identity ?? '').trim(),
      displayName: String(r.displayName ?? '').trim(),
      exampleValue: String(r.exampleValue ?? ''),
      inFilter: r.inFilter === true,
    }))
    .filter(r => r.identity.length > 0)

  // 1) Фильтр
  let createdFilter: RFilter | null = null
  if (genFilter.value) {
    const filter = new RFilter()
    filter.id = getNextNumericId(Endge.domain.getFilters())
    filter.identity = generateIdentity('filter')
    const filterLabel = inheritNames ? 'Фильтр (Gen)' : displayName
    filter.name = filterLabel
    filter.displayName = filterLabel
    filter.active = true

    const filterFields: FilterFieldItemSchema[] = cleanRows
      .filter(r => r.inFilter)
      .map((r) => {
        return {
          key: r.identity,
          label: r.displayName || r.identity,
          mode: 'static',
          multiple: true,
          staticOptions: [],
          active: true,
        }
      })

    filter.fields = filterFields
    filter.inherited = genView.value && inheritEntities.value
    Endge.domain.addFilter(filter)
    createdFilter = filter
  }

  // 2) Запрос (source-first, с mockData)
  let createdQuery: RQuery | null = null
  if (genQuery.value) {
    const queryLabel = inheritNames ? 'Запрос (Gen)' : displayName
    const q = new RQuery(queryLabel, new RField('returnField', 'Null'))
    q.id = getNextNumericId(Endge.domain.getQueries())
    q.identity = generateIdentity('query')
    q.name = queryLabel
    q.displayName = queryLabel
    q.type = QueryType.REST

    const mockObj = buildMockObject(cleanRows)
    const items = Array.from({ length: 20 }, (_v, i) => ({
      ...mockObj,
      id: i + 1,
    }))
    q.sourceVersion = 1
    q.source = createGeneratedQuerySource({
      filterIdentity: createdFilter?.identity ?? null,
      mockItems: items,
    })

    q.inherited = genView.value && inheritEntities.value
    Endge.domain.addQuery(q)
    createdQuery = q
  }

  // 3) Компонент-таблица
  let createdTable: RComponentTable | null = null
  if (genComponent.value) {
    const textComponentId = findTextComponentId()
    if (textComponentId == null) {
      console.warn('[ViewGenerator] Не найден компонент с identity "text" в домене. Генерация компонента пропущена.')
      return
    }

    const table = new RComponentTable()
    table.id = getNextNumericId(Endge.domain.getComponents())
    table.identity = generateIdentity('component')
    table.name = inheritNames ? 'Таблица (Gen)' : displayName
    table.type = ComponentType.Table

    table.inputFields = {
      items: new RField('items', 'Any', true, false),
    }
    table.sourceIndex = 'items'
    table.bindings = { keys: { items: { pk: 'id', fk: '' } } }
    table.inherited = genView.value && inheritEntities.value

    const ColumnCtor = RComponentTableColumn_TypeCtor(ComponentType.Component)
    if (!ColumnCtor) {
      console.warn('[ViewGenerator] Не найден конструктор колонки типа "component". Генерация компонента пропущена.')
      return
    }

    table.columns = cleanRows.map((r) => {
      const col = new ColumnCtor()
      col.title = r.displayName || r.identity
      col.type = ComponentType.Component
      ;(col as any).componentId = textComponentId
      col.dataPaths = {
        value: `$store.items[$i].${r.identity}`,
      }
      return col as any
    })

    Endge.domain.addComponent(table)
    createdTable = table
  }

  // 4) Вид (если включена генерация вида) - привязываем созданные сущности
  if (genView.value) {
    const view = new RView()
    view.id = getNextNumericId(Endge.domain.getViews())
    view.identity = generateIdentity('view')
    view.name = displayName
    view.componentId = createdTable?.id ?? null
    view.filterId = createdFilter?.id ?? null
    view.queryId = createdQuery?.id ?? null
    Endge.domain.addView(view)

    if (inheritNames) {
      const inheritedFrom = [{ docType: 'view' as const, docIdentity: view.identity }]
      const setInheritedFromView = (obj: { inherited?: boolean; meta?: Record<string, unknown> } | null | undefined) => {
        if (!obj) return
        obj.inherited = true
        obj.meta = { ...(obj.meta && typeof obj.meta === 'object' ? obj.meta : {}), inheritedFrom }
      }
      setInheritedFromView(createdFilter ?? undefined)
      setInheritedFromView(createdQuery ?? undefined)
      setInheritedFromView(createdTable ?? undefined)
    }

    try {
      if (createdFilter) await Endge.schema.saveDocument(createdFilter.id, FilterType.DefaultFilter)
      if (createdQuery) await Endge.schema.saveDocument(createdQuery.id, createdQuery.type)
      if (createdTable) await Endge.schema.saveDocument(createdTable.id, ComponentType.Table)
      await Endge.schema.saveDocument(view.id, 'view')
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Ошибка сохранения в Payload', { description: msg })
      return
    }

    toast.success('Генерация завершена')
    EndgeIDE.tabs.openDocument(view.id, 'view')
    EndgeIDE.tabs.closeTab('view-generator')
  }
  else {
    try {
      if (createdFilter) await Endge.schema.saveDocument(createdFilter.id, FilterType.DefaultFilter)
      if (createdQuery) await Endge.schema.saveDocument(createdQuery.id, createdQuery.type)
      if (createdTable) await Endge.schema.saveDocument(createdTable.id, ComponentType.Table)
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Ошибка сохранения в Payload', { description: msg })
      return
    }
    toast.success('Генерация завершена')
  }
}

function createGeneratedQuerySource(input: { filterIdentity: string | null; mockItems: unknown[] }): string {
  const filterItems = input.filterIdentity
    ? `[
      filter.reference(${JSON.stringify(input.filterIdentity)}),
    ]`
    : '[]'

  return `defineQuery({
  kind: 'rest',

  request: {
    endpoint: 'mock://local',
    path: '',
    method: 'GET',
    headers: {},
    auth: { mode: 'none' },
  },

  params: {},

  filters: {
    mode: 'merge',
    items: ${filterItems},
  },

  response: {
    subField: 'items',
    return: field('Null'),
  },

  mock: {
    enabled: true,
    data: ${JSON.stringify(input.mockItems, null, 4)},
  },
})
`
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">
            Поля вида
          </h2>
          <Button variant="outline" size="sm" @click="fillTestData">
            <FlaskConical class="size-4 mr-2" />
            Тестовое заполнение
          </Button>
        </div>

        <div class="space-y-2">
          <Label>Название</Label>
          <Input
            v-model="generatorTitle"
            placeholder="Например: Расписание слотов"
          />
        </div>

        <Card class="overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b bg-muted/50">
                  <th class="text-left p-2 font-medium w-[140px]">
                    Identity
                  </th>
                  <th class="text-left p-2 font-medium">
                    Отображаемое имя
                  </th>
                  <th class="text-left p-2 font-medium min-w-[160px]">
                    Пример значения
                  </th>
                  <th class="text-left p-2 font-medium w-[90px]">
                    Фильтр
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in rows"
                  :key="idx"
                  class="border-b last:border-0 hover:bg-muted/30"
                >
                  <td class="p-2 align-middle">
                    <Input
                      v-model="row.identity"
                      class="h-8 text-sm"
                      placeholder="identity"
                    />
                  </td>
                  <td class="p-2 align-middle">
                    <Input
                      v-model="row.displayName"
                      class="h-8 text-sm"
                      placeholder="Имя"
                    />
                  </td>
                  <td class="p-2 align-middle">
                    <Input
                      v-model="row.exampleValue"
                      class="h-8 text-sm"
                    />
                  </td>
                  <td class="p-2 align-middle">
                    <Checkbox
                      :id="`filter-${idx}`"
                      :model-value="row.inFilter"
                      @update:model-value="(v) => (row.inFilter = v === true)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div class="space-y-2">
          <Label class="text-sm font-medium">
            Опции генерации
          </Label>
          <div class="space-y-2 pl-1">
            <div class="flex items-center gap-2">
              <Checkbox
                id="gen-query"
                :model-value="genQuery"
                @update:model-value="(v) => (genQuery = !!v)"
              />
              <Label for="gen-query" class="cursor-pointer text-sm">
                Генерация запроса
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox
                id="gen-component"
                :model-value="genComponent"
                @update:model-value="(v) => (genComponent = !!v)"
              />
              <Label for="gen-component" class="cursor-pointer text-sm">
                Генерация компонента
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox
                id="gen-filter"
                :model-value="genFilter"
                @update:model-value="(v) => (genFilter = !!v)"
              />
              <Label for="gen-filter" class="cursor-pointer text-sm">
                Генерация фильтра
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox
                id="gen-view"
                :model-value="genView"
                @update:model-value="(v) => (genView = !!v)"
              />
              <Label for="gen-view" class="cursor-pointer text-sm">
                Генерация вида
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox
                id="inherit-entities"
                :model-value="inheritEntities"
                :disabled="!genView"
                @update:model-value="(v) => (inheritEntities = !!v)"
              />
              <Label for="inherit-entities" class="cursor-pointer text-sm" :class="{ 'opacity-50 cursor-not-allowed': !genView }">
                Унаследовать сущности от вида
              </Label>
            </div>
          </div>
        </div>

        <div class="pt-2">
          <Button @click="generate">
            Сгенерировать
          </Button>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
