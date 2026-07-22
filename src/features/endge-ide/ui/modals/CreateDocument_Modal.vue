<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { CreateDocumentKind, DocumentCreateDescriptor } from '@/features/endge-ide/domain/types/document-create.type'
import type { DomainDocumentType, RComponentSFC, RComposition, RDocument } from '@endge/core'

import { ComponentType, DocumentDraftFactory, DomainSectionType, Endge, ENDGE_STYLE_DEFAULT_SOURCE, FilterType, QueryType } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  COMPONENT_TABLE_SFC_DEFAULT_SOURCE,
  DOCUMENT_CREATE_DESCRIPTORS,
} from '@/features/endge-ide/model/config/document-create'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { resolveCompositionCreatePlacement } from '@/features/endge-ide/model/domain/composition-create'
import {
  getQueryRootFolderId,
  QUERY_COMPOSITION_CREATE_KIND,
  QUERY_COMPOSITION_PRESENTATION_KIND,
  setQueryCompositionRole,
} from '@/features/endge-ide/model/domain/query-composition-presentation'
import { suggestDocumentIdentity } from '@/features/endge-ide/tools/document-create'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

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
  [DomainSectionType.Event]: 'root-events',
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

const domainStore = useDomainStore()
const ROOT_FOLDER_VALUE = '__section_root__'

const activeType = ref<CreateDocumentKind>(ComponentType.SFC)
const identity = ref('')
const name = ref('')
const description = ref('')
const selectedFolderId = ref<string>(ROOT_FOLDER_VALUE)
const selectedPageTemplateId = ref<string>('')
const typeSearch = ref('')
const showAllTypes = ref(false)
const identityTouched = ref(false)
const identityConflict = ref(false)
const identityChecking = ref(false)
const createMode = ref<'form' | 'json'>('form')
const jsonPayload = ref('')
const jsonTouched = ref(false)
const jsonPlaceholder = `{
  "identity": "new-doc",
  "displayName": "New doc"
}`
const loading = ref(false)
let identityValidationRequest = 0

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const activeOption = computed<DocumentCreateDescriptor>(() =>
  DOCUMENT_CREATE_DESCRIPTORS.find(d => d.type === activeType.value) ?? DOCUMENT_CREATE_DESCRIPTORS[0]!,
)

const createContext = computed(() => EndgeIDE.modals.createDocumentContext.value)
const lockedDocumentType = computed(() => createContext.value?.documentType ?? null)
const compositionOwner = computed(() =>
  activeType.value === 'composition' ? createContext.value?.compositionOwner ?? null : null,
)
const dialogTitle = computed(() => lockedDocumentType.value === 'composition' ? 'Создать композицию' : 'Создать документ')
const documentType = computed<DomainDocumentType>(() =>
  activeType.value === QUERY_COMPOSITION_CREATE_KIND
    ? 'composition'
    : activeType.value === ComponentType.Table
      ? COMPONENT_SFC_TYPE
      : activeType.value as DomainDocumentType,
)

const filteredTypeGroups = computed(() => {
  const contextualSection = createContext.value?.sectionType ?? null
  const query = typeSearch.value.trim().toLowerCase()
  const descriptors = DOCUMENT_CREATE_DESCRIPTORS.filter((descriptor) => {
    if (contextualSection && !showAllTypes.value && descriptor.section !== contextualSection) { return false }
    if (!query) { return true }
    return [descriptor.label, descriptor.description, descriptor.type, ...descriptor.keywords]
      .some(value => String(value).toLowerCase().includes(query))
  })
  const groups = new Map<string, DocumentCreateDescriptor[]>()
  for (const descriptor of descriptors) {
    const items = groups.get(descriptor.group) ?? []
    items.push(descriptor)
    groups.set(descriptor.group, items)
  }
  return [...groups].map(([label, items]) => ({ label, items }))
})

const pageTemplateOptions = computed(() =>
  (domainStore.pageTemplates ?? [])
    .map((template: any) => ({
      value: String(template?.id ?? ''),
      label: String(template?.displayName ?? template?.name ?? template?.identity ?? template?.id ?? ''),
    }))
    .filter((option: { value: string, label: string }) => option.value && option.label),
)

const identityError = computed(() => {
  if (!identity.value.trim()) { return 'Identity обязателен' }
  if (identityConflict.value) { return `Документ «${identity.value.trim()}» уже существует` }
  return null
})

const formError = computed(() => {
  if (identityError.value) { return identityError.value }
  if (activeType.value === 'page' && !selectedPageTemplateId.value) { return 'Для страницы выберите шаблон' }
  return null
})

/** Показывать выбор папки для секций, которые поддерживают folder placement. */
const showFolderSelect = computed(() => activeOption.value.supportsFolder && !compositionOwner.value)

/** Папки только текущей секции (по entityType): корень + вложенные под этим root. */
const folderOptions = computed(() => {
  if (!showFolderSelect.value) { return [] }
  const section = activeOption.value.section
  const rootId = ROOT_IDS[section]
  const sectionEntityType = SECTION_FOLDER_ENTITY_TYPE[section]
  const allFolders = Array.isArray(domainStore.folders) ? domainStore.folders : []
  const folders = sectionEntityType
    ? allFolders.filter((f: any) => (f as any).entityType === sectionEntityType)
    : allFolders
  const list: { value: string, label: string }[] = [{ value: ROOT_FOLDER_VALUE, label: 'В корне секции' }]
  const rootFolder = folders.find((f: any) => String(f.identity ?? f.id) === rootId)
  const rootFolderId = rootFolder != null ? (rootFolder.id ?? rootFolder.identity) : rootId

  function collect(parentId: string | number, depth: number): { value: string, label: string }[] {
    const out: { value: string, label: string }[] = []
    for (const f of folders) {
      const p = (f as any).parent ?? (f as any).parentId ?? null
      if (p == null) { continue }
      if (String(p) !== String(parentId)) { continue }
      const id = String((f as any).id ?? (f as any).identity ?? '')
      const name = String((f as any).displayName ?? (f as any).name ?? (f as any).identity ?? id)
      out.push({ value: id, label: `${'— '.repeat(depth)}${name}` })
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
    if (ctx?.documentType != null) {
      const requestedType = DOCUMENT_CREATE_DESCRIPTORS.find(d => d.type === ctx.documentType)
      if (requestedType) { activeType.value = requestedType.type }
      selectedFolderId.value = ctx.folderId != null ? String(ctx.folderId) : ROOT_FOLDER_VALUE
    }
    else if (ctx?.sectionType != null) {
      const firstOfSection = DOCUMENT_CREATE_DESCRIPTORS.find(d => d.section === ctx.sectionType)
      if (firstOfSection) { activeType.value = firstOfSection.type }
      selectedFolderId.value = ctx.folderId != null ? String(ctx.folderId) : ROOT_FOLDER_VALUE
    }
    else {
      selectedFolderId.value = ROOT_FOLDER_VALUE
    }
    identity.value = ''
    name.value = ''
    description.value = ''
    selectedPageTemplateId.value = pageTemplateOptions.value[0]?.value ?? ''
    typeSearch.value = ''
    showAllTypes.value = false
    identityTouched.value = false
    identityConflict.value = false
    createMode.value = 'form'
    jsonTouched.value = false
    jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
    void nextTick(() => document.getElementById('create-doc-type-search')?.focus())
  }
})

watch(activeType, () => {
  const opts = folderOptions.value
  const valid = opts.some((option: { value: string }) => option.value === selectedFolderId.value)
  if (!valid) { selectedFolderId.value = ROOT_FOLDER_VALUE }
  identityConflict.value = false
  jsonTouched.value = false
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

watch(name, (value) => {
  if (!identityTouched.value) { identity.value = suggestDocumentIdentity(value) }
})

watch([identity, name, description, selectedFolderId, selectedPageTemplateId], () => {
  identityConflict.value = false
  if (jsonTouched.value) { return }
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

function buildPayloadTemplate(): Record<string, unknown> {
  const id = identity.value.trim() || 'new-doc'
  const displayName = name.value.trim() || id
  const normalizedDescription = description.value.trim() || null
  const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
  const owner = compositionOwner.value
  const folder = showFolderSelect.value && selectedFolderId.value !== ROOT_FOLDER_VALUE
    ? selectedFolderId.value
    : isQueryComposition ? getQueryRootFolderId() : null

  const base: Record<string, unknown> = {
    identity: id,
    displayName,
    ...(folder != null && { folder }),
    ...(activeOption.value.supportsDescription && { description: normalizedDescription }),
  }

  if (activeType.value === ComponentType.Table) {
    return {
      ...base,
      source: COMPONENT_TABLE_SFC_DEFAULT_SOURCE,
      supportedTargets: ['dom', 'canvas'],
      modelVersion: 1,
      meta: {},
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
    }
  }

  if (activeType.value === 'data-view') {
    return {
      ...base,
      source: Endge.source.createDefault('data-view'),
      sourceVersion: 1,
      meta: {},
    }
  }

  if (activeType.value === 'composition' || isQueryComposition) {
    const placement = resolveCompositionCreatePlacement({
      queryComposition: isQueryComposition,
      owner,
    })
    return {
      ...base,
      ...placement,
      source: Endge.source.createDefault('composition'),
      sourceVersion: 1,
      meta: isQueryComposition ? setQueryCompositionRole({}, true) : {},
    }
  }

  if (activeType.value === 'store') {
    return {
      ...base,
      source: Endge.source.createDefault('store'),
      sourceVersion: 1,
      meta: {},
    }
  }

  if (activeType.value === 'mock') {
    return {
      ...base,
      contentSource: 'document',
      contentType: 'application/json',
      source: '{}',
      codeRef: null,
      meta: {},
    }
  }

  if (activeType.value === 'type') {
    return {
      ...base,
      schema: {
        identity: id,
        name: displayName,
        isPrimitive: false,
        fields: {},
      },
      source: Endge.source.createDefault('type'),
      sourceVersion: 1,
      isPrimitive: false,
      meta: {},
    }
  }

  if (activeType.value === 'computation') {
    return {
      ...base,
      source: Endge.source.createDefault('computation'),
      sourceVersion: 1,
      contractVersion: 1,
      input: {},
      output: {},
      meta: {},
    }
  }

  if (activeType.value === FilterType.DefaultFilter) {
    return {
      ...base,
      fields: [],
      source: Endge.source.createDefault('filter'),
      sourceVersion: 1,
      meta: {},
    }
  }

  if (activeType.value === 'action') {
    return {
      ...base,
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
    const template = selectedPageTemplateId.value && Number.isFinite(Number(selectedPageTemplateId.value))
      ? Number(selectedPageTemplateId.value)
      : selectedPageTemplateId.value || null
    return {
      ...base,
      routeName: id,
      routePath: `/${id}`,
      template,
      enabled: true,
      areas: [],
      meta: {},
    }
  }

  if (activeType.value === 'page-template') {
    return {
      ...base,
      areas: [],
      preview: { rows: [] },
      meta: {},
    }
  }

  if (activeType.value === 'navigation') {
    return {
      ...base,
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
      locales: {},
      active: true,
    }
  }

  if (activeType.value === 'style') {
    return {
      ...base,
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
    }
  }

  return base
}

function onJsonInput(value: string): void {
  jsonTouched.value = true
  jsonPayload.value = value
}

function onIdentityInput(): void {
  identityTouched.value = true
  identityConflict.value = false
}

async function validateIdentityAvailability(): Promise<boolean> {
  const normalizedIdentity = identity.value.trim()
  if (!normalizedIdentity) { return false }

  const requestId = ++identityValidationRequest
  identityChecking.value = true
  try {
    const available = await Endge.schema.isDocumentIdentityAvailable(documentType.value, normalizedIdentity)
    if (requestId === identityValidationRequest) { identityConflict.value = !available }
    return available
  }
  finally {
    if (requestId === identityValidationRequest) { identityChecking.value = false }
  }
}

function applyFormFields(draft: RDocument): void {
  if (activeOption.value.supportsDescription) { draft.description = description.value.trim() || null }

  if (activeType.value === 'page') {
    const templateId = selectedPageTemplateId.value
    ;(draft as any).templateId = Number.isFinite(Number(templateId)) ? Number(templateId) : templateId
    ;(draft as any).routeName = identity.value.trim()
    ;(draft as any).routePath = `/${identity.value.trim()}`
  }
}

async function onSubmit(): Promise<void> {
  loading.value = true
  try {
    if (createMode.value === 'json') {
      let parsed: Record<string, unknown>
      try {
        const raw = JSON.parse(jsonPayload.value)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error('JSON должен быть объектом') }
        parsed = raw as Record<string, unknown>
      }
      catch (e: any) {
        throw new Error(`Невалидный JSON: ${e?.message ?? String(e)}`)
      }

      const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
      const targetDocumentType = documentType.value
      if (targetDocumentType === 'composition') {
        Object.assign(parsed, resolveCompositionCreatePlacement({
          queryComposition: isQueryComposition,
          owner: compositionOwner.value,
        }))
      }
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

      const createdIdentity = String(parsed.identity ?? '').trim()
      if (!createdIdentity) { throw new Error('В JSON обязательно поле "identity"') }

      await Endge.schema.createDocument({
        documentType: targetDocumentType,
        identity: createdIdentity,
        mode: 'payload',
        payload: parsed,
      })
      EndgeIDE.tabs.openDocument(createdIdentity, targetDocumentType)
      toast.success('Документ создан из JSON', { description: createdIdentity || 'без identity' })
      openModel.value = false
      return
    }

    const id = identity.value.trim()
    if (formError.value) {
      toast.error(formError.value)
      return
    }
    if (!(await validateIdentityAvailability())) { return }

    const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
    const targetDocumentType = documentType.value
    const rootFolderId = isQueryComposition ? getQueryRootFolderId() : null
    if (isQueryComposition && rootFolderId == null) {
      throw new Error('Системная папка запросов не найдена')
    }
    const draft = DocumentDraftFactory.create(targetDocumentType, {
      identity: id,
      name: name.value.trim() || activeOption.value.defaultName,
      folderId: showFolderSelect.value && selectedFolderId.value !== ROOT_FOLDER_VALUE
        ? selectedFolderId.value
        : rootFolderId ?? undefined,
    })
    if (activeType.value === ComponentType.Table) {
      ;(draft as RComponentSFC).source = COMPONENT_TABLE_SFC_DEFAULT_SOURCE
    }
    applyFormFields(draft)
    if (targetDocumentType === 'composition') {
      const placement = resolveCompositionCreatePlacement({
        queryComposition: isQueryComposition,
        owner: compositionOwner.value,
      })
      const compositionDraft = draft as RComposition
      compositionDraft.kind = placement.kind
      compositionDraft.kindIdentity = placement.kindIdentity
    }
    if (isQueryComposition) {
      draft.meta = setQueryCompositionRole(draft.meta, true)
    }

    await Endge.schema.createDocument({
      documentType: targetDocumentType,
      identity: id,
      mode: 'model',
      model: draft,
    })

    EndgeIDE.tabs.openDocument(id, targetDocumentType)
    toast.success('Документ создан', { description: id })
    openModel.value = false
  }
  catch (e: any) {
    if (String(e?.message ?? '').includes('уже существует')) { identityConflict.value = true }
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
    <DialogContent class="max-h-[90vh] overflow-hidden sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>

      <div
        class="grid min-h-0 gap-4 py-2"
        :class="lockedDocumentType ? 'grid-cols-1' : 'grid-cols-[minmax(260px,0.8fr)_minmax(0,1.35fr)]'"
      >
        <!-- Слева: список типов сущностей -->
        <div v-if="!lockedDocumentType" class="flex min-h-0 flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-muted-foreground text-xs">Тип документа</Label>
            <Button
              v-if="createContext?.sectionType"
              type="button"
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="showAllTypes = !showAllTypes"
            >
              {{ showAllTypes ? 'Текущая секция' : 'Все типы' }}
            </Button>
          </div>
          <Input
            id="create-doc-type-search"
            v-model="typeSearch"
            placeholder="Найти тип документа..."
            autocomplete="off"
          />
          <ScrollArea class="h-[500px] rounded-md border p-1">
            <div v-if="filteredTypeGroups.length" class="flex flex-col gap-2">
              <section v-for="group in filteredTypeGroups" :key="group.label">
                <div class="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {{ group.label }}
                </div>
                <button
                  v-for="doc in group.items"
                  :key="doc.type"
                  type="button"
                  class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  :class="activeType === doc.type ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
                  @click="activeType = doc.type"
                >
                  <i
                    :class="EndgeIDE.tabs.getDocumentIcon(
                      doc.type === QUERY_COMPOSITION_CREATE_KIND ? 'composition' : doc.type,
                      doc.type === QUERY_COMPOSITION_CREATE_KIND ? QUERY_COMPOSITION_PRESENTATION_KIND : undefined,
                    )"
                    class="mt-0.5 shrink-0 text-lg"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{ doc.label }}</span>
                    <span class="mt-0.5 line-clamp-2 block text-xs leading-4 text-muted-foreground">{{ doc.description }}</span>
                  </span>
                </button>
              </section>
            </div>
            <div v-else class="px-3 py-8 text-center text-sm text-muted-foreground">
              Подходящие типы не найдены
            </div>
          </ScrollArea>
        </div>

        <!-- Справа: данные для создания -->
        <div class="flex min-h-0 flex-col gap-3">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="flex items-start gap-3">
              <i
                :class="EndgeIDE.tabs.getDocumentIcon(
                  activeType === QUERY_COMPOSITION_CREATE_KIND ? 'composition' : activeType,
                  activeType === QUERY_COMPOSITION_CREATE_KIND ? QUERY_COMPOSITION_PRESENTATION_KIND : undefined,
                )"
                class="mt-0.5 shrink-0 text-xl text-primary"
              />
              <div>
                <div class="font-medium">
                  {{ activeOption.label }}
                </div>
                <div class="mt-1 text-sm leading-5 text-muted-foreground">
                  {{ activeOption.description }}
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="compositionOwner"
            class="rounded-md border bg-muted/35 px-3 py-2 text-xs text-muted-foreground"
          >
            Привязка к проекту:
            <span class="font-medium text-foreground">{{ compositionOwner.displayName || compositionOwner.identity }}</span>
            <span class="ml-1 font-mono">({{ compositionOwner.identity }})</span>
          </div>

          <Tabs v-model="createMode" class="flex min-h-0 flex-1 flex-col">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="form">
                Форма
              </TabsTrigger>
              <TabsTrigger value="json">
                JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" class="m-0 mt-3">
              <div class="space-y-3 rounded-md border p-3">
                <div class="grid gap-2">
                  <Label for="create-doc-name">Название</Label>
                  <Input
                    id="create-doc-name"
                    v-model="name"
                    :placeholder="activeOption.defaultName"
                    @keydown.enter.prevent="onSubmit"
                  />
                </div>
                <div class="grid gap-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label for="create-doc-identity">Identity (id)</Label>
                    <span class="text-xs text-muted-foreground">Уникален в соответствующей коллекции</span>
                  </div>
                  <Input
                    id="create-doc-identity"
                    v-model="identity"
                    placeholder="my-document"
                    :aria-invalid="identityError ? 'true' : undefined"
                    @input="onIdentityInput"
                    @blur="validateIdentityAvailability"
                    @keydown.enter.prevent="onSubmit"
                  />
                  <span v-if="identityChecking" class="text-xs text-muted-foreground">Проверяем identity...</span>
                  <span v-else-if="identityError" class="text-xs text-destructive">{{ identityError }}</span>
                </div>
                <div v-if="showFolderSelect" class="grid gap-2">
                  <Label>Папка</Label>
                  <SearchableSelect
                    v-model="selectedFolderId"
                    :options="folderOptions"
                    placeholder="В корне секции"
                  />
                </div>
                <div v-if="activeType === 'page'" class="grid gap-2">
                  <Label>Шаблон страницы</Label>
                  <SearchableSelect
                    v-model="selectedPageTemplateId"
                    :options="pageTemplateOptions"
                    placeholder="Выберите обязательный шаблон"
                  />
                  <span v-if="!pageTemplateOptions.length" class="text-xs text-destructive">
                    Сначала создайте хотя бы один шаблон страницы
                  </span>
                </div>
                <div v-if="activeOption.supportsDescription" class="grid gap-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label for="create-doc-description">Описание</Label>
                    <span class="text-xs text-muted-foreground">Опционально</span>
                  </div>
                  <Textarea
                    id="create-doc-description"
                    v-model="description"
                    :rows="3"
                    placeholder="Кратко опишите назначение документа"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" class="m-0 mt-3 flex min-h-0 flex-1 flex-col">
              <div class="mb-2 text-xs text-muted-foreground">
                Advanced mode: JSON проходит тот же create-only check. Существующий identity не будет перезаписан.
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
        <Button
          :disabled="loading || identityChecking || (createMode === 'form' && !!formError)"
          @click="onSubmit"
        >
          {{ loading ? 'Создаём...' : 'Создать' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
