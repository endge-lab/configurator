<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { AIAdapter, AIModelProfile, AIProviderConnection, AIVisibility } from '@/features/ai-assistant/domain/types'

import {
  Bot,
  ChevronDown,
  ChevronRight,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  Server,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { AIWorkbench } from '@/features/ai-assistant'

interface AdapterPresentation {
  label: string
  endpointLabel: string
  endpointPlaceholder: string
  description: string
}

type VisibilityFilter = 'all' | 'public' | 'mine'

const visibilityFilters: ReadonlyArray<{ value: VisibilityFilter, label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'public', label: 'Для всех' },
  { value: 'mine', label: 'Мои' },
]

const adapterPresentation: Record<AIAdapter, AdapterPresentation> = {
  anthropic: {
    label: 'Anthropic',
    endpointLabel: 'API endpoint',
    endpointPlaceholder: 'https://api.anthropic.com (необязательно)',
    description: 'Облачные модели Claude по API key',
  },
  ollama: {
    label: 'Ollama',
    endpointLabel: 'Адрес Ollama',
    endpointPlaceholder: 'http://host.docker.internal:11434',
    description: 'Локальные модели через Ollama endpoint',
  },
}

const openState = computed({
  get: () => AIWorkbench.state.managementOpen,
  set: (value: boolean) => value ? AIWorkbench.openManagement() : AIWorkbench.closeManagement(),
})
const loading = ref(false)
const error = ref('')
const connections = ref<AIProviderConnection[]>([])
const models = ref<AIModelProfile[]>([])
const adapters = ref<AIAdapter[]>([])
const visibilityFilter = ref<VisibilityFilter>('all')
const isPlatformAdmin = computed(() => Configurator.session.state.status === 'authenticated' && Configurator.session.state.session.platformAdmin)

const connectionSheetOpen = ref(false)
const activeConnectionId = ref('')
const isCreatingConnection = ref(false)
const advancedOpen = ref(false)
const connectionForm = reactive({ name: '', adapter: '' as AIAdapter | '', baseUrl: '', credential: '', visibility: 'private' as AIVisibility, enabled: true })
const connectionEditForm = reactive({ name: '', baseUrl: '' })
const credentialValue = ref('')

const showModelForm = ref(false)
const modelForm = reactive({ connectionId: '', providerModelId: '', displayName: '', enabled: true, isDefault: false })
const editingModelId = ref('')
const modelEditForm = reactive({ providerModelId: '', displayName: '' })

const activeConnection = computed(() => connections.value.find(connection => connection.id === activeConnectionId.value) ?? null)
const activeModels = computed(() => models.value.filter(model => model.connectionId === activeConnectionId.value))
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
  if (!connectionForm.adapter || !connectionForm.name.trim()) {
    return false
  }
  return connectionForm.adapter === 'anthropic'
    ? Boolean(connectionForm.credential.trim())
    : Boolean(connectionForm.baseUrl.trim())
})
const canSaveConnection = computed(() => {
  const connection = activeConnection.value
  if (!connection || !connectionEditForm.name.trim()) {
    return false
  }
  return connection.adapter !== 'ollama' || Boolean(connectionEditForm.baseUrl.trim())
})

async function open(): Promise<void> {
  await AIWorkbench.init(Configurator.context.backendConfig!.serviceBackendURL, Configurator.context.workspaceIdentity)
  AIWorkbench.openManagement()
}

watch(() => AIWorkbench.state.managementOpen, (visible) => {
  if (visible) {
    void reload()
  }
  else {
    connectionSheetOpen.value = false
  }
})

watch(connectionSheetOpen, (visible) => {
  if (!visible) {
    resetDrawerState()
  }
})

async function reload(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [adapterPage, connectionPage, modelPage] = await Promise.all([
      AIWorkbench.listProviderAdapters(),
      AIWorkbench.listProviderConnections(),
      AIWorkbench.listModelProfiles(),
    ])
    adapters.value = adapterPage.items
    connections.value = connectionPage.items
    models.value = modelPage.items

    if (activeConnectionId.value && !connections.value.some(connection => connection.id === activeConnectionId.value)) {
      connectionSheetOpen.value = false
    }
  }
  catch (cause) {
    error.value = messageOf(cause)
  }
  finally {
    loading.value = false
  }
}

function beginConnectionCreate(adapter: AIAdapter): void {
  resetDrawerState()
  Object.assign(connectionForm, {
    name: '',
    adapter,
    baseUrl: '',
    credential: '',
    visibility: isPlatformAdmin.value ? 'public' : 'private',
    enabled: true,
  })
  isCreatingConnection.value = true
  advancedOpen.value = adapter === 'anthropic'
  connectionSheetOpen.value = true
}

function openConnection(connection: AIProviderConnection): void {
  resetDrawerState()
  activeConnectionId.value = connection.id
  Object.assign(connectionEditForm, { name: connection.name, baseUrl: connection.baseUrl })
  modelForm.connectionId = connection.id
  connectionSheetOpen.value = true
}

function resetDrawerState(): void {
  activeConnectionId.value = ''
  isCreatingConnection.value = false
  advancedOpen.value = false
  credentialValue.value = ''
  showModelForm.value = false
  editingModelId.value = ''
  Object.assign(connectionForm, { name: '', adapter: '', baseUrl: '', credential: '', visibility: 'private', enabled: true })
  Object.assign(connectionEditForm, { name: '', baseUrl: '' })
  Object.assign(modelForm, { connectionId: '', providerModelId: '', displayName: '', enabled: true, isDefault: false })
  Object.assign(modelEditForm, { providerModelId: '', displayName: '' })
}

async function createConnection(): Promise<void> {
  const adapter = connectionForm.adapter
  if (!adapter || !canCreateConnection.value) {
    return
  }
  const succeeded = await act(async () => {
    const created = await AIWorkbench.createProviderConnection({
      name: connectionForm.name.trim(),
      adapter,
      baseUrl: connectionForm.baseUrl.trim(),
      credential: adapter === 'anthropic' ? connectionForm.credential.trim() : '',
      visibility: isPlatformAdmin.value ? connectionForm.visibility : 'private',
      enabled: connectionForm.enabled,
    })
    activeConnectionId.value = created.id
  })
  if (succeeded && activeConnection.value) {
    openConnection(activeConnection.value)
  }
}

async function saveConnection(connection: AIProviderConnection): Promise<void> {
  if (!canSaveConnection.value) {
    return
  }
  await act(() => AIWorkbench.updateProviderConnection(connection.id, {
    name: connectionEditForm.name.trim(),
    baseUrl: connectionEditForm.baseUrl.trim(),
  }))
}

async function toggleConnection(connection: AIProviderConnection): Promise<void> {
  if (!connection.canManage) {
    return
  }
  await act(() => AIWorkbench.updateProviderConnection(connection.id, { enabled: !connection.enabled }))
}

async function saveCredential(connection: AIProviderConnection): Promise<void> {
  if (!credentialValue.value.trim()) {
    return
  }
  const succeeded = await act(() => AIWorkbench.replaceProviderCredential(connection.id, credentialValue.value.trim()))
  if (succeeded) {
    credentialValue.value = ''
  }
}

async function deleteConnection(connection: AIProviderConnection): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить подключение?',
    text: connection.name,
    description: `Будут безвозвратно удалены credential и ${modelCountLabel(connection.modelCount)}. История диалогов сохранится только для чтения.`,
    answers: [{ value: false, text: 'Отмена', variant: 'outline' }, { value: true, text: 'Удалить', variant: 'destructive' }],
  })
  if (confirmed && await act(() => AIWorkbench.deleteProviderConnection(connection.id))) {
    connectionSheetOpen.value = false
  }
}

function beginModelCreate(connection: AIProviderConnection): void {
  editingModelId.value = ''
  Object.assign(modelForm, {
    connectionId: connection.id,
    providerModelId: '',
    displayName: '',
    enabled: true,
    isDefault: false,
  })
  showModelForm.value = true
}

async function createModel(): Promise<void> {
  const connection = activeConnection.value
  if (!connection || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()) {
    return
  }
  const succeeded = await act(() => AIWorkbench.createModelProfile({
    ...modelForm,
    connectionId: connection.id,
    isDefault: connection.visibility === 'public' && modelForm.isDefault,
    providerModelId: modelForm.providerModelId.trim(),
    displayName: modelForm.displayName.trim(),
  }))
  if (succeeded) {
    showModelForm.value = false
    Object.assign(modelForm, { connectionId: connection.id, providerModelId: '', displayName: '', enabled: true, isDefault: false })
  }
}

async function toggleModel(model: AIModelProfile): Promise<void> {
  if (!model.canManage) {
    return
  }
  await act(() => AIWorkbench.updateModelProfile(model.id, { enabled: !model.enabled }))
}

function beginModelEdit(model: AIModelProfile): void {
  if (!model.canManage) {
    return
  }
  showModelForm.value = false
  editingModelId.value = model.id
  Object.assign(modelEditForm, { providerModelId: model.providerModelId, displayName: model.displayName })
}

async function saveModel(model: AIModelProfile): Promise<void> {
  const providerModelId = modelEditForm.providerModelId.trim()
  const displayName = modelEditForm.displayName.trim()
  if (!providerModelId || !displayName) {
    return
  }
  if (await act(() => AIWorkbench.updateModelProfile(model.id, { providerModelId, displayName }))) {
    editingModelId.value = ''
  }
}

async function makeDefault(model: AIModelProfile): Promise<void> {
  if (!model.canManage || model.visibility !== 'public') {
    return
  }
  await act(() => AIWorkbench.updateModelProfile(model.id, { isDefault: !model.isDefault }))
}

async function deleteModel(model: AIModelProfile): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить профиль модели?',
    text: model.displayName,
    description: 'Диалоги с этой моделью сохранят историю, но новые сообщения в них будут запрещены.',
    answers: [{ value: false, text: 'Отмена', variant: 'outline' }, { value: true, text: 'Удалить', variant: 'destructive' }],
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
    <DialogContent class="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader class="border-b px-6 py-5">
        <DialogTitle class="flex items-center gap-3">
          <span class="flex size-9 items-center justify-center rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10">
            <Bot class="size-4 text-fuchsia-500" />
          </span>
          <span>
            <span class="block text-base">AI-подключения</span>
            <span class="mt-0.5 block text-xs font-normal text-muted-foreground">Модели и доступ к провайдерам</span>
          </span>
        </DialogTitle>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <div v-if="error" class="mb-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert class="size-4 shrink-0" />
          {{ error }}
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
          <p v-else class="text-xs text-muted-foreground">
            {{ connections.length ? `${connections.length} подключений` : 'Подключений пока нет' }}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button size="sm" :disabled="loading || !adapters.length">
                <Plus class="size-4" /> Добавить
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
                Тип подключения
              </DropdownMenuLabel>
              <DropdownMenuItem
                v-for="adapter in adapters"
                :key="adapter"
                class="gap-3 py-2.5"
                @select="beginConnectionCreate(adapter)"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-md border"
                  :class="adapter === 'anthropic' ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-500' : 'border-sky-500/20 bg-sky-500/10 text-sky-500'"
                >
                  <Sparkles v-if="adapter === 'anthropic'" class="size-4" />
                  <Server v-else class="size-4" />
                </span>
                <span class="min-w-0">
                  <span class="block font-medium">{{ adapterPresentation[adapter].label }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ adapterPresentation[adapter].description }}</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="overflow-hidden rounded-xl border bg-card">
          <button
            v-for="connection in filteredConnections"
            :key="connection.id"
            class="group flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            @click="openConnection(connection)"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border"
              :class="connection.adapter === 'anthropic' ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-500' : 'border-sky-500/20 bg-sky-500/10 text-sky-500'"
            >
              <Sparkles v-if="connection.adapter === 'anthropic'" class="size-4" />
              <Server v-else class="size-4" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span class="font-medium">{{ adapterPresentation[connection.adapter].label }}</span>
                <span class="text-muted-foreground/50">·</span>
                <span class="truncate font-medium">{{ connection.name }}</span>
                <span class="text-muted-foreground/50">·</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Globe2 v-if="connection.visibility === 'public'" class="size-3" />
                  <UserRound v-else class="size-3" />
                  {{ connection.visibility === 'public' ? 'Для всех' : 'Только мне' }}
                </span>
                <span class="text-muted-foreground/50">·</span>
                <span class="text-xs text-muted-foreground">{{ modelCountLabel(connection.modelCount) }}</span>
              </span>
              <span class="mt-1 flex items-center gap-1.5 text-xs" :class="connection.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
                <span class="size-1.5 rounded-full" :class="connection.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'" />
                {{ connection.enabled ? 'Включено' : 'Отключено' }}
              </span>
            </span>

            <ChevronRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          <div v-if="!filteredConnections.length && !loading" class="px-6 py-12 text-center">
            <span class="mx-auto flex size-10 items-center justify-center rounded-xl border bg-muted/30">
              <Server class="size-4 text-muted-foreground" />
            </span>
            <p class="mt-3 text-sm font-medium">
              {{ connections.length ? 'Подключения не найдены' : 'Добавьте первое подключение' }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ connections.length ? 'Измените выбранный фильтр.' : 'Выберите Anthropic или Ollama в меню «Добавить».' }}
            </p>
          </div>
        </div>

        <Loader2 v-if="loading" class="mx-auto mt-5 size-5 animate-spin text-muted-foreground" />
      </div>
    </DialogContent>
  </Dialog>

  <Sheet v-model:open="connectionSheetOpen">
    <SheetContent class="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
      <SheetHeader class="border-b px-6 py-5 pr-12 text-left">
        <SheetTitle class="flex items-center gap-3">
          <span
            class="flex size-9 items-center justify-center rounded-lg border"
            :class="(connectionForm.adapter || activeConnection?.adapter) === 'anthropic' ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-500' : 'border-sky-500/20 bg-sky-500/10 text-sky-500'"
          >
            <Sparkles v-if="(connectionForm.adapter || activeConnection?.adapter) === 'anthropic'" class="size-4" />
            <Server v-else class="size-4" />
          </span>
          <span>
            <span class="block text-base">{{ isCreatingConnection ? `Новое подключение · ${connectionForm.adapter ? adapterPresentation[connectionForm.adapter].label : ''}` : activeConnection?.name }}</span>
            <span class="mt-0.5 block text-xs font-normal text-muted-foreground">
              {{ isCreatingConnection ? 'Настройте доступ к провайдеру' : activeConnection ? adapterPresentation[activeConnection.adapter].label : '' }}
            </span>
          </span>
        </SheetTitle>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="error" class="mx-6 mt-5 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert class="size-4 shrink-0" />
          {{ error }}
        </div>

        <section class="space-y-4 px-6 py-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5 text-xs font-medium">
              Название
              <Input
                v-if="isCreatingConnection"
                v-model="connectionForm.name"
                placeholder="Например, Production"
              />
              <Input v-else v-model="connectionEditForm.name" :disabled="!activeConnection?.canManage" />
            </label>

            <label class="space-y-1.5 text-xs font-medium">
              {{ adapterPresentation[(connectionForm.adapter || activeConnection?.adapter || 'anthropic')].endpointLabel }}
              <Input
                v-if="isCreatingConnection"
                v-model="connectionForm.baseUrl"
                :placeholder="adapterPresentation[connectionForm.adapter || 'anthropic'].endpointPlaceholder"
              />
              <Input
                v-else
                v-model="connectionEditForm.baseUrl"
                :disabled="!activeConnection?.canManage"
                :placeholder="adapterPresentation[activeConnection?.adapter || 'anthropic'].endpointPlaceholder"
              />
            </label>
          </div>

          <div class="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-3">
              <span>
                <span class="block text-xs font-medium">Доступ</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">
                  {{ (isCreatingConnection ? connectionForm.visibility : activeConnection?.visibility) === 'public' ? 'Доступно всем пользователям' : 'Доступно только владельцу' }}
                </span>
              </span>
              <Switch
                v-if="isCreatingConnection && isPlatformAdmin"
                :model-value="connectionForm.visibility === 'public'"
                @update:model-value="connectionForm.visibility = $event ? 'public' : 'private'"
              />
              <Globe2 v-else-if="activeConnection?.visibility === 'public'" class="size-4 text-muted-foreground" />
              <LockKeyhole v-else class="size-4 text-muted-foreground" />
            </div>

            <div class="flex items-center justify-between gap-3 sm:border-l sm:pl-3">
              <span>
                <span class="block text-xs font-medium">Состояние</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">
                  {{ (isCreatingConnection ? connectionForm.enabled : activeConnection?.enabled) ? 'Подключение включено' : 'Подключение отключено' }}
                </span>
              </span>
              <Switch
                v-if="isCreatingConnection"
                v-model="connectionForm.enabled"
              />
              <Switch
                v-else-if="activeConnection"
                :model-value="activeConnection.enabled"
                :disabled="loading || !activeConnection.canManage"
                @update:model-value="toggleConnection(activeConnection)"
              />
            </div>
          </div>

          <Button
            v-if="!isCreatingConnection && activeConnection?.canManage"
            size="sm"
            :disabled="loading || !canSaveConnection"
            @click="saveConnection(activeConnection)"
          >
            Сохранить подключение
          </Button>

          <Collapsible
            v-if="(isCreatingConnection && connectionForm.adapter === 'anthropic') || (!isCreatingConnection && activeConnection?.canManage)"
            v-model:open="advancedOpen"
            class="rounded-lg border"
          >
            <CollapsibleTrigger class="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium">
              Дополнительно
              <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="advancedOpen && 'rotate-180'" />
            </CollapsibleTrigger>
            <CollapsibleContent class="space-y-4 border-t px-3 py-4">
              <div v-if="isCreatingConnection && connectionForm.adapter === 'anthropic'" class="space-y-1.5">
                <label class="text-xs font-medium" for="new-anthropic-credential">API key</label>
                <Input id="new-anthropic-credential" v-model="connectionForm.credential" type="password" autocomplete="new-password" placeholder="sk-ant-…" />
                <p class="text-xs text-muted-foreground">
                  Credential сохраняется на backend в зашифрованном виде.
                </p>
              </div>

              <div v-else-if="activeConnection?.adapter === 'anthropic'" class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <span class="flex items-center gap-2 text-xs font-medium">
                    <KeyRound class="size-3.5 text-muted-foreground" /> Credential
                  </span>
                  <span class="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {{ activeConnection.hasCredential ? 'Установлен' : 'Не установлен' }}
                  </span>
                </div>
                <div class="flex gap-2">
                  <Input v-model="credentialValue" type="password" autocomplete="new-password" placeholder="Новый API key" />
                  <Button size="sm" variant="outline" :disabled="loading || !credentialValue.trim()" @click="saveCredential(activeConnection)">
                    Заменить
                  </Button>
                </div>
              </div>

              <div v-if="!isCreatingConnection && activeConnection" class="flex items-center justify-between gap-4 border-t pt-4">
                <div>
                  <p class="text-xs font-medium">
                    Удаление подключения
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    Credential и все модели будут удалены физически.
                  </p>
                </div>
                <Button size="sm" variant="destructive" :disabled="loading" @click="deleteConnection(activeConnection)">
                  <Trash2 class="size-3.5" /> Удалить
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button
            v-if="isCreatingConnection"
            class="w-full"
            :disabled="loading || !canCreateConnection"
            @click="createConnection"
          >
            <Loader2 v-if="loading" class="size-4 animate-spin" />
            <Plus v-else class="size-4" />
            Создать подключение
          </Button>
        </section>

        <section v-if="!isCreatingConnection && activeConnection" class="border-t px-6 py-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Модели
              </h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ modelCountLabel(activeModels.length) }} в этом подключении
              </p>
            </div>
            <Button v-if="activeConnection.canManage && !showModelForm" size="sm" variant="outline" @click="beginModelCreate(activeConnection)">
              <Plus class="size-4" /> Добавить модель
            </Button>
          </div>

          <div v-if="showModelForm" class="mb-3 space-y-3 rounded-lg border border-dashed bg-muted/15 p-3">
            <div class="grid gap-2 sm:grid-cols-2">
              <Input v-model="modelForm.providerModelId" placeholder="ID модели у провайдера" />
              <Input v-model="modelForm.displayName" placeholder="Отображаемое имя" />
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <label v-if="activeConnection.visibility === 'public'" class="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch v-model="modelForm.isDefault" /> По умолчанию
              </label>
              <span v-else class="text-xs text-muted-foreground">Личная модель доступна только вам</span>
              <div class="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" @click="showModelForm = false">
                  Отмена
                </Button>
                <Button size="sm" :disabled="loading || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()" @click="createModel">
                  Добавить
                </Button>
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg border">
            <div v-for="model in activeModels" :key="model.id" class="border-b px-3 py-3 last:border-b-0">
              <div class="flex items-center gap-3">
                <span class="size-2 shrink-0 rounded-full" :class="model.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/35'" />
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 items-center gap-2">
                    <p class="truncate text-sm font-medium">
                      {{ model.displayName }}
                    </p>
                    <span v-if="model.isDefault" class="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">По умолчанию</span>
                  </div>
                  <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {{ model.providerModelId }}
                  </p>
                </div>
                <button
                  v-if="model.visibility === 'public' && model.canManage"
                  class="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  :disabled="!model.enabled"
                  @click="makeDefault(model)"
                >
                  {{ model.isDefault ? 'Снять default' : 'Сделать default' }}
                </button>
                <Switch :model-value="model.enabled" :disabled="loading || !model.canManage" @update:model-value="toggleModel(model)" />
                <Button v-if="model.canManage" size="icon" variant="ghost" class="size-8" title="Редактировать" @click="beginModelEdit(model)">
                  <Pencil class="size-3.5" />
                </Button>
                <Button v-if="model.canManage" size="icon" variant="ghost" class="size-8 text-destructive hover:text-destructive" title="Удалить" @click="deleteModel(model)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>

              <div v-if="editingModelId === model.id" class="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input v-model="modelEditForm.providerModelId" aria-label="ID модели у провайдера" />
                <Input v-model="modelEditForm.displayName" aria-label="Отображаемое имя" />
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" @click="editingModelId = ''">
                    Отмена
                  </Button>
                  <Button size="sm" :disabled="!modelEditForm.providerModelId.trim() || !modelEditForm.displayName.trim()" @click="saveModel(model)">
                    Сохранить
                  </Button>
                </div>
              </div>
            </div>

            <div v-if="!activeModels.length && !loading" class="px-4 py-8 text-center">
              <p class="text-sm font-medium">
                Моделей пока нет
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Добавьте модель, которую можно будет выбрать в AI-виджете.
              </p>
            </div>
          </div>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>
