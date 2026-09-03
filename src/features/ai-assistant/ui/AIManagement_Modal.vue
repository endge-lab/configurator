<script setup lang="ts">
import type { AIAdapter, AIModelProfile, AIProviderConnection, AIVisibility } from '@/features/ai-assistant/domain/types'

import { Bot, Check, ChevronDown, ChevronRight, Globe2, KeyRound, Loader2, LockKeyhole, Pencil, Plus, Server, Sparkles, Star, Trash2, TriangleAlert, UserRound, X } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'

import { Configurator } from '@/app/Configurator'
import { AIWorkbench } from '@/features/ai-assistant'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'

interface AdapterPresentation {
  label: string
  endpointPlaceholder: string
}

type VisibilityFilter = 'all' | 'public' | 'mine'

const visibilityFilters: ReadonlyArray<{
  value: VisibilityFilter
  label: string
}> = [
  { value: 'all', label: 'Все' },
  { value: 'public', label: 'Для всех' },
  { value: 'mine', label: 'Мои' },
]

const adapterPresentation: Record<AIAdapter, AdapterPresentation> = {
  anthropic: {
    label: 'Anthropic',
    endpointPlaceholder: 'https://api.anthropic.com (необязательно)',
  },
  ollama: {
    label: 'Ollama',
    endpointPlaceholder: 'http://host.docker.internal:11434',
  },
}

const openState = computed({
  get: () => AIWorkbench.state.managementOpen,
  set: (value: boolean) => (value ? AIWorkbench.openManagement() : AIWorkbench.closeManagement()),
})
const loading = ref(false)
const error = ref('')
const connections = ref<AIProviderConnection[]>([])
const models = ref<AIModelProfile[]>([])
const adapters = ref<AIAdapter[]>([])
const visibilityFilter = ref<VisibilityFilter>('all')
const isPlatformAdmin = computed(() => Configurator.session.state.status === 'authenticated' && Configurator.session.state.session.platformAdmin)

const showConnectionForm = ref(false)
const connectionForm = reactive({
  name: '',
  adapter: '' as AIAdapter | '',
  baseUrl: '',
  credential: '',
  visibility: 'private' as AIVisibility,
  enabled: true,
})
const initialModelForm = reactive({
  providerModelId: '',
  displayName: '',
  enabled: true,
  isDefault: false,
})
const collapsedConnectionIds = ref<Set<string>>(new Set())
const editingConnectionId = ref('')
const connectionEditForm = reactive({ name: '', baseUrl: '' })
const credentialValue = ref('')
const creatingModelConnectionId = ref('')
const modelForm = reactive({
  providerModelId: '',
  displayName: '',
  enabled: true,
  isDefault: false,
})
const editingModelId = ref('')
const modelEditForm = reactive({ providerModelId: '', displayName: '' })

const showVisibilityFilter = computed(() => connections.value.length >= 5)
const filteredConnections = computed(() => {
  if (visibilityFilter.value === 'public') {
    return connections.value.filter(connection => connection.visibility === 'public')
  }
  if (visibilityFilter.value === 'mine') {
    return connections.value.filter(connection => connection.ownedByMe)
  }
  return connections.value
})
const canCreateConnection = computed(() => {
  if (!connectionForm.adapter || !connectionForm.name.trim() || !initialModelForm.providerModelId.trim() || !initialModelForm.displayName.trim()) {
    return false
  }
  return connectionForm.adapter === 'anthropic' ? Boolean(connectionForm.credential.trim()) : Boolean(connectionForm.baseUrl.trim())
})

async function open(): Promise<void> {
  await AIWorkbench.init(Configurator.context.backendConfig!.serviceBackendURL, Configurator.context.workspaceIdentity)
  AIWorkbench.openManagement()
}

watch(
  () => AIWorkbench.state.managementOpen,
  (visible) => {
    if (visible) {
      void reload()
    }
    else {
      resetTransientState()
    }
  },
)

async function reload(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [adapterPage, connectionPage, modelPage] = await Promise.all([AIWorkbench.listProviderAdapters(), AIWorkbench.listProviderConnections(), AIWorkbench.listModelProfiles()])
    adapters.value = adapterPage.items
    connections.value = connectionPage.items
    models.value = modelPage.items
  }
  catch (cause) {
    error.value = messageOf(cause)
  }
  finally {
    loading.value = false
  }
}

function resetTransientState(): void {
  cancelConnectionCreate()
  cancelConnectionEdit()
  cancelModelCreate()
  editingModelId.value = ''
}

function beginConnectionCreate(): void {
  resetConnectionCreateForms()
  connectionForm.visibility = isPlatformAdmin.value ? 'public' : 'private'
  showConnectionForm.value = true
}

function selectConnectionAdapter(adapter: AIAdapter): void {
  Object.assign(connectionForm, { adapter, baseUrl: '', credential: '' })
}

function cancelConnectionCreate(): void {
  showConnectionForm.value = false
  resetConnectionCreateForms()
}

function resetConnectionCreateForms(): void {
  Object.assign(connectionForm, {
    name: '',
    adapter: '',
    baseUrl: '',
    credential: '',
    visibility: 'private',
    enabled: true,
  })
  Object.assign(initialModelForm, {
    providerModelId: '',
    displayName: '',
    enabled: true,
    isDefault: false,
  })
}

async function createConnection(): Promise<void> {
  const adapter = connectionForm.adapter
  if (!adapter || !canCreateConnection.value) {
    return
  }
  const visibility = isPlatformAdmin.value ? connectionForm.visibility : 'private'
  const succeeded = await act(() =>
    AIWorkbench.createProviderConnectionWithModel({
      name: connectionForm.name.trim(),
      adapter,
      baseUrl: connectionForm.baseUrl.trim(),
      credential: connectionForm.credential.trim(),
      visibility,
      enabled: connectionForm.enabled,
      model: {
        providerModelId: initialModelForm.providerModelId.trim(),
        displayName: initialModelForm.displayName.trim(),
        enabled: initialModelForm.enabled,
        isDefault: visibility === 'public' && initialModelForm.isDefault,
      },
    }),
  )
  if (succeeded) {
    cancelConnectionCreate()
  }
}

function modelsForConnection(connectionId: string): AIModelProfile[] {
  return models.value.filter(model => model.connectionId === connectionId)
}

function isExpanded(connectionId: string): boolean {
  return !collapsedConnectionIds.value.has(connectionId)
}

function toggleExpanded(connectionId: string): void {
  const next = new Set(collapsedConnectionIds.value)
  if (next.has(connectionId)) {
    next.delete(connectionId)
  }
  else {
    next.add(connectionId)
  }
  collapsedConnectionIds.value = next
}

function expandConnection(connectionId: string): void {
  if (!collapsedConnectionIds.value.has(connectionId)) {
    return
  }
  const next = new Set(collapsedConnectionIds.value)
  next.delete(connectionId)
  collapsedConnectionIds.value = next
}

function beginConnectionEdit(connection: AIProviderConnection): void {
  if (!connection.canManage) {
    return
  }
  expandConnection(connection.id)
  editingConnectionId.value = connection.id
  credentialValue.value = ''
  Object.assign(connectionEditForm, {
    name: connection.name,
    baseUrl: connection.baseUrl,
  })
}

function cancelConnectionEdit(): void {
  editingConnectionId.value = ''
  credentialValue.value = ''
  Object.assign(connectionEditForm, { name: '', baseUrl: '' })
}

function canSaveConnection(connection: AIProviderConnection): boolean {
  return Boolean(connectionEditForm.name.trim()) && (connection.adapter !== 'ollama' || Boolean(connectionEditForm.baseUrl.trim()))
}

async function saveConnection(connection: AIProviderConnection): Promise<void> {
  if (!canSaveConnection(connection)) {
    return
  }
  if (
    await act(() =>
      AIWorkbench.updateProviderConnection(connection.id, {
        name: connectionEditForm.name.trim(),
        baseUrl: connectionEditForm.baseUrl.trim(),
      }),
    )
  ) {
    cancelConnectionEdit()
  }
}

async function toggleConnection(connection: AIProviderConnection): Promise<void> {
  if (connection.canManage) {
    await act(() =>
      AIWorkbench.updateProviderConnection(connection.id, {
        enabled: !connection.enabled,
      }),
    )
  }
}

async function saveCredential(connection: AIProviderConnection): Promise<void> {
  if (credentialValue.value.trim() && (await act(() => AIWorkbench.replaceProviderCredential(connection.id, credentialValue.value.trim())))) {
    credentialValue.value = ''
  }
}

async function deleteConnection(connection: AIProviderConnection): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить подключение?',
    text: connection.name,
    description: `Будут безвозвратно удалены credential и ${modelCountLabel(connection.modelCount)}. История диалогов сохранится только для чтения.`,
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Удалить', variant: 'destructive' },
    ],
  })
  if (confirmed && (await act(() => AIWorkbench.deleteProviderConnection(connection.id)))) {
    if (editingConnectionId.value === connection.id) {
      cancelConnectionEdit()
    }
    if (creatingModelConnectionId.value === connection.id) {
      cancelModelCreate()
    }
  }
}

function beginModelCreate(connection: AIProviderConnection): void {
  if (!connection.canManage) {
    return
  }
  expandConnection(connection.id)
  editingModelId.value = ''
  creatingModelConnectionId.value = connection.id
  Object.assign(modelForm, {
    providerModelId: '',
    displayName: '',
    enabled: true,
    isDefault: false,
  })
}

function cancelModelCreate(): void {
  creatingModelConnectionId.value = ''
  Object.assign(modelForm, {
    providerModelId: '',
    displayName: '',
    enabled: true,
    isDefault: false,
  })
}

async function createModel(connection: AIProviderConnection): Promise<void> {
  if (!modelForm.providerModelId.trim() || !modelForm.displayName.trim()) {
    return
  }
  if (
    await act(() =>
      AIWorkbench.createModelProfile({
        connectionId: connection.id,
        providerModelId: modelForm.providerModelId.trim(),
        displayName: modelForm.displayName.trim(),
        enabled: modelForm.enabled,
        isDefault: connection.visibility === 'public' && modelForm.isDefault,
      }),
    )
  ) {
    cancelModelCreate()
  }
}

async function toggleModel(model: AIModelProfile): Promise<void> {
  if (model.canManage) {
    await act(() => AIWorkbench.updateModelProfile(model.id, { enabled: !model.enabled }))
  }
}

function beginModelEdit(model: AIModelProfile): void {
  if (!model.canManage) {
    return
  }
  cancelModelCreate()
  editingModelId.value = model.id
  Object.assign(modelEditForm, {
    providerModelId: model.providerModelId,
    displayName: model.displayName,
  })
}

async function saveModel(model: AIModelProfile): Promise<void> {
  const providerModelId = modelEditForm.providerModelId.trim()
  const displayName = modelEditForm.displayName.trim()
  if (
    providerModelId
    && displayName
    && (await act(() =>
      AIWorkbench.updateModelProfile(model.id, {
        providerModelId,
        displayName,
      }),
    ))
  ) {
    editingModelId.value = ''
  }
}

async function makeDefault(model: AIModelProfile): Promise<void> {
  if (model.canManage && model.visibility === 'public') {
    await act(() => AIWorkbench.updateModelProfile(model.id, { isDefault: !model.isDefault }))
  }
}

async function deleteModel(model: AIModelProfile): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить профиль модели?',
    text: model.displayName,
    description: 'Диалоги с этой моделью сохранят историю, но новые сообщения в них будут запрещены.',
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Удалить', variant: 'destructive' },
    ],
  })
  if (confirmed) {
    await act(() => AIWorkbench.deleteModelProfile(model.id))
  }
}

async function act(operation: () => Promise<unknown>): Promise<boolean> {
  loading.value = true
  error.value = ''
  try {
    await operation()
    await reload()
    return true
  }
  catch (cause) {
    error.value = messageOf(cause)
    return false
  }
  finally {
    loading.value = false
  }
}

function modelCountLabel(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} моделей`
  }
  if (last === 1) {
    return `${count} модель`
  }
  if (last >= 2 && last <= 4) {
    return `${count} модели`
  }
  return `${count} моделей`
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : 'Не удалось выполнить запрос'
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-6xl">
      <DialogHeader class="border-b px-6 py-5">
        <DialogTitle class="flex items-center gap-3">
          <span class="flex size-9 items-center justify-center rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10">
            <Bot class="size-4 text-fuchsia-500" />
          </span>
          <span class="text-base">{{ $t('uiText.aiConnections096c1ab8') }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <div v-if="error" class="mb-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert class="size-4 shrink-0" /> {{ error }}
        </div>

        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div v-if="showVisibilityFilter" class="flex rounded-lg bg-muted p-1 text-xs">
            <button
              v-for="filter in visibilityFilters"
              :key="filter.value"
              class="rounded-md px-3 py-1.5 transition-colors"
              :class="visibilityFilter === filter.value ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="visibilityFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
          <span v-else />
          <Button
            size="sm"
            :variant="showConnectionForm ? 'outline' : 'default'"
            :disabled="loading || !adapters.length"
            @click="showConnectionForm ? cancelConnectionCreate() : beginConnectionCreate()"
          >
            <X v-if="showConnectionForm" class="size-4" />
            <Plus v-else class="size-4" />
            {{ showConnectionForm ? $t('uiText.cancel0ec753be') : $t('uiText.add559a87f7') }}
          </Button>
        </div>

        <div class="overflow-hidden rounded-xl border bg-card">
          <form v-if="showConnectionForm" class="border-b bg-muted/20 p-3" @submit.prevent="createConnection">
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(130px,0.65fr)_minmax(130px,0.8fr)_minmax(190px,1.2fr)_minmax(160px,1fr)_auto]">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button type="button" variant="outline" class="min-w-0 justify-between px-3 font-normal">
                    <span class="flex min-w-0 items-center gap-2">
                      <Sparkles v-if="connectionForm.adapter === 'anthropic'" class="size-3.5 shrink-0 text-fuchsia-500" />
                      <Server v-else-if="connectionForm.adapter === 'ollama'" class="size-3.5 shrink-0 text-sky-500" />
                      <span class="truncate">{{ connectionForm.adapter ? adapterPresentation[connectionForm.adapter].label : $t('uiText.typeD25691ca') }}</span>
                    </span>
                    <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-48">
                  <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
                    {{ $t('uiText.connectionType4d717346') }}
                  </DropdownMenuLabel>
                  <DropdownMenuItem v-for="adapter in adapters" :key="adapter" class="gap-2" @select="selectConnectionAdapter(adapter)">
                    <Sparkles v-if="adapter === 'anthropic'" class="size-3.5 text-fuchsia-500" />
                    <Server v-else class="size-3.5 text-sky-500" />
                    {{ adapterPresentation[adapter].label }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Input v-model="connectionForm.name" placeholder="Название подключения" autocomplete="off" />
              <Input
                v-model="connectionForm.baseUrl"
                :disabled="!connectionForm.adapter"
                :placeholder="connectionForm.adapter ? adapterPresentation[connectionForm.adapter].endpointPlaceholder : 'Адрес сервера'"
                inputmode="url"
              />
              <Input
                v-model="connectionForm.credential"
                type="password"
                autocomplete="new-password"
                :disabled="!connectionForm.adapter"
                :placeholder="connectionForm.adapter === 'anthropic' ? 'API key' : 'API key (необязательно)'"
              />
              <label
                v-if="isPlatformAdmin"
                class="flex items-center justify-end gap-2 whitespace-nowrap px-1 text-[11px] text-muted-foreground"
                title="Сделать подключение доступным всем пользователям"
              >
                <Globe2 v-if="connectionForm.visibility === 'public'" class="size-3.5" />
                <LockKeyhole v-else class="size-3.5" />
                {{ connectionForm.visibility === 'public' ? $t('uiText.forAllbbaeed56') : $t('uiText.onlyMee9c5e628') }}
                <Switch :checked="connectionForm.visibility === 'public'" @update:checked="connectionForm.visibility = $event ? 'public' : 'private'" />
              </label>
              <span v-else class="flex items-center justify-end gap-1.5 px-1 text-[11px] text-muted-foreground"><LockKeyhole class="size-3.5" /> {{ $t('uiText.onlyMee9c5e628') }}</span>
            </div>

            <div class="mt-2 grid gap-2 border-l-2 border-muted-foreground/20 pl-4 sm:grid-cols-2 lg:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_auto_auto]">
              <Input v-model="initialModelForm.providerModelId" placeholder="ID первой модели" autocomplete="off" />
              <Input v-model="initialModelForm.displayName" placeholder="Название модели" autocomplete="off" />
              <div class="flex items-center justify-end">
                <Button
                  v-if="connectionForm.visibility === 'public'"
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="size-8"
                  :class="initialModelForm.isDefault && 'text-amber-500'"
                  :title="initialModelForm.isDefault ? 'Снять модель по умолчанию' : 'Назначить модель по умолчанию'"
                  @click="initialModelForm.isDefault = !initialModelForm.isDefault"
                >
                  <Star class="size-4" :class="initialModelForm.isDefault && 'fill-current'" />
                </Button>
              </div>
              <div class="flex items-center justify-end gap-1">
                <Button type="button" size="icon" variant="ghost" class="size-9" title="Отменить" @click="cancelConnectionCreate">
                  <X class="size-4" />
                </Button>
                <Button type="submit" size="sm" class="h-9" :disabled="loading || !canCreateConnection">
                  <Loader2 v-if="loading" class="size-4 animate-spin" /><Check v-else class="size-4" />
                  {{ $t('uiText.create84370a20') }}
                </Button>
              </div>
            </div>
          </form>

          <div v-for="connection in filteredConnections" :key="connection.id" class="border-b last:border-b-0">
            <div class="group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/35">
              <Button size="icon" variant="ghost" class="size-8 shrink-0" :title="isExpanded(connection.id) ? 'Свернуть' : 'Развернуть'" @click="toggleExpanded(connection.id)">
                <ChevronDown v-if="isExpanded(connection.id)" class="size-4 text-muted-foreground" /><ChevronRight v-else class="size-4 text-muted-foreground" />
              </Button>
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-lg border"
                :class="connection.adapter === 'anthropic' ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-500' : 'border-sky-500/20 bg-sky-500/10 text-sky-500'"
              >
                <Sparkles v-if="connection.adapter === 'anthropic'" class="size-3.5" /><Server v-else class="size-3.5" />
              </span>
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span class="truncate text-sm font-medium">{{ connection.name }}</span>
                <span class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {{ adapterPresentation[connection.adapter].label }}
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Globe2 v-if="connection.visibility === 'public'" class="size-3" />
                  <UserRound v-else class="size-3" />
                  {{ connection.visibility === 'public' ? $t('uiText.shared4df903fa') : $t('uiText.mycd6a9f64') }}
                </span>
              </div>
              <Switch
                :checked="connection.enabled"
                :disabled="loading || !connection.canManage"
                :aria-label="connection.enabled ? 'Отключить подключение' : 'Включить подключение'"
                :title="connection.enabled ? 'Отключить подключение' : 'Включить подключение'"
                @update:checked="toggleConnection(connection)"
              />
              <Button v-if="connection.canManage" size="icon" variant="ghost" class="size-8" title="Редактировать подключение" @click="beginConnectionEdit(connection)">
                <Pencil class="size-3.5" />
              </Button>
              <Button
                v-if="connection.canManage"
                size="icon"
                variant="ghost"
                class="size-8 text-destructive hover:text-destructive"
                title="Удалить подключение"
                @click="deleteConnection(connection)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>

            <div
              v-if="editingConnectionId === connection.id"
              class="grid gap-2 border-t bg-muted/15 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(170px,1fr)_minmax(220px,1.3fr)_auto]"
            >
              <Input v-model="connectionEditForm.name" aria-label="Название подключения" />
              <Input v-model="connectionEditForm.baseUrl" :placeholder="adapterPresentation[connection.adapter].endpointPlaceholder" />
              <div class="flex justify-end gap-1">
                <Button size="sm" variant="ghost" @click="cancelConnectionEdit">
                  {{ $t('uiText.cancel0ec753be') }}
                </Button><Button size="sm" :disabled="loading || !canSaveConnection(connection)" @click="saveConnection(connection)">
                  {{ $t('uiText.save4864057d') }}
                </Button>
              </div>
              <div class="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
                <KeyRound class="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  v-model="credentialValue"
                  class="max-w-md"
                  type="password"
                  autocomplete="new-password"
                  :placeholder="connection.adapter === 'anthropic' ? 'Новый API key' : 'Новый API key (необязательно)'"
                />
                <Button size="sm" variant="outline" :disabled="loading || !credentialValue.trim()" @click="saveCredential(connection)">
                  {{ $t('uiText.replaceKey7343ba0e') }}
                </Button>
              </div>
            </div>

            <div v-if="isExpanded(connection.id)" class="border-t bg-muted/10">
              <div v-for="model in modelsForConnection(connection.id)" :key="model.id" class="border-b border-dashed px-4 py-2.5 last:border-b-0">
                <div class="flex items-center gap-2 pl-10">
                  <span class="mr-1 h-px w-4 shrink-0 bg-border" />
                  <Button
                    v-if="model.visibility === 'public' && model.canManage"
                    size="icon"
                    variant="ghost"
                    class="size-7 shrink-0"
                    :class="model.isDefault ? 'text-amber-500' : 'text-muted-foreground'"
                    :disabled="loading || !model.enabled"
                    :title="model.isDefault ? 'Снять модель по умолчанию' : 'Назначить модель по умолчанию'"
                    @click="makeDefault(model)"
                  >
                    <Star class="size-3.5" :class="model.isDefault && 'fill-current'" />
                  </Button>
                  <span v-else class="flex size-7 shrink-0 items-center justify-center">
                    <Star v-if="model.isDefault" class="size-3.5 fill-current text-amber-500" aria-label="Модель по умолчанию" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ model.displayName }}</span>
                    <p v-if="model.providerModelId !== model.displayName" class="truncate font-mono text-[11px] text-muted-foreground">
                      {{ model.providerModelId }}
                    </p>
                  </div>
                  <Switch
                    :checked="model.enabled"
                    :disabled="loading || !model.canManage"
                    :aria-label="model.enabled ? 'Отключить модель' : 'Включить модель'"
                    :title="model.enabled ? 'Отключить модель' : 'Включить модель'"
                    @update:checked="toggleModel(model)"
                  />
                  <Button v-if="model.canManage" size="icon" variant="ghost" class="size-8" title="Редактировать модель" @click="beginModelEdit(model)">
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    v-if="model.canManage"
                    size="icon"
                    variant="ghost"
                    class="size-8 text-destructive hover:text-destructive"
                    title="Удалить модель"
                    @click="deleteModel(model)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
                <div v-if="editingModelId === model.id" class="mt-2 grid gap-2 pl-[4.75rem] sm:grid-cols-[1fr_1fr_auto]">
                  <Input v-model="modelEditForm.providerModelId" aria-label="ID модели у провайдера" /><Input v-model="modelEditForm.displayName" aria-label="Название модели" />
                  <div class="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" @click="editingModelId = ''">
                      {{ $t('uiText.cancel0ec753be') }}
                    </Button><Button size="sm" :disabled="!modelEditForm.providerModelId.trim() || !modelEditForm.displayName.trim()" @click="saveModel(model)">
                      {{ $t('uiText.save4864057d') }}
                    </Button>
                  </div>
                </div>
              </div>

              <div
                v-if="creatingModelConnectionId === connection.id"
                class="grid gap-2 border-t border-dashed px-4 py-3 pl-[4.75rem] sm:grid-cols-2 lg:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_auto_auto]"
              >
                <Input v-model="modelForm.providerModelId" placeholder="ID модели у провайдера" /><Input v-model="modelForm.displayName" placeholder="Название модели" />
                <div class="flex items-center justify-end">
                  <Button
                    v-if="connection.visibility === 'public'"
                    size="icon"
                    variant="ghost"
                    class="size-8"
                    :class="modelForm.isDefault && 'text-amber-500'"
                    :title="modelForm.isDefault ? 'Снять модель по умолчанию' : 'Назначить модель по умолчанию'"
                    @click="modelForm.isDefault = !modelForm.isDefault"
                  >
                    <Star class="size-4" :class="modelForm.isDefault && 'fill-current'" />
                  </Button>
                </div>
                <div class="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" @click="cancelModelCreate">
                    {{ $t('uiText.cancel0ec753be') }}
                  </Button><Button size="sm" :disabled="loading || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()" @click="createModel(connection)">
                    {{ $t('uiText.add559a87f7') }}
                  </Button>
                </div>
              </div>
              <div v-else-if="connection.canManage" class="border-t border-dashed px-4 py-2 pl-[4.75rem]">
                <Button size="sm" variant="ghost" class="text-muted-foreground" @click="beginModelCreate(connection)">
                  <Plus class="size-3.5" /> {{ $t('uiText.addModela4112350') }}
                </Button>
              </div>
              <div v-if="!connection.canManage && !modelsForConnection(connection.id).length" class="px-4 py-3 pl-[4.75rem] text-xs text-muted-foreground">
                {{ $t('uiText.noModels4506f584') }}
              </div>
            </div>
          </div>

          <div v-if="!filteredConnections.length && !showConnectionForm && !loading" class="px-6 py-12 text-center">
            <span class="mx-auto flex size-10 items-center justify-center rounded-xl border bg-muted/30"><Server class="size-4 text-muted-foreground" /></span>
            <p class="mt-3 text-sm font-medium">
              {{ connections.length ? $t('uiText.nothingFound1e1b70b1') : $t('uiText.noConnections24ca75d7') }}
            </p>
          </div>
        </div>
        <Loader2 v-if="loading" class="mx-auto mt-5 size-5 animate-spin text-muted-foreground" />
      </div>
    </DialogContent>
  </Dialog>
</template>
