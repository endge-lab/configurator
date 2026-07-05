<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'

import { ComponentType, DocumentFactory, DomainSectionType, Endge, QueryType, ScriptType } from '@endge/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { useDomainStore } from '@endge/vue'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

interface DocTypeOption {
  type: DomainDocumentType
  label: string
  section: DomainSectionType
}

/** Типы документов, которые можно создать через фабрику (без типов/примитивов - для них не выбираем папку). */
const CREATABLE_DOC_TYPES: DocTypeOption[] = [
  { type: ComponentType.DSL, label: 'DSL', section: DomainSectionType.Component },
  { type: ComponentType.Table, label: 'Table', section: DomainSectionType.Component },
  { type: COMPONENT_SFC_TYPE, label: 'SFC', section: DomainSectionType.Component },
  { type: QueryType.GraphQL, label: 'GraphQL', section: DomainSectionType.Query },
  { type: QueryType.REST, label: 'REST', section: DomainSectionType.Query },
  { type: ScriptType.ScenarioSetup, label: 'Сценарий', section: DomainSectionType.Scenario },
  { type: 'action' as DomainDocumentType, label: 'Действие', section: DomainSectionType.Action },
  { type: 'integration' as DomainDocumentType, label: 'Интеграция', section: DomainSectionType.Integration },
  { type: 'view' as DomainDocumentType, label: 'Вид', section: DomainSectionType.View },
  { type: 'environment' as DomainDocumentType, label: 'Окружение', section: DomainSectionType.Environment },
  { type: 'tenant' as DomainDocumentType, label: 'Тенант', section: DomainSectionType.Tenant },
  { type: 'policy' as DomainDocumentType, label: 'Политика', section: DomainSectionType.Policy },
  { type: 'style' as DomainDocumentType, label: 'Стиль', section: DomainSectionType.Style },
  { type: 'page-template' as DomainDocumentType, label: 'Шаблон страницы', section: DomainSectionType.PageTemplate },
  { type: 'page' as DomainDocumentType, label: 'Страница', section: DomainSectionType.Page },
  { type: 'navigation' as DomainDocumentType, label: 'Навигация', section: DomainSectionType.Navigation },
  { type: 'vocabs' as DomainDocumentType, label: 'Словарь', section: DomainSectionType.Vocabs },
  { type: 'i18n-bundles' as DomainDocumentType, label: 'Словарь переводов', section: DomainSectionType.I18nBundles },
]

const ROOT_IDS: Record<DomainSectionType, string> = {
  [DomainSectionType.Component]: 'root-components',
  [DomainSectionType.Query]: 'root-queries',
  [DomainSectionType.Scenario]: 'root-scenarios',
  [DomainSectionType.Type]: 'root-types',
  [DomainSectionType.Primitive]: 'root-primitives',
  [DomainSectionType.Action]: 'root-actions',
  [DomainSectionType.Converter]: 'root-converters',
  [DomainSectionType.Integration]: 'root-integrations',
  [DomainSectionType.View]: 'root-views',
  [DomainSectionType.Parameters]: 'root-parameters',
  [DomainSectionType.Filters]: 'root-filters',
  [DomainSectionType.Environment]: 'root-environments',
  [DomainSectionType.Tenant]: 'root-tenants',
  [DomainSectionType.Policy]: 'root-policies',
  [DomainSectionType.Style]: 'root-styles',
  [DomainSectionType.PageTemplate]: 'root-page-templates',
  [DomainSectionType.Page]: 'root-pages',
  [DomainSectionType.Navigation]: 'root-navigations',
  [DomainSectionType.Settings]: 'root-settings',
  [DomainSectionType.Vocabs]: 'root-vocabs',
  [DomainSectionType.I18nBundles]: 'root-i18n-bundles',
  [DomainSectionType.Project]: 'root-projects',
}

/** entityType папок в Payload — только папки этой секции показываем в выборе. */
const SECTION_FOLDER_ENTITY_TYPE: Partial<Record<DomainSectionType, string>> = {
  [DomainSectionType.Component]: 'components',
  [DomainSectionType.Query]: 'queries',
  [DomainSectionType.Scenario]: 'scenarios',
  [DomainSectionType.Type]: 'types',
  [DomainSectionType.Action]: 'actions',
  [DomainSectionType.Converter]: 'converters',
  [DomainSectionType.Integration]: 'integrations',
  [DomainSectionType.View]: 'views',
  [DomainSectionType.Parameters]: 'parameters',
  [DomainSectionType.Filters]: 'filters',
  [DomainSectionType.Environment]: 'environments',
  [DomainSectionType.Tenant]: 'tenants',
  [DomainSectionType.Policy]: 'policies',
  [DomainSectionType.Style]: 'styles',
  [DomainSectionType.PageTemplate]: 'page-templates',
  [DomainSectionType.Page]: 'pages',
  [DomainSectionType.Navigation]: 'navigations',
  [DomainSectionType.Vocabs]: 'vocabs',
  [DomainSectionType.I18nBundles]: 'i18n-bundles',
  [DomainSectionType.Project]: 'projects',
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const domainStore = useDomainStore()

const activeType = ref<DomainDocumentType>(ComponentType.DSL)
const identity = ref('')
const name = ref('')
const selectedFolderId = ref<string>('')
const createMode = ref<'form' | 'json'>('form')
const jsonPayload = ref('')
const jsonTouched = ref(false)
const jsonPlaceholder = `{
  "identity": "new-doc",
  "displayName": "New doc"
}`
const loading = ref(false)

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const activeOption = computed<DocTypeOption>(() =>
  CREATABLE_DOC_TYPES.find(d => d.type === activeType.value) ?? CREATABLE_DOC_TYPES[0]!,
)

/** Показывать выбор папки только для сущностей (Component, Query, Scenario, Integration), не для типов. */
const showFolderSelect = computed(() => {
  const s = activeOption.value.section
  return s === DomainSectionType.Component
    || s === DomainSectionType.Query
    || s === DomainSectionType.Scenario
    || s === DomainSectionType.Action
    || s === DomainSectionType.Integration
    || s === DomainSectionType.View
    || s === DomainSectionType.Environment
    || s === DomainSectionType.Tenant
    || s === DomainSectionType.Policy
    || s === DomainSectionType.Style
    || s === DomainSectionType.PageTemplate
    || s === DomainSectionType.Page
    || s === DomainSectionType.Navigation
    || s === DomainSectionType.Vocabs
    || s === DomainSectionType.I18nBundles
})

/** Папки только текущей секции (по entityType): корень + вложенные под этим root. */
const folderOptions = computed(() => {
  if (!showFolderSelect.value) return []
  const section = activeOption.value.section
  const rootId = ROOT_IDS[section]
  const sectionEntityType = SECTION_FOLDER_ENTITY_TYPE[section]
  const allFolders = Array.isArray(domainStore.folders) ? domainStore.folders : []
  const folders = sectionEntityType
    ? allFolders.filter((f: any) => (f as any).entityType === sectionEntityType)
    : allFolders
  const list: { id: string, name: string, depth: number }[] = [{ id: '', name: 'В корне секции', depth: 0 }]
  const rootFolder = folders.find((f: any) => String(f.identity ?? f.id) === rootId)
  const rootFolderId = rootFolder != null ? (rootFolder.id ?? rootFolder.identity) : rootId

  function collect(parentId: string | number, depth: number): { id: string, name: string, depth: number }[] {
    const out: { id: string, name: string, depth: number }[] = []
    for (const f of folders) {
      const p = (f as any).parent ?? (f as any).parentId ?? null
      if (p == null) continue
      if (String(p) !== String(parentId)) continue
      const id = String((f as any).id ?? (f as any).identity ?? '')
      const name = String((f as any).displayName ?? (f as any).name ?? (f as any).identity ?? id)
      out.push({ id, name, depth })
      out.push(...collect((f as any).id ?? (f as any).identity, depth + 1))
    }
    return out
  }
  list.push(...collect(rootFolderId, 1))
  return list
})

watch(() => props.open, (v) => {
  if (v) {
    const ctx = EndgeIDE.modals.createDocumentContext?.value ?? null
    if (ctx?.sectionType != null) {
      const firstOfSection = CREATABLE_DOC_TYPES.find(d => d.section === ctx.sectionType)
      if (firstOfSection) activeType.value = firstOfSection.type
      selectedFolderId.value = ctx.folderId != null ? String(ctx.folderId) : ''
    } else {
      selectedFolderId.value = ''
    }
    identity.value = ''
    name.value = ''
    createMode.value = 'form'
    jsonTouched.value = false
    jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
  }
})

watch(activeType, () => {
  const opts = folderOptions.value
  const valid = !selectedFolderId.value || opts.some((o: { id: string }) => o.id === selectedFolderId.value)
  if (!valid) selectedFolderId.value = ''
  jsonTouched.value = false
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

watch([identity, name, selectedFolderId], () => {
  if (jsonTouched.value)
    return
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

function buildPayloadTemplate(): Record<string, unknown> {
  const id = identity.value.trim() || 'new-doc'
  const displayName = name.value.trim() || id
  const folder = showFolderSelect.value && selectedFolderId.value
    ? selectedFolderId.value
    : null

  const base: Record<string, unknown> = {
    identity: id,
    displayName,
    ...(folder != null && { folder }),
  }

  if (activeType.value === ComponentType.DSL) {
    return {
      ...base,
      componentType: ComponentType.DSL,
      schema: {},
      inputFields: [],
      jsxScript: '',
    }
  }

  if (activeType.value === ComponentType.Table) {
    return {
      ...base,
      componentType: ComponentType.Table,
      schema: {},
      inputFields: [],
      columns: [],
    }
  }

  if (activeType.value === COMPONENT_SFC_TYPE) {
    return {
      ...base,
      source: '<script setup lang="ts">\\n</' + 'script>\\n\\n<template>\\n  <Text>SFC</Text>\\n</template>\\n',
      supportedTargets: ['dom', 'canvas'],
      modelVersion: 1,
      meta: {},
    }
  }

  if (
    activeType.value === QueryType.REST
    || activeType.value === QueryType.GraphQL
    || activeType.value === QueryType.Custom
  ) {
    return {
      ...base,
      type: activeType.value,
      subField: 'items',
      params: [],
      returnField: {
        name: 'input',
        type: 'null',
        isArray: false,
        optional: false,
        params: [],
      },
      mockData: null,
      mockDataEnabled: false,
      auth: { mode: 'token' },
      filterMode: 'merge',
      filters: [],
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === ScriptType.ScenarioSetup) {
    return {
      ...base,
      schema: {},
      meta: {},
    }
  }

  if (activeType.value === 'action') {
    return {
      ...base,
      description: null,
      definition: {
        version: 1,
        entrypoint: 'flow-entry',
        nodes: [],
        edges: [],
      },
      input: null,
      output: null,
      meta: {},
    }
  }

  if (activeType.value === 'page') {
    return {
      ...base,
      routeName: id,
      routePath: `/${id}`,
      template: null,
      controller: null,
      enabled: true,
      areas: [],
      meta: {},
    }
  }

  if (activeType.value === 'page-template') {
    return {
      ...base,
      description: null,
      areas: [],
      preview: { rows: [] },
      meta: {},
    }
  }

  if (activeType.value === 'navigation') {
    return {
      ...base,
      description: null,
      tree: [],
      meta: {},
    }
  }

  if (activeType.value === 'vocabs') {
    return {
      ...base,
      mode: 'external_payload',
      baseApiUrl: null,
      collectionSlug: null,
      active: true,
      meta: {},
    }
  }

  if (activeType.value === 'i18n-bundles') {
    return {
      ...base,
      description: null,
      locales: {},
      active: true,
    }
  }

  if (activeType.value === 'style') {
    return {
      ...base,
      styles: {},
      meta: {},
    }
  }

  if (activeType.value === 'tenant') {
    return {
      ...base,
      code: id,
      description: null,
    }
  }

  return base
}

function onJsonInput(value: string): void {
  jsonTouched.value = true
  jsonPayload.value = value
}

async function onSubmit(): Promise<void> {
  loading.value = true
  try {
    if (createMode.value === 'json') {
      let parsed: Record<string, unknown>
      try {
        const raw = JSON.parse(jsonPayload.value)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          throw new Error('JSON должен быть объектом')
        parsed = raw as Record<string, unknown>
      }
      catch (e: any) {
        throw new Error(`Невалидный JSON: ${e?.message ?? String(e)}`)
      }

      await Endge.schema.upsertPayloadDocumentRaw(activeType.value, parsed)
      const createdIdentity = String(parsed.identity ?? '').trim()
      if (createdIdentity)
        EndgeIDE.tabs.openDocument(createdIdentity, activeType.value)
      toast.success('Документ создан из JSON', { description: createdIdentity || 'без identity' })
      openModel.value = false
      return
    }

    const id = identity.value.trim()
    if (!id) {
      toast.error('Введите идентификатор (identity)')
      return
    }
    const draft = DocumentFactory.create(activeType.value, {
      id,
      name: name.value.trim() || undefined,
      folderId: showFolderSelect.value && selectedFolderId.value ? selectedFolderId.value : undefined,
      registerInDomain: false,
    })

    // Сохраняем новый документ в payload (tabs.save() сохраняет активную вкладку, а не созданный документ)
    await Endge.schema.saveDocument(id, activeType.value, { model: draft })

    EndgeIDE.tabs.openDocument(id, activeType.value)
    toast.success('Документ создан', { description: id })
    openModel.value = false
  }
  catch (e: any) {
    toast.error('Ошибка создания документа', { description: e?.message ?? String(e) })
  }
  finally {
    loading.value = false
  }
}

function onCancel(): void {
  openModel.value = false
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Создать документ</DialogTitle>
      </DialogHeader>

      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 py-2">
        <!-- Слева: список типов сущностей -->
        <div class="flex flex-col gap-2">
          <Label class="text-muted-foreground text-xs">Тип сущности</Label>
          <ScrollArea class="h-[240px] rounded-md border p-1">
            <div class="flex flex-col gap-0.5">
              <button
                v-for="doc in CREATABLE_DOC_TYPES"
                :key="doc.type"
                type="button"
                class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                :class="activeType === doc.type ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
                @click="activeType = doc.type"
              >
                <i :class="EndgeIDE.tabs.getDocumentIcon(doc.type)" class="text-lg shrink-0" />
                <span class="font-medium">{{ doc.label }}</span>
              </button>
            </div>
          </ScrollArea>
        </div>

        <!-- Справа: данные для создания -->
        <div class="flex min-h-0 flex-col gap-3">
          <Label class="text-muted-foreground text-xs">Данные для создания</Label>

          <Tabs v-model="createMode" class="flex min-h-0 flex-1 flex-col">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="form">Форма</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="form" class="m-0 mt-3">
              <div class="space-y-3 rounded-md border p-3">
                <div class="grid gap-2">
                  <Label for="create-doc-identity">Identity (id)</Label>
                  <Input
                    id="create-doc-identity"
                    v-model="identity"
                    placeholder="Уникальный идентификатор"
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="create-doc-name">Название</Label>
                  <Input
                    id="create-doc-name"
                    v-model="name"
                    :placeholder="activeOption?.type === ComponentType.Table ? 'Новая таблица' : (activeOption?.type === QueryType.GraphQL || activeOption?.type === QueryType.REST) ? 'Новый запрос' : activeOption?.type === ScriptType.ScenarioSetup ? 'Новый сценарий' : 'Без названия'"
                  />
                </div>
                <div v-if="showFolderSelect" class="grid gap-2">
                  <Label for="create-doc-folder">Папка</Label>
                  <select
                    id="create-doc-folder"
                    v-model="selectedFolderId"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option v-for="opt in folderOptions" :key="opt.id || 'root'" :value="opt.id">
                      {{ opt.depth ? '\u00A0\u00A0'.repeat(opt.depth) : '' }}{{ opt.name }}
                    </option>
                  </select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" class="m-0 mt-3 flex min-h-0 flex-1 flex-col">
              <div class="mb-2 text-xs text-muted-foreground">
                Вставьте JSON документа в формате Payload. Обязательное поле: <span class="font-mono">identity</span>.
              </div>
              <Textarea
                :model-value="jsonPayload"
                class="min-h-[240px] w-full font-mono text-xs"
                :rows="16"
                :placeholder="jsonPlaceholder"
                @update:model-value="onJsonInput"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="loading" @click="onCancel">
          Отменить
        </Button>
        <Button :disabled="loading" @click="onSubmit">
          Создать
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
