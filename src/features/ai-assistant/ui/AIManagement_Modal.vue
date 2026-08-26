<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { AIAdapter, AIModelProfile, AIProviderConnection } from '@/features/ai-assistant/domain/types'

import { Bot, KeyRound, Loader2, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'

import { Configurator } from '@/app'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AIWorkbench_HTTP_Adapter } from '@/features/ai-assistant/adapters/AIWorkbench_HTTP_Adapter'

const openState = ref(false)
const loading = ref(false)
const error = ref('')
const connections = ref<AIProviderConnection[]>([])
const models = ref<AIModelProfile[]>([])
const adapters = ref<AIAdapter[]>([])
const connectionForm = reactive({ name: '', adapter: 'ollama' as AIAdapter, baseUrl: '', credential: '', enabled: true })
const modelForm = reactive({ connectionId: '', providerModelId: '', displayName: '', enabled: true, isDefault: false })
const editingConnectionId = ref('')
const connectionEditForm = reactive({ name: '', baseUrl: '' })
const credentialConnectionId = ref('')
const credentialValue = ref('')
const editingModelId = ref('')
const modelEditForm = reactive({ providerModelId: '', displayName: '' })
const service = computed(() => new AIWorkbench_HTTP_Adapter(Configurator.context.backendConfig!.serviceBackendURL, Configurator.context.workspaceIdentity))

async function open(): Promise<void> {
  openState.value = true
  await reload()
}

async function reload(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [adapterPage, connectionPage, modelPage] = await Promise.all([service.value.adapters(), service.value.connections(), service.value.models()])
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

async function createConnection(): Promise<void> {
  if (!connectionForm.name.trim()) {
    return
  }
  await act(async () => {
    await service.value.createConnection({ ...connectionForm })
    Object.assign(connectionForm, { name: '', adapter: 'ollama', baseUrl: '', credential: '', enabled: true })
  })
}

async function createModel(): Promise<void> {
  if (!modelForm.connectionId || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()) {
    return
  }
  await act(async () => {
    await service.value.createModel({ ...modelForm })
    Object.assign(modelForm, { connectionId: modelForm.connectionId, providerModelId: '', displayName: '', enabled: true, isDefault: false })
  })
}

async function toggleConnection(connection: AIProviderConnection): Promise<void> {
  await act(() => service.value.patchConnection(connection.id, { enabled: !connection.enabled }))
}

function beginConnectionEdit(connection: AIProviderConnection): void {
  editingConnectionId.value = connection.id
  Object.assign(connectionEditForm, { name: connection.name, baseUrl: connection.baseUrl })
}

async function saveConnection(connection: AIProviderConnection): Promise<void> {
  const name = connectionEditForm.name.trim()
  if (!name) {
    return
  }
  await act(() => service.value.patchConnection(connection.id, { name, baseUrl: connectionEditForm.baseUrl.trim() }))
  editingConnectionId.value = ''
}

async function toggleModel(model: AIModelProfile): Promise<void> {
  await act(() => service.value.patchModel(model.id, { enabled: !model.enabled }))
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
  await act(() => service.value.patchModel(model.id, { providerModelId, displayName }))
  editingModelId.value = ''
}

async function makeDefault(model: AIModelProfile): Promise<void> {
  await act(() => service.value.patchModel(model.id, { isDefault: !model.isDefault }))
}

function beginCredentialReplace(connection: AIProviderConnection): void {
  credentialConnectionId.value = connection.id
  credentialValue.value = ''
}

async function saveCredential(connection: AIProviderConnection): Promise<void> {
  if (!credentialValue.value) {
    return
  }
  await act(() => service.value.replaceCredential(connection.id, credentialValue.value))
  credentialConnectionId.value = ''
  credentialValue.value = ''
}

async function deleteConnection(connection: AIProviderConnection): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить connection?',
    text: connection.name,
    description: `Будут безвозвратно удалены credential и ${connection.modelCount} model profile. История диалогов сохранится только для чтения.`,
    answers: [{ value: false, text: 'Отмена', variant: 'outline' }, { value: true, text: 'Удалить', variant: 'destructive' }],
  })
  if (confirmed) {
    await act(() => service.value.deleteConnection(connection.id))
  }
}

async function deleteModel(model: AIModelProfile): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Физически удалить model profile?',
    text: model.displayName,
    description: 'Диалоги с этой моделью сохранят историю, но новые сообщения в них будут запрещены.',
    answers: [{ value: false, text: 'Отмена', variant: 'outline' }, { value: true, text: 'Удалить', variant: 'destructive' }],
  })
  if (confirmed) {
    await act(() => service.value.deleteModel(model.id))
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
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Bot class="size-5 text-fuchsia-500" /> Управление AI
        </DialogTitle>
      </DialogHeader>
      <div v-if="error" class="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <TriangleAlert class="size-4 shrink-0" /> {{ error }}
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            Connections
          </h3>
          <div v-for="connection in connections" :key="connection.id" class="rounded-lg border p-3">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {{ connection.name }}
                </p><p class="truncate text-xs text-muted-foreground">
                  {{ connection.adapter }} · {{ connection.baseUrl || 'default endpoint' }}
                </p>
              </div>
              <Switch :model-value="connection.enabled" @update:model-value="toggleConnection(connection)" />
              <Button size="icon" variant="ghost" title="Редактировать connection" @click="beginConnectionEdit(connection)">
                <Pencil class="size-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Заменить credential" @click="beginCredentialReplace(connection)">
                <KeyRound class="size-4" />
              </Button>
              <Button size="icon" variant="ghost" class="text-destructive" @click="deleteConnection(connection)">
                <Trash2 class="size-4" />
              </Button>
            </div>
            <div v-if="editingConnectionId === connection.id" class="mt-3 space-y-2 border-t pt-3">
              <Input v-model="connectionEditForm.name" aria-label="Название connection для редактирования" />
              <Input v-model="connectionEditForm.baseUrl" aria-label="Base URL для редактирования" />
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="ghost" @click="editingConnectionId = ''">
                  Отмена
                </Button>
                <Button size="sm" :disabled="!connectionEditForm.name.trim()" @click="saveConnection(connection)">
                  Сохранить
                </Button>
              </div>
            </div>
            <div v-if="credentialConnectionId === connection.id" class="mt-3 space-y-2 border-t pt-3">
              <Input v-model="credentialValue" type="password" autocomplete="new-password" placeholder="Новый credential" />
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="ghost" @click="credentialConnectionId = ''">
                  Отмена
                </Button>
                <Button size="sm" :disabled="!credentialValue" @click="saveCredential(connection)">
                  Заменить credential
                </Button>
              </div>
            </div>
          </div>
          <div class="space-y-2 rounded-lg border border-dashed p-3">
            <Input v-model="connectionForm.name" placeholder="Название connection" />
            <select v-model="connectionForm.adapter" class="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option v-for="adapter in adapters" :key="adapter" :value="adapter">
                {{ adapter }}
              </option>
            </select>
            <Input v-model="connectionForm.baseUrl" placeholder="Base URL (для Anthropic можно пустым)" />
            <Input v-model="connectionForm.credential" type="password" placeholder="Credential (необязательно для Ollama)" />
            <Button class="w-full" :disabled="loading || !connectionForm.name.trim()" @click="createConnection">
              <Plus class="size-4" /> Добавить connection
            </Button>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            Model profiles
          </h3>
          <div v-for="model in models" :key="model.id" class="rounded-lg border p-3">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {{ model.displayName }}
                </p><p class="truncate text-xs text-muted-foreground">
                  {{ model.connectionName }} · {{ model.providerModelId }}
                </p>
              </div>
              <button class="rounded px-2 py-1 text-[11px]" :class="model.isDefault ? 'bg-primary text-primary-foreground' : 'bg-muted'" :disabled="!model.enabled" @click="makeDefault(model)">
                default
              </button>
              <Switch :model-value="model.enabled" @update:model-value="toggleModel(model)" />
              <Button size="icon" variant="ghost" title="Редактировать model profile" @click="beginModelEdit(model)">
                <Pencil class="size-4" />
              </Button>
              <Button size="icon" variant="ghost" class="text-destructive" @click="deleteModel(model)">
                <Trash2 class="size-4" />
              </Button>
            </div>
            <div v-if="editingModelId === model.id" class="mt-3 space-y-2 border-t pt-3">
              <Input v-model="modelEditForm.providerModelId" aria-label="Provider model ID для редактирования" />
              <Input v-model="modelEditForm.displayName" aria-label="Отображаемое имя для редактирования" />
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
          <div class="space-y-2 rounded-lg border border-dashed p-3">
            <select v-model="modelForm.connectionId" class="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="" disabled>
                Connection
              </option><option v-for="connection in connections" :key="connection.id" :value="connection.id">
                {{ connection.name }}
              </option>
            </select>
            <Input v-model="modelForm.providerModelId" placeholder="Provider model ID" />
            <Input v-model="modelForm.displayName" placeholder="Отображаемое имя" />
            <label class="flex items-center gap-2 text-xs"><Switch v-model="modelForm.isDefault" /> Сделать default</label>
            <Button class="w-full" :disabled="loading || !modelForm.connectionId || !modelForm.providerModelId.trim() || !modelForm.displayName.trim()" @click="createModel">
              <Plus class="size-4" /> Добавить model profile
            </Button>
          </div>
        </section>
      </div>
      <Loader2 v-if="loading" class="mx-auto size-5 animate-spin text-muted-foreground" />
    </DialogContent>
  </Dialog>
</template>
