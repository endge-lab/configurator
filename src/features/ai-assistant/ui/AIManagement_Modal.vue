<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { AIAdapter, AIModelProfile, AIProviderConnection } from '@/features/ai-assistant/domain/types'

import { Bot, Check, KeyRound, Loader2, Pencil, Plus, Server, Sparkles, Trash2, TriangleAlert, X } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AIWorkbench } from '@/features/ai-assistant'

interface AdapterPresentation {
  label: string
  endpointLabel: string
  endpointPlaceholder: string
}

const adapterPresentation: Record<AIAdapter, AdapterPresentation> = {
  anthropic: {
    label: 'Anthropic',
    endpointLabel: 'API endpoint',
    endpointPlaceholder: 'https://api.anthropic.com (необязательно)',
  },
  ollama: {
    label: 'Ollama',
    endpointLabel: 'Адрес Ollama',
    endpointPlaceholder: 'http://host.docker.internal:11434',
  },
}

const openState = ref(false)
const loading = ref(false)
const error = ref('')
const connections = ref<AIProviderConnection[]>([])
const models = ref<AIModelProfile[]>([])
const adapters = ref<AIAdapter[]>([])

const isCreatingConnection = ref(false)
const connectionForm = reactive({ name: '', adapter: '' as AIAdapter | '', baseUrl: '', credential: '', enabled: true })
const editingConnectionId = ref('')
const connectionEditForm = reactive({ name: '', baseUrl: '' })
const credentialConnectionId = ref('')
const credentialValue = ref('')

const modelForm = reactive({ connectionId: '', providerModelId: '', displayName: '', enabled: true, isDefault: false })
const editingModelId = ref('')
const modelEditForm = reactive({ providerModelId: '', displayName: '' })

const canCreateConnection = computed(() => {
  if (!connectionForm.adapter || !connectionForm.name.trim()) {
    return false
  }
  return connectionForm.adapter === 'anthropic'
    ? Boolean(connectionForm.credential.trim())
    : Boolean(connectionForm.baseUrl.trim())
})

async function open(): Promise<void> {
  await AIWorkbench.init(Configurator.context.backendConfig!.serviceBackendURL, Configurator.context.workspaceIdentity)
  openState.value = true
  await reload()
}

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
    if (!modelForm.connectionId && connections.value[0]) {
      modelForm.connectionId = connections.value[0].id
    }
  }
  catch (cause) {
    error.value = messageOf(cause)
  }
  finally {
    loading.value = false
  }
}

function beginConnectionCreate(): void {
  cancelConnectionEdit()
  resetConnectionForm()
  isCreatingConnection.value = true
}

function chooseAdapter(adapter: AIAdapter | ''): void {
  connectionForm.adapter = adapter
  connectionForm.baseUrl = ''
  connectionForm.credential = ''
}

function resetConnectionForm(): void {
  Object.assign(connectionForm, { name: '', adapter: '', baseUrl: '', credential: '', enabled: true })
}

function cancelConnectionCreate(): void {
  isCreatingConnection.value = false
  resetConnectionForm()
}

async function createConnection(): Promise<void> {
  const adapter = connectionForm.adapter
  if (!adapter || !canCreateConnection.value) {
    return
  }
  await act(async () => {
    await AIWorkbench.createProviderConnection({
      name: connectionForm.name.trim(),
      adapter,
      baseUrl: connectionForm.baseUrl.trim(),
      credential: adapter === 'anthropic' ? connectionForm.credential.trim() : '',
      enabled: connectionForm.enabled,
    })
    cancelConnectionCreate()
  })
}

async function toggleConnection(connection: AIProviderConnection): Promise<void> {
  await act(() => AIWorkbench.updateProviderConnection(connection.id, { enabled: !connection.enabled }))
}

function beginConnectionEdit(connection: AIProviderConnection): void {
  cancelConnectionCreate()
  credentialConnectionId.value = ''
  editingConnectionId.value = connection.id
  Object.assign(connectionEditForm, { name: connection.name, baseUrl: connection.baseUrl })
}

function cancelConnectionEdit(): void {
  editingConnectionId.value = ''
  credentialConnectionId.value = ''
  credentialValue.value = ''
}

async function saveConnection(connection: AIProviderConnection): Promise<void> {
  const name = connectionEditForm.name.trim()
  const baseUrl = connectionEditForm.baseUrl.trim()
  if (!name || (connection.adapter === 'ollama' && !baseUrl)) {
    return
  }
  await act(() => AIWorkbench.updateProviderConnection(connection.id, { name, baseUrl }))
  cancelConnectionEdit()
}

function beginCredentialReplace(connection: AIProviderConnection): void {
  editingConnectionId.value = ''
  credentialConnectionId.value = connection.id
  credentialValue.value = ''
}

async function saveCredential(connection: AIProviderConnection): Promise<void> {
  if (!credentialValue.value.trim()) {
    return
  }
  await act(() => AIWorkbench.replaceProviderCredential(connection.id, credentialValue.value.trim()))
  cancelConnectionEdit()
}

async function deleteConnection(connection: AIProviderConnection): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить подключение?',
    text: connection.name,
    description: `Будут безвозвратно удалены credential и ${connection.modelCount} профилей моделей. История диалогов сохранится только для чтения.`,
    answers: [{ value: false, text: 'Отмена', variant: 'outline' }, { value: true, text: 'Удалить', variant: 'destructive' }],
  })
  if (confirmed) {
    await act(() => AIWorkbench.deleteProviderConnection(connection.id))
  }
}

async function createModel(): Promise<void> {
  if (!modelForm.connectionId || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()) {
    return
  }
  await act(async () => {
    await AIWorkbench.createModelProfile({
      ...modelForm,
      providerModelId: modelForm.providerModelId.trim(),
      displayName: modelForm.displayName.trim(),
    })
    Object.assign(modelForm, { connectionId: modelForm.connectionId, providerModelId: '', displayName: '', enabled: true, isDefault: false })
  })
}

async function toggleModel(model: AIModelProfile): Promise<void> {
  await act(() => AIWorkbench.updateModelProfile(model.id, { enabled: !model.enabled }))
}

function beginModelEdit(model: AIModelProfile): void {
  editingModelId.value = model.id
  Object.assign(modelEditForm, { providerModelId: model.providerModelId, displayName: model.displayName })
}

async function saveModel(model: AIModelProfile): Promise<void> {
  const providerModelId = modelEditForm.providerModelId.trim()
  const displayName = modelEditForm.displayName.trim()
  if (!providerModelId || !displayName) {
    return
  }
  await act(() => AIWorkbench.updateModelProfile(model.id, { providerModelId, displayName }))
  editingModelId.value = ''
}

async function makeDefault(model: AIModelProfile): Promise<void> {
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

async function act(operation: () => Promise<unknown>): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await operation()
    await reload()
  }
  catch (cause) {
    error.value = messageOf(cause)
  }
  finally {
    loading.value = false
  }
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : 'Не удалось выполнить запрос'
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader class="border-b px-6 py-5">
        <DialogTitle class="flex items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-md bg-fuchsia-500/10">
            <Bot class="size-4 text-fuchsia-500" />
          </span>
          Настройки AI
        </DialogTitle>
      </DialogHeader>

      <div class="min-h-0 space-y-6 overflow-y-auto px-6 pb-6">
        <div v-if="error" class="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert class="size-4 shrink-0" />
          {{ error }}
        </div>

        <section class="space-y-3 pt-5">
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-sm font-semibold">
              Подключения
            </h3>
            <Button v-if="!isCreatingConnection" size="sm" @click="beginConnectionCreate">
              <Plus class="size-4" /> Добавить
            </Button>
          </div>

          <div class="overflow-x-auto rounded-lg border">
            <div class="min-w-[820px]">
              <div class="grid grid-cols-[minmax(180px,1.4fr)_110px_minmax(170px,1fr)_80px_64px_108px] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Название</span><span>Тип</span><span>Доступ</span><span>Модели</span><span>Вкл.</span><span class="text-right">Действия</span>
              </div>

              <template v-for="connection in connections" :key="connection.id">
                <div class="grid grid-cols-[minmax(180px,1.4fr)_110px_minmax(170px,1fr)_80px_64px_108px] items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0">
                  <p class="truncate font-medium">
                    {{ connection.name }}
                  </p>
                  <div class="flex items-center gap-2 text-xs">
                    <Sparkles v-if="connection.adapter === 'anthropic'" class="size-3.5 text-fuchsia-500" />
                    <Server v-else class="size-3.5 text-sky-500" />
                    {{ adapterPresentation[connection.adapter].label }}
                  </div>
                  <p class="truncate text-xs text-muted-foreground" :title="connection.baseUrl || undefined">
                    <template v-if="connection.adapter === 'anthropic'">
                      {{ connection.hasCredential ? 'API key установлен' : 'API key не установлен' }}
                    </template>
                    <template v-else>
                      {{ connection.baseUrl || 'Адрес не указан' }}
                    </template>
                  </p>
                  <span class="text-xs tabular-nums text-muted-foreground">{{ connection.modelCount }}</span>
                  <Switch :model-value="connection.enabled" :disabled="loading" @update:model-value="toggleConnection(connection)" />
                  <div class="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" class="size-8" title="Редактировать" @click="beginConnectionEdit(connection)">
                      <Pencil class="size-3.5" />
                    </Button>
                    <Button v-if="connection.adapter === 'anthropic'" size="icon" variant="ghost" class="size-8" title="Заменить API key" @click="beginCredentialReplace(connection)">
                      <KeyRound class="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" class="size-8 text-destructive hover:text-destructive" title="Удалить" @click="deleteConnection(connection)">
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div v-if="editingConnectionId === connection.id" class="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-2">
                  <label class="space-y-1.5 text-xs font-medium">Название<Input v-model="connectionEditForm.name" /></label>
                  <label class="space-y-1.5 text-xs font-medium">
                    {{ adapterPresentation[connection.adapter].endpointLabel }}
                    <Input v-model="connectionEditForm.baseUrl" :placeholder="adapterPresentation[connection.adapter].endpointPlaceholder" />
                  </label>
                  <div class="flex justify-end gap-2 sm:col-span-2">
                    <Button size="sm" variant="ghost" @click="cancelConnectionEdit">
                      Отмена
                    </Button>
                    <Button size="sm" :disabled="!connectionEditForm.name.trim() || (connection.adapter === 'ollama' && !connectionEditForm.baseUrl.trim())" @click="saveConnection(connection)">
                      <Check class="size-4" /> Сохранить
                    </Button>
                  </div>
                </div>

                <div v-if="credentialConnectionId === connection.id" class="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label class="space-y-1.5 text-xs font-medium">Новый API key для {{ connection.name }}<Input v-model="credentialValue" type="password" autocomplete="new-password" placeholder="sk-ant-…" /></label>
                  <div class="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" @click="cancelConnectionEdit">
                      Отмена
                    </Button>
                    <Button size="sm" :disabled="!credentialValue.trim()" @click="saveCredential(connection)">
                      Заменить ключ
                    </Button>
                  </div>
                </div>
              </template>

              <div v-if="!connections.length && !loading" class="px-4 py-10 text-center">
                <Server class="mx-auto size-7 text-muted-foreground/50" />
                <p class="mt-3 text-sm font-medium">
                  Подключений пока нет
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Выберите тип и добавьте первое подключение.
                </p>
              </div>
            </div>
          </div>

          <div v-if="isCreatingConnection" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <select
              :value="connectionForm.adapter"
              class="h-9 min-w-40 rounded-md border bg-background px-3 text-sm"
              aria-label="Тип подключения"
              @change="chooseAdapter(($event.target as HTMLSelectElement).value as AIAdapter)"
            >
              <option value="" disabled>
                Тип подключения
              </option>
              <option v-for="adapter in adapters" :key="adapter" :value="adapter">
                {{ adapterPresentation[adapter].label }}
              </option>
            </select>
            <template v-if="connectionForm.adapter">
              <Input v-model="connectionForm.name" class="min-w-44 flex-1" aria-label="Название подключения" placeholder="Название" />
              <Input
                v-model="connectionForm.baseUrl"
                class="min-w-56 flex-[1.4]"
                :aria-label="adapterPresentation[connectionForm.adapter].endpointLabel"
                :placeholder="adapterPresentation[connectionForm.adapter].endpointPlaceholder"
              />
              <Input
                v-if="connectionForm.adapter === 'anthropic'"
                v-model="connectionForm.credential"
                class="min-w-48 flex-1"
                type="password"
                autocomplete="new-password"
                aria-label="Anthropic API key"
                placeholder="API key"
              />
              <label class="flex h-9 items-center gap-2 px-1 text-xs text-muted-foreground">
                <Switch v-model="connectionForm.enabled" /> Включено
              </label>
              <Button size="sm" class="h-9" :disabled="loading || !canCreateConnection" @click="createConnection">
                <Plus class="size-4" /> Создать
              </Button>
            </template>
            <span v-else-if="!adapters.length && !loading" class="text-xs text-muted-foreground">
              Типы подключений недоступны
            </span>
            <Button size="icon" variant="ghost" class="ml-auto size-9" title="Отмена" @click="cancelConnectionCreate">
              <X class="size-4" />
            </Button>
          </div>
        </section>

        <section class="space-y-3 border-t pt-6">
          <div>
            <h3 class="text-sm font-semibold">
              Модели
            </h3>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Профили моделей, доступные пользователям в AI-виджете.
            </p>
          </div>

          <div v-if="connections.length" class="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1.1fr_1fr_1fr_auto]">
            <select v-model="modelForm.connectionId" class="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="" disabled>
                Подключение
              </option>
              <option v-for="connection in connections" :key="connection.id" :value="connection.id">
                {{ connection.name }}
              </option>
            </select>
            <Input v-model="modelForm.providerModelId" placeholder="ID модели у провайдера" />
            <Input v-model="modelForm.displayName" placeholder="Отображаемое имя" />
            <Button size="sm" class="h-9" :disabled="loading || !modelForm.connectionId || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()" @click="createModel">
              <Plus class="size-4" /> Добавить
            </Button>
            <label class="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-4"><Switch v-model="modelForm.isDefault" /> Сделать моделью по умолчанию</label>
          </div>

          <div class="divide-y overflow-hidden rounded-lg border">
            <div v-for="model in models" :key="model.id" class="px-3 py-2.5">
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ model.displayName }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ model.connectionName }} · {{ model.providerModelId }}
                  </p>
                </div>
                <button class="rounded px-2 py-1 text-[11px]" :class="model.isDefault ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'" :disabled="!model.enabled" @click="makeDefault(model)">
                  По умолчанию
                </button>
                <Switch :model-value="model.enabled" :disabled="loading" @update:model-value="toggleModel(model)" />
                <Button size="icon" variant="ghost" class="size-8" title="Редактировать" @click="beginModelEdit(model)">
                  <Pencil class="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" class="size-8 text-destructive hover:text-destructive" title="Удалить" @click="deleteModel(model)">
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
            <p v-if="!models.length && !loading" class="px-4 py-8 text-center text-sm text-muted-foreground">
              {{ connections.length ? 'Профилей моделей пока нет.' : 'Сначала добавьте подключение.' }}
            </p>
          </div>
        </section>

        <Loader2 v-if="loading" class="mx-auto size-5 animate-spin text-muted-foreground" />
      </div>
    </DialogContent>
  </Dialog>
</template>
