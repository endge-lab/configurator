<script setup lang="ts">
import type { DomainDocumentType, RComponentSFC, RComposition, RDocument, RUpdate } from '@endge/core'
import type { CreateDocumentKind, DocumentCreateDescriptor } from '@/features/endge-ide/domain/types/document-create.type'

import { ComponentType, createNewDomainDocument, DomainSectionType, Endge, ENDGE_STYLE_DEFAULT_SOURCE, FilterType, QueryType } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DOCUMENT_AUXILIARY_PRESENTATION } from '@/features/document-presentation/config/document-presentation'
import { getDomainDocumentPresentation } from '@/features/document-presentation/tools/resolve-document-presentation'
import DocumentIcon from '@/features/document-presentation/ui/DocumentIcon.vue'
import {
  COMPONENT_TABLE_SFC_DEFAULT_SOURCE,
  DOCUMENT_CREATE_DESCRIPTORS,
} from '@/features/endge-ide/config/document-create'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { resolveCompositionCreatePlacement } from '@/features/endge-ide/services/domain/composition-create'
import {
  getQueryRootFolderId,
  QUERY_COMPOSITION_CREATE_KIND,
  QUERY_COMPOSITION_PRESENTATION_KIND,
  setQueryCompositionRole,
} from '@/features/endge-ide/services/domain/query-composition-presentation'
import { suggestDocumentIdentity } from '@/features/endge-ide/tools/document-create'
import { SearchableSelect } from '@/features/endge-ide/ui/components/searchable-select'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

const ROOT_IDS: Record<DomainSectionType, string> = {
  [DomainSectionType.Workspace]: 'root-workspaces',
  [DomainSectionType.Component]: 'root-components',
  [DomainSectionType.Query]: 'root-queries',
  [DomainSectionType.DataView]: 'root-data-views',
  [DomainSectionType.Composition]: 'root-compositions',
  [DomainSectionType.Simulation]: 'root-simulations',
  [DomainSectionType.Store]: 'root-stores',
  [DomainSectionType.Mock]: 'root-mocks',
  [DomainSectionType.Type]: 'root-types',
  [DomainSectionType.Primitive]: 'root-primitives',
  [DomainSectionType.Action]: 'root-actions',
  [DomainSectionType.Event]: 'root-events',
  [DomainSectionType.Converter]: 'root-converters',
  [DomainSectionType.Computation]: 'root-computations',
  [DomainSectionType.Integration]: 'root-integrations',
  [DomainSectionType.Filters]: 'root-filters',
  [DomainSectionType.Policy]: 'root-policies',
  [DomainSectionType.Style]: 'root-styles',
  [DomainSectionType.Configuration]: 'root-workspaces',
  [DomainSectionType.PageTemplate]: 'root-page-templates',
  [DomainSectionType.Page]: 'root-pages',
  [DomainSectionType.Navigation]: 'root-navigations',
  [DomainSectionType.Vocabs]: 'root-vocabs',
  [DomainSectionType.I18nBundles]: 'root-i18n-bundles',
  [DomainSectionType.AuthProfile]: 'root-auth-profiles',
}

/** entityType папок в Payload — только папки этой секции показываем в выборе. */
const SECTION_FOLDER_ENTITY_TYPE: Partial<Record<DomainSectionType, string>> = {
  [DomainSectionType.Component]: 'components',
  [DomainSectionType.Query]: 'queries',
  [DomainSectionType.DataView]: 'data-views',
  [DomainSectionType.Composition]: 'compositions',
  [DomainSectionType.Simulation]: 'simulations',
  [DomainSectionType.Store]: 'stores',
  [DomainSectionType.Mock]: 'mocks',
  [DomainSectionType.Type]: 'types',
  [DomainSectionType.Action]: 'actions',
  [DomainSectionType.Converter]: 'converters',
  [DomainSectionType.Computation]: 'computations',
  [DomainSectionType.Integration]: 'integrations',
  [DomainSectionType.Filters]: 'filters',
  [DomainSectionType.Policy]: 'policies',
  [DomainSectionType.Style]: 'styles',
  [DomainSectionType.PageTemplate]: 'page-templates',
  [DomainSectionType.Page]: 'pages',
  [DomainSectionType.Navigation]: 'navigations',
  [DomainSectionType.Vocabs]: 'vocabs',
  [DomainSectionType.I18nBundles]: 'i18n-bundles',
  [DomainSectionType.AuthProfile]: 'auth-profiles',
}

const domainStore = useDomainStore()
const { t } = useI18n()
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
const isWorkspaceSelected = computed(() => activeType.value === 'workspace')
const canCreateWorkspace = computed(() => {
  const state = Configurator.session.state
  return state.status === 'authenticated' && state.session.platformAdmin
})
const hasSupportedSelection = computed(() => {
  const descriptor = DOCUMENT_CREATE_DESCRIPTORS.find(item => item.type === activeType.value)
  if (!descriptor) {
    return false
  }
  if (lockedDocumentType.value) {
    return descriptor.type === lockedDocumentType.value
      && (descriptor.type !== 'workspace' || canCreateWorkspace.value)
  }
  if (descriptor.type === 'workspace') {
    return canCreateWorkspace.value && !createContext.value?.sectionType
  }
  return !createContext.value?.sectionType || showAllTypes.value
    || descriptor.section === createContext.value.sectionType
})
const updateOwnerStoreIdentity = computed(() =>
  activeType.value === 'update' ? createContext.value?.updateOwnerStoreIdentity ?? null : null,
)
const dialogTitle = computed(() => isWorkspaceSelected.value
  ? t('workspaceTree.create')
  : lockedDocumentType.value === 'composition' ? 'Создать композицию' : 'Создать документ')
const documentType = computed<DomainDocumentType>(() =>
  activeType.value === QUERY_COMPOSITION_CREATE_KIND
    ? 'composition'
    : activeType.value === ComponentType.Table
      ? COMPONENT_SFC_TYPE
      : activeType.value as DomainDocumentType,
)

const filteredTypes = computed(() => {
  const contextualSection = createContext.value?.sectionType ?? null
  const query = typeSearch.value.trim().toLowerCase()
  return DOCUMENT_CREATE_DESCRIPTORS.filter((descriptor) => {
    if (descriptor.type === 'workspace' && (!canCreateWorkspace.value || contextualSection)) {
      return false
    }
    if (descriptor.type === 'update' && !createContext.value?.updateOwnerStoreIdentity) {
      return false
    }
    if (contextualSection && !showAllTypes.value && descriptor.section !== contextualSection) {
      return false
    }
    if (!query) {
      return true
    }
    return [descriptor.label, descriptor.description, descriptor.type, ...descriptor.keywords]
      .some(value => String(value).toLowerCase().includes(query))
  })
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
  if (!identity.value.trim()) {
    return isWorkspaceSelected.value ? t('workspaceTree.identityRequired') : 'Identity обязателен'
  }
  if (identityConflict.value) {
    return isWorkspaceSelected.value
      ? t('workspaceTree.identityConflict')
      : `Документ «${identity.value.trim()}» уже существует`
  }
  return null
})

const formError = computed(() => {
  if (identityError.value) {
    return identityError.value
  }
  if (isWorkspaceSelected.value && !name.value.trim()) {
    return t('workspaceTree.displayNameRequired')
  }
  if (activeType.value === 'page' && !selectedPageTemplateId.value) {
    return 'Для страницы выберите шаблон'
  }
  return null
})

/** Показывать выбор папки для секций, которые поддерживают folder placement. */
const showFolderSelect = computed(() => activeOption.value.supportsFolder)

/** Папки только текущей секции (по entityType): корень + вложенные под этим root. */
const folderOptions = computed(() => {
  if (!showFolderSelect.value) {
    return []
  }
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
      if (p == null) {
        continue
      }
      if (String(p) !== String(parentId)) {
        continue
      }
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
    activeType.value = ComponentType.SFC
    const ctx = EndgeIDE.modals.createDocumentContext?.value ?? null
    if (ctx?.documentType != null) {
      const requestedType = DOCUMENT_CREATE_DESCRIPTORS.find(d => d.type === ctx.documentType)
      if (requestedType) {
        activeType.value = requestedType.type
      }
      selectedFolderId.value = ctx.folderId != null ? String(ctx.folderId) : ROOT_FOLDER_VALUE
    }
    else if (ctx?.sectionType != null) {
      const firstOfSection = DOCUMENT_CREATE_DESCRIPTORS.find(d => d.section === ctx.sectionType)
      if (firstOfSection) {
        activeType.value = firstOfSection.type
      }
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
  if (!valid) {
    selectedFolderId.value = ROOT_FOLDER_VALUE
  }
  identityConflict.value = false
  jsonTouched.value = false
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

watch(name, (value) => {
  if (!identityTouched.value) {
    identity.value = suggestDocumentIdentity(value)
  }
})

watch([identity, name, description, selectedFolderId, selectedPageTemplateId], () => {
  identityConflict.value = false
  if (jsonTouched.value) {
    return
  }
  jsonPayload.value = JSON.stringify(buildPayloadTemplate(), null, 2)
})

function buildPayloadTemplate(): Record<string, unknown> {
  const id = identity.value.trim() || 'new-doc'
  const displayName = name.value.trim() || id
  const normalizedDescription = description.value.trim() || null
  const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
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

  if (activeType.value === QueryType.REST || activeType.value === QueryType.GraphQL) {
    return {
      ...base,
      type: activeType.value,
      source: Endge.source.createDefault('query', activeType.value === QueryType.GraphQL ? 'graphql' : 'rest'),
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

  if (activeType.value === 'stream') {
    return {
      ...base,
      source: Endge.source.createDefault('stream'),
      sourceVersion: 1,
      meta: {},
    }
  }

  if (activeType.value === 'simulation') {
    return {
      ...base,
      source: Endge.source.createDefault('simulation'),
      sourceVersion: 1,
      meta: {},
    }
  }

  if (activeType.value === 'update') {
    const owner = updateOwnerStoreIdentity.value
      ? Endge.domain.getStore(updateOwnerStoreIdentity.value)
      : null
    return {
      ...base,
      store: owner?.id ?? null,
      source: Endge.source.createDefault('update'),
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
  if (!normalizedIdentity) {
    return false
  }
  if (isWorkspaceSelected.value) {
    return true
  }

  const requestId = ++identityValidationRequest
  identityChecking.value = true
  try {
    const available = await Endge.domainRepository.isDocumentIdentityAvailable(documentType.value, normalizedIdentity)
    if (requestId === identityValidationRequest) {
      identityConflict.value = !available
    }
    return available
  }
  finally {
    if (requestId === identityValidationRequest) {
      identityChecking.value = false
    }
  }
}

function applyFormFields(draft: RDocument): void {
  if (activeOption.value.supportsDescription) {
    draft.description = description.value.trim() || null
  }

  if (activeType.value === 'page') {
    const templateId = selectedPageTemplateId.value
    ;(draft as any).templateId = Number.isFinite(Number(templateId)) ? Number(templateId) : templateId
    ;(draft as any).routeName = identity.value.trim()
    ;(draft as any).routePath = `/${identity.value.trim()}`
  }
}

async function onSubmit(): Promise<void> {
  if (loading.value) {
    return
  }
  if (!hasSupportedSelection.value) {
    toast.error(t('documentCreate.unsupportedType'))
    return
  }
  loading.value = true
  try {
    if (isWorkspaceSelected.value) {
      if (formError.value) {
        toast.error(formError.value)
        return
      }
      const refreshed = await Configurator.createWorkspace({
        identity: identity.value.trim(),
        displayName: name.value.trim(),
        description: description.value.trim(),
      })
      toast.success(t('workspaceTree.created'), { description: name.value.trim() })
      if (!refreshed) {
        toast.warning(t('workspaceTree.refreshFailed'))
      }
      openModel.value = false
      return
    }

    if (createMode.value === 'json') {
      let parsed: Record<string, unknown>
      try {
        const raw = JSON.parse(jsonPayload.value)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('JSON должен быть объектом')
        }
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
      if (targetDocumentType === 'update') {
        const owner = updateOwnerStoreIdentity.value
          ? Endge.domain.getStore(updateOwnerStoreIdentity.value)
          : null
        if (!owner) {
          throw new Error('Update можно создать только из контекстного меню существующего Store.')
        }
        parsed.storeIdentity = owner.identity
      }
      const workspaceFolderId = createContext.value?.workspaceFolderId
      if (workspaceFolderId != null) {
        const workspaceFolder = Endge.domain.getFolder(workspaceFolderId)
        parsed.workspaceFolderIdentity = String(workspaceFolder?.identity ?? workspaceFolderId)
      }

      const createdIdentity = String(parsed.identity ?? '').trim()
      if (!createdIdentity) {
        throw new Error('В JSON обязательно поле "identity"')
      }

      await Endge.domainRepository.createDocument({
        documentType: targetDocumentType,
        identity: createdIdentity,
        mode: 'portable',
        document: parsed,
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
    if (!(await validateIdentityAvailability())) {
      return
    }

    const isQueryComposition = activeType.value === QUERY_COMPOSITION_CREATE_KIND
    const targetDocumentType = documentType.value
    const rootFolderId = isQueryComposition ? getQueryRootFolderId() : null
    if (isQueryComposition && rootFolderId == null) {
      throw new Error('Системная папка запросов не найдена')
    }
    const draft = createNewDomainDocument(targetDocumentType, {
      identity: id,
      name: name.value.trim() || activeOption.value.defaultName,
      folderId: showFolderSelect.value && selectedFolderId.value !== ROOT_FOLDER_VALUE
        ? selectedFolderId.value
        : rootFolderId ?? undefined,
    })
    if (createContext.value?.workspaceFolderId != null) {
      draft.workspaceFolderId = createContext.value.workspaceFolderId
    }
    if (activeType.value === ComponentType.Table) {
      ;(draft as RComponentSFC).source = COMPONENT_TABLE_SFC_DEFAULT_SOURCE
    }
    applyFormFields(draft)
    if (targetDocumentType === 'composition') {
      const placement = resolveCompositionCreatePlacement({
        queryComposition: isQueryComposition,
      })
      const compositionDraft = draft as RComposition
      compositionDraft.kind = placement.kind
      compositionDraft.kindIdentity = placement.kindIdentity
    }
    if (targetDocumentType === 'update') {
      if (!updateOwnerStoreIdentity.value) {
        throw new Error('Update можно создать только из контекстного меню Store.')
      }
      (draft as RUpdate).storeIdentity = updateOwnerStoreIdentity.value
    }
    if (isQueryComposition) {
      draft.meta = setQueryCompositionRole(draft.meta, true)
    }

    await Endge.domainRepository.createDocument({
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
    if (isWorkspaceSelected.value) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'workspace_identity_conflict') {
        identityConflict.value = true
      }
      toast.error(code === 'workspace_identity_conflict'
        ? t('workspaceTree.identityConflict')
        : code === 'workspace_creation_forbidden'
          ? t('workspaceTree.creationForbidden')
          : t('workspaceTree.createFailed'))
      return
    }
    if (String(e?.message ?? '').includes('уже существует')) {
      identityConflict.value = true
    }
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
            <Label class="text-muted-foreground text-xs">{{ $t('uiText.documentTypefcf0e9cc') }}</Label>
            <Button
              v-if="createContext?.sectionType"
              type="button"
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="showAllTypes = !showAllTypes"
            >
              {{ showAllTypes ? $t('uiText.currentSectioncaa26d5c') : $t('uiText.allTypesc21a23a5') }}
            </Button>
          </div>
          <Input
            id="create-doc-type-search"
            v-model="typeSearch"
            placeholder="Найти тип документа..."
            autocomplete="off"
          />
          <ScrollArea class="h-[500px] rounded-md border p-1">
            <div v-if="filteredTypes.length" class="flex flex-col gap-0.5">
              <button
                v-for="doc in filteredTypes"
                :key="doc.type"
                type="button"
                class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60"
                :class="activeType === doc.type ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
                @click="activeType = doc.type"
              >
                <DocumentIcon
                  :presentation="doc.type === 'workspace'
                    ? DOCUMENT_AUXILIARY_PRESENTATION.workspace
                    : getDomainDocumentPresentation(
                      doc.type === QUERY_COMPOSITION_CREATE_KIND ? 'composition' : doc.type,
                      doc.type === QUERY_COMPOSITION_CREATE_KIND ? QUERY_COMPOSITION_PRESENTATION_KIND : undefined,
                    )"
                  size="picker"
                />
                <span class="min-w-0 truncate text-sm font-medium">{{ doc.label }}</span>
              </button>
            </div>
            <div v-else class="px-3 py-8 text-center text-sm text-muted-foreground">
              {{ $t('uiText.noMatchingTypesFound8929cdab') }}
            </div>
          </ScrollArea>
        </div>

        <!-- Справа: данные для создания -->
        <div v-if="hasSupportedSelection" class="flex min-h-0 flex-col gap-3">
          <div v-if="isWorkspaceSelected" class="space-y-3 rounded-md border p-3">
            <div class="grid gap-2">
              <Label for="create-workspace-name">{{ t('workspaceTree.displayName') }}</Label>
              <Input
                id="create-workspace-name"
                v-model="name"
                :disabled="loading"
                @keydown.enter.prevent="onSubmit"
              />
            </div>
            <div class="grid gap-2">
              <Label for="create-workspace-identity">{{ t('workspaceTree.identity') }}</Label>
              <Input
                id="create-workspace-identity"
                v-model="identity"
                :disabled="loading"
                :maxlength="160"
                :aria-invalid="identityError ? 'true' : undefined"
                @input="onIdentityInput"
                @keydown.enter.prevent="onSubmit"
              />
              <span v-if="identityError" class="text-xs text-destructive">{{ identityError }}</span>
            </div>
            <div class="grid gap-2">
              <Label for="create-workspace-description">{{ t('workspaceTree.description') }}</Label>
              <Textarea
                id="create-workspace-description"
                v-model="description"
                :disabled="loading"
                :rows="3"
              />
            </div>
          </div>

          <Tabs v-else v-model="createMode" class="flex min-h-0 flex-1 flex-col">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="form">
                {{ $t('uiText.form22af8f93') }}
              </TabsTrigger>
              <TabsTrigger value="json">
                {{ $t('uiText.json031a4e76') }}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" class="m-0 mt-3">
              <div class="space-y-3 rounded-md border p-3">
                <div class="grid gap-2">
                  <Label for="create-doc-name">{{ $t('uiText.name3de49828') }}</Label>
                  <Input
                    id="create-doc-name"
                    v-model="name"
                    :placeholder="activeOption.defaultName"
                    @keydown.enter.prevent="onSubmit"
                  />
                </div>
                <div class="grid gap-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label for="create-doc-identity">{{ $t('uiText.identityId58fa481e') }}</Label>
                    <span class="text-xs text-muted-foreground">{{ $t('uiText.uniqueInTheCorrespondingCollection027f038c') }}</span>
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
                  <span v-if="identityChecking" class="text-xs text-muted-foreground">{{ $t('uiText.checkingIdentitybccbcfd8') }}</span>
                  <span v-else-if="identityError" class="text-xs text-destructive">{{ identityError }}</span>
                </div>
                <div v-if="showFolderSelect" class="grid gap-2">
                  <Label>{{ $t('uiText.folderbc5431b5') }}</Label>
                  <SearchableSelect
                    v-model="selectedFolderId"
                    :options="folderOptions"
                    placeholder="В корне секции"
                  />
                </div>
                <div v-if="activeType === 'page'" class="grid gap-2">
                  <Label>{{ $t('uiText.pageTemplatebb1e6489') }}</Label>
                  <SearchableSelect
                    v-model="selectedPageTemplateId"
                    :options="pageTemplateOptions"
                    placeholder="Выберите обязательный шаблон"
                  />
                  <span v-if="!pageTemplateOptions.length" class="text-xs text-destructive">
                    {{ $t('uiText.createAtLeastOnePageTemplateFirstfda7f1e1') }}
                  </span>
                </div>
                <div v-if="activeOption.supportsDescription" class="grid gap-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label for="create-doc-description">{{ $t('uiText.descriptionF5441f6a') }}</Label>
                    <span class="text-xs text-muted-foreground">{{ $t('uiText.optional0bdb6517') }}</span>
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
                {{ $t('uiText.advancedModeJSONUndergoesTheSameCreateOnlyCheckExist79188b4c') }}
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
        <p v-else role="alert" class="text-sm text-muted-foreground">
          {{ t('documentCreate.unsupportedType') }}
        </p>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="loading" @click="onCancel">
          {{ $t('uiText.cancel555ad1c0') }}
        </Button>
        <Button
          :disabled="!hasSupportedSelection || loading || identityChecking || ((isWorkspaceSelected || createMode === 'form') && !!formError)"
          @click="onSubmit"
        >
          {{ loading ? $t('uiText.creating573e3eda') : $t('uiText.create84370a20') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
