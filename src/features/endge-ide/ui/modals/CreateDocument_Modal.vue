<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'

import { ComponentType, DocumentDraftFactory, DomainSectionType, Endge, ENDGE_STYLE_DEFAULT_SOURCE, FilterType, QueryType } from '@endge/core'
import { useDomainStore } from '@endge/vue'
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
import {
  getQueryRootFolderId,
  QUERY_COMPOSITION_CREATE_KIND,
  QUERY_COMPOSITION_PRESENTATION_KIND,
  setQueryCompositionRole,
} from '@/features/endge-ide/model/domain/query-composition-presentation'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType
type CreateDocumentKind = DomainDocumentType | typeof QUERY_COMPOSITION_CREATE_KIND

interface DocTypeOption {
  type: CreateDocumentKind
  label: string
  defaultName: string
  section: DomainSectionType
}

/** Типы документов, которые можно создать через фабрику (без типов/примитивов - для них не выбираем папку). */
const CREATABLE_DOC_TYPES: DocTypeOption[] = [
  { type: ComponentType.DSL, label: 'DSL', defaultName: 'Без названия', section: DomainSectionType.Component },
  { type: ComponentType.Table, label: 'Table', defaultName: 'Новая таблица', section: DomainSectionType.Component },
  { type: COMPONENT_SFC_TYPE, label: 'SFC', defaultName: 'Новый SFC-компонент', section: DomainSectionType.Component },
  { type: QueryType.REST, label: 'Запрос', defaultName: 'Новый запрос', section: DomainSectionType.Query },
  { type: QUERY_COMPOSITION_CREATE_KIND, label: 'Композиция запросов', defaultName: 'Новая композиция', section: DomainSectionType.Query },
  { type: 'data-view' as DomainDocumentType, label: 'Data View', defaultName: 'Новый Data View', section: DomainSectionType.DataView },
  { type: 'composition' as DomainDocumentType, label: 'Композиция', defaultName: 'Новая композиция', section: DomainSectionType.Composition },
  { type: 'store' as DomainDocumentType, label: 'Хранилище', defaultName: 'Без названия', section: DomainSectionType.Store },
  { type: 'mock' as DomainDocumentType, label: 'Mock', defaultName: 'Новый Mock', section: DomainSectionType.Mock },
  { type: FilterType.DefaultFilter, label: 'Фильтр', defaultName: 'Новый фильтр', section: DomainSectionType.Filters },
  { type: 'action' as DomainDocumentType, label: 'Действие', defaultName: 'Новое действие', section: DomainSectionType.Action },
  { type: 'computation' as DomainDocumentType, label: 'Вычисление', defaultName: 'Новое вычисление', section: DomainSectionType.Computation },
  { type: 'integration' as DomainDocumentType, label: 'Интеграция', defaultName: 'Новая интеграция', section: DomainSectionType.Integration },
  { type: 'environment' as DomainDocumentType, label: 'Окружение', defaultName: 'Новое окружение', section: DomainSectionType.Environment },
  { type: 'tenant' as DomainDocumentType, label: 'Тенант', defaultName: 'Новый tenant', section: DomainSectionType.Tenant },
  { type: 'policy' as DomainDocumentType, label: 'Политика', defaultName: 'Новая политика', section: DomainSectionType.Policy },
  { type: 'style' as DomainDocumentType, label: 'Стиль', defaultName: 'Новый стиль', section: DomainSectionType.Style },
  { type: 'page-template' as DomainDocumentType, label: 'Шаблон страницы', defaultName: 'Новый шаблон страницы', section: DomainSectionType.PageTemplate },
  { type: 'page' as DomainDocumentType, label: 'Страница', defaultName: 'Новая страница', section: DomainSectionType.Page },
  { type: 'navigation' as DomainDocumentType, label: 'Навигация', defaultName: 'Новая навигация', section: DomainSectionType.Navigation },
  { type: 'vocabs' as DomainDocumentType, label: 'Словарь', defaultName: 'Новый словарь', section: DomainSectionType.Vocabs },
  { type: 'i18n-bundles' as DomainDocumentType, label: 'Словарь переводов', defaultName: 'Новый словарь переводов', section: DomainSectionType.I18nBundles },
  { type: 'auth-profile' as DomainDocumentType, label: 'Профиль авторизации', defaultName: 'Новый профиль авторизации', section: DomainSectionType.AuthProfile },
]

const ROOT_IDS: Record<DomainSectionType, string> = {
  [DomainSectionType.Component]: 'root-components',
  [DomainSectionType.Query]: 'root-queries',
  [DomainSectionType.DataView]: 'root-data-views',
  [DomainSectionType.Composition]: 'root-compositions',
  [DomainSectionType.Store]: 'root-stores',
  [DomainSectionType.Mock]: 'root-mocks',
  [DomainSectionType.Type]: 'root-types',
  [DomainSectionType.Primitive]: 'root-primitives',
  [DomainSectionType.Action]: 'root-actions',
  [DomainSectionType.Converter]: 'root-converters',
  [DomainSectionType.Computation]: 'root-computations',
  [DomainSectionType.Integration]: 'root-integrations',
  [DomainSectionType.Parameters]: 'root-parameters',
  [DomainSectionType.Filters]: 'root-filters',
  [DomainSectionType.Environment]: 'root-environments',
  [DomainSectionType.Tenant]: 'root-tenants',
  [DomainSectionType.Policy]: 'root-policies',
  [DomainSectionType.Style]: 'root-styles',
  [DomainSectionType.PageTemplate]: 'root-page-templates',
  [DomainSectionType.Page]: 'root-pages',
  [DomainSectionType.Navigation]: 'root-navigations',
  [DomainSectionType.Vocabs]: 'root-vocabs',
  [DomainSectionType.I18nBundles]: 'root-i18n-bundles',
  [DomainSectionType.AuthProfile]: 'root-auth-profiles',
  [DomainSectionType.Project]: 'root-projects',
}

/** entityType папок в Payload — только папки этой секции показываем в выборе. */
const SECTION_FOLDER_ENTITY_TYPE: Partial<Record<DomainSectionType, string>> = {
  [DomainSectionType.Component]: 'components',
  [DomainSectionType.Query]: 'queries',
  [DomainSectionType.DataView]: 'data-views',
  [DomainSectionType.Composition]: 'compositions',
  [DomainSectionType.Store]: 'stores',
  [DomainSectionType.Mock]: 'mocks',
  [DomainSectionType.Type]: 'types',
  [DomainSectionType.Action]: 'actions',
  [DomainSectionType.Converter]: 'converters',
  [DomainSectionType.Computation]: 'computations',
  [DomainSectionType.Integration]: 'integrations',
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
  [DomainSectionType.AuthProfile]: 'auth-profiles',
  [DomainSectionType.Project]: 'projects',
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const domainStore = useDomainStore()

const activeType = ref<CreateDocumentKind>(ComponentType.DSL)
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

/** Показывать выбор папки только для доменных сущностей, не для типов. */
const showFolderSelect = computed(() => {
  const s = activeOption.value.section
  return s === DomainSectionType.Component
    || s === DomainSectionType.Query
    || s === DomainSectionType.DataView
    || s === DomainSectionType.Composition
    || s === DomainSectionType.Store
    || s === DomainSectionType.Mock
    || s === DomainSectionType.Filters
    || s === DomainSectionType.Action
    || s === DomainSectionType.Computation
    || s === DomainSectionType.Integration
    || s === DomainSectionType.Environment
    || s === DomainSectionType.Tenant
    || s === DomainSectionType.Policy
    || s === DomainSectionType.Style
    || s === DomainSectionType.PageTemplate
    || s === DomainSectionType.Page
    || s === DomainSectionType.Navigation
    || s === DomainSectionType.Vocabs
    || s === DomainSectionType.I18nBundles
    || s === DomainSectionType.AuthProfile
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
  const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
  const folder = showFolderSelect.value && selectedFolderId.value
    ? selectedFolderId.value
    : isQueryComposition ? getQueryRootFolderId() : null

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

  if (activeType.value === QueryType.REST) {
    return {
      ...base,
      type: QueryType.REST,
      source: Endge.source.createDefault('query'),
      sourceVersion: 2,
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === 'data-view') {
    return {
      ...base,
      source: Endge.source.createDefault('data-view'),
      sourceVersion: 1,
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === 'composition' || isQueryComposition) {
    return {
      ...base,
      description: null,
      source: Endge.source.createDefault('composition'),
      sourceVersion: 1,
      meta: isQueryComposition ? setQueryCompositionRole({}, true) : {},
      inherited: false,
    }
  }

  if (activeType.value === 'store') {
    return {
      ...base,
      description: null,
      source: Endge.source.createDefault('store'),
      sourceVersion: 1,
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === 'mock') {
    return {
      ...base,
      description: null,
      contentSource: 'document',
      contentType: 'application/json',
      source: '{}',
      codeRef: null,
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === 'computation') {
    return {
      ...base,
      description: null,
      source: Endge.source.createDefault('computation'),
      sourceVersion: 1,
      contractVersion: 1,
      input: {},
      output: {},
      meta: {},
      inherited: false,
    }
  }

  if (activeType.value === FilterType.DefaultFilter) {
    return {
      ...base,
      fields: [],
      source: Endge.source.createDefault('filter'),
      sourceVersion: 1,
      meta: {},
      inherited: false,
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
      description: null,
      source: ENDGE_STYLE_DEFAULT_SOURCE,
      sourceVersion: 1,
      meta: {},
      active: true,
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

      const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
      const documentType = isQueryComposition
        ? 'composition' as DomainDocumentType
        : activeType.value as DomainDocumentType
      if (isQueryComposition) {
        parsed.meta = setQueryCompositionRole(parsed.meta as Record<string, unknown> | undefined, true)
        if (parsed.folder == null || parsed.folder === '') {
          const rootFolderId = getQueryRootFolderId()
          if (rootFolderId == null) {
            throw new Error('Системная папка запросов не найдена')
          }
          parsed.folder = rootFolderId
        }
      }

      await Endge.schema.upsertPayloadDocumentRaw(documentType, parsed)
      const createdIdentity = String(parsed.identity ?? '').trim()
      if (createdIdentity) {
        EndgeIDE.tabs.openDocument(createdIdentity, documentType)
      }
      toast.success('Документ создан из JSON', { description: createdIdentity || 'без identity' })
      openModel.value = false
      return
    }

    const id = identity.value.trim()
    if (!id) {
      toast.error('Введите идентификатор (identity)')
      return
    }
    const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
    const documentType = isQueryComposition
      ? 'composition' as DomainDocumentType
      : activeType.value as DomainDocumentType
    const rootFolderId = isQueryComposition ? getQueryRootFolderId() : null
    if (isQueryComposition && rootFolderId == null) {
      throw new Error('Системная папка запросов не найдена')
    }
    const draft = DocumentDraftFactory.create(documentType, {
      identity: id,
      name: name.value.trim() || activeOption.value.defaultName,
      folderId: showFolderSelect.value && selectedFolderId.value
        ? selectedFolderId.value
        : rootFolderId ?? undefined,
    })
    if (isQueryComposition) {
      draft.meta = setQueryCompositionRole(draft.meta, true)
    }

    // Сохраняем новый документ в payload (tabs.save() сохраняет активную вкладку, а не созданный документ)
    await Endge.schema.saveDocument(id, documentType, { model: draft })

    EndgeIDE.tabs.openDocument(id, documentType)
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
                <i
                  :class="EndgeIDE.tabs.getDocumentIcon(
                    doc.type === QUERY_COMPOSITION_CREATE_KIND ? 'composition' : doc.type,
                    doc.type === QUERY_COMPOSITION_CREATE_KIND ? QUERY_COMPOSITION_PRESENTATION_KIND : undefined,
                  )"
                  class="text-lg shrink-0"
                />
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
                    :placeholder="activeOption?.type === ComponentType.Table ? 'Новая таблица' : activeOption?.type === QueryType.REST ? 'Новый запрос' : 'Без названия'"
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
