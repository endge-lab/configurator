<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Loader2, LockKeyhole, Plus, Server, Trash2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useBackendConnections } from '@/features/backend-connections'

const openState = ref(false)
const newName = ref('')
const newURL = ref('')
const isSubmitting = ref(false)
const deletingID = ref<string | null>(null)
const errorMessage = ref('')
const { catalog, state, activeBackendURL } = useBackendConnections()
const canManage = computed(() => catalog.value?.canManage === true)

function open(): void {
  errorMessage.value = ''
  openState.value = true
  if (!catalog.value && state.value.status !== 'loading') {
    void Configurator.connections.load().catch(setError)
  }
}

async function addConnection(): Promise<void> {
  if (!newName.value.trim() || !newURL.value.trim() || isSubmitting.value) {
    return
  }
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await Configurator.connections.create(newName.value, newURL.value)
    newName.value = ''
    newURL.value = ''
  }
  catch (error) {
    setError(error)
  }
  finally {
    isSubmitting.value = false
  }
}

async function removeConnection(id: string, name: string, baseURL: string): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: 'Удалить подключение?',
    text: name,
    description: activeBackendURL.value === baseURL
      ? 'Это активное подключение. Configurator переключится на основной backend и перезагрузится.'
      : 'Адрес исчезнет из каталога у всех пользователей.',
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Удалить', variant: 'destructive' },
    ],
  })
  if (!confirmed) {
    return
  }
  deletingID.value = id
  errorMessage.value = ''
  try {
    await Configurator.connections.delete(id)
  }
  catch (error) {
    setError(error)
  }
  finally {
    deletingID.value = null
  }
}

function setError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader class="border-b bg-muted/35 px-6 py-5 text-left">
        <DialogTitle class="flex items-center gap-2">
          <Server class="size-4 text-orange-500" />
          Настройка подключений
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-4 px-6 py-5">
        <div v-if="errorMessage || state.status === 'error'" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <span>{{ errorMessage || (state.status === 'error' ? state.message : '') }}</span>
        </div>

        <div class="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          <div
            v-for="connection in catalog?.items ?? []"
            :key="connection.id"
            class="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3"
            :class="activeBackendURL === connection.baseUrl ? 'border-primary/40 bg-accent/40' : ''"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <LockKeyhole v-if="connection.primary" class="size-4" />
              <Server v-else class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ connection.name }}
              </p>
              <p class="mt-1 truncate font-mono text-[11px] text-muted-foreground" :title="connection.baseUrl">
                {{ connection.baseUrl }}
              </p>
            </div>
            <Button
              v-if="canManage && !connection.primary"
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground hover:text-destructive"
              :disabled="deletingID === connection.id"
              title="Удалить подключение"
              @click="removeConnection(connection.id, connection.name, connection.baseUrl)"
            >
              <Loader2 v-if="deletingID === connection.id" class="size-4 animate-spin" />
              <Trash2 v-else class="size-4" />
            </Button>
          </div>
          <div v-if="state.status === 'loading'" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Загрузка каталога…
          </div>
        </div>

        <form v-if="canManage" class="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] gap-2 border-t pt-4" @submit.prevent="addConnection">
          <Input v-model="newName" placeholder="Название" autocomplete="off" maxlength="160" />
          <Input v-model="newURL" placeholder="https://backend.example.com" autocomplete="url" />
          <Button type="submit" :disabled="isSubmitting || !newName.trim() || !newURL.trim()" class="shrink-0 gap-2">
            <Loader2 v-if="isSubmitting" class="size-4 animate-spin" />
            <Plus v-else class="size-4" />
            Добавить
          </Button>
        </form>
        <p v-else class="border-t pt-4 text-xs text-muted-foreground">
          Просмотр доступен всем пользователям. Добавление и удаление требует роли Platform Admin.
        </p>
      </div>

      <DialogFooter class="border-t bg-muted/25 px-6 py-3">
        <Button variant="outline" @click="openState = false">
          Закрыть
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
