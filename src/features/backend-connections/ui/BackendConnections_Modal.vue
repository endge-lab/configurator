<script setup lang="ts">
import { HardDrive, Loader2, LockKeyhole, Plus, Server, Trash2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'

const openState = ref(false)
const newName = ref('')
const newURL = ref('')
const saveLocally = ref(true)
const isSubmitting = ref(false)
const deletingKey = ref<string | null>(null)
const errorMessage = ref('')
const { t } = useI18n()
const { catalog, state, activeBackendURL } = useBackendConnections()
const canManageEnvironment = computed(() => Boolean(activeBackendURL.value) && catalog.value.canManage)

function open(): void {
  errorMessage.value = ''
  saveLocally.value = true
  openState.value = true
  if (activeBackendURL.value && state.value.status !== 'loading') {
    void Configurator.connections.load().catch(setError)
  }
}

async function addConnection(): Promise<void> {
  if (!newName.value.trim() || !newURL.value.trim() || isSubmitting.value) {
    return
  }
  if (!saveLocally.value && !canManageEnvironment.value) {
    return
  }
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await Configurator.connections.create(newName.value, newURL.value, saveLocally.value)
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

async function removeLocalConnection(name: string, baseURL: string): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: t('backendConnections.deleteLocalTitle'),
    text: name,
    description: t('backendConnections.deleteLocalDescription'),
    answers: [
      { value: false, text: t('backendConnections.cancel'), variant: 'outline' },
      { value: true, text: t('backendConnections.confirmDelete'), variant: 'destructive' },
    ],
  })
  if (confirmed) {
    Configurator.connections.deleteLocal(baseURL)
  }
}

async function removeEnvironmentConnection(id: string, name: string): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: t('backendConnections.deleteEnvironmentTitle'),
    text: name,
    description: t('backendConnections.deleteEnvironmentDescription'),
    answers: [
      { value: false, text: t('backendConnections.cancel'), variant: 'outline' },
      { value: true, text: t('backendConnections.confirmDelete'), variant: 'destructive' },
    ],
  })
  if (!confirmed) {
    return
  }
  deletingKey.value = `environment:${id}`
  errorMessage.value = ''
  try {
    await Configurator.connections.delete(id)
  }
  catch (error) {
    setError(error)
  }
  finally {
    deletingKey.value = null
  }
}

function setError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : t('backendConnections.requestFailed')
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader class="border-b bg-muted/35 px-6 py-5 text-left">
        <DialogTitle class="flex items-center gap-2">
          <Server class="size-4 text-orange-500" />
          {{ $t('endgeIde.headerMenu.settings.connections') }}
        </DialogTitle>
      </DialogHeader>

      <div class="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
        <div v-if="errorMessage || state.status === 'error'" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <span>{{ errorMessage || (state.status === 'error' ? state.message : '') }}</span>
        </div>

        <section class="space-y-2">
          <h3 class="text-xs font-medium text-muted-foreground">
            {{ $t('backendConnections.localGroup') }}
          </h3>
          <div
            v-for="connection in catalog.localItems"
            :key="`${connection.source}:${connection.id}`"
            class="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3"
            :class="activeBackendURL === connection.baseUrl ? 'border-primary/40 bg-accent/40' : ''"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <LockKeyhole v-if="connection.primary" class="size-4" />
              <HardDrive v-else class="size-4" />
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
              v-if="connection.source === 'local' && activeBackendURL !== connection.baseUrl"
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground hover:text-destructive"
              :title="$t('backendConnections.deleteLocal')"
              @click="removeLocalConnection(connection.name, connection.baseUrl)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
          <p v-if="catalog.localItems.length === 0" class="rounded-lg border border-dashed px-3.5 py-4 text-xs text-muted-foreground">
            {{ $t('backendConnections.emptyLocal') }}
          </p>
        </section>

        <section class="space-y-2 border-t pt-5">
          <h3 class="text-xs font-medium text-muted-foreground">
            {{ $t('backendConnections.environmentGroup') }}
          </h3>
          <div
            v-for="connection in catalog.environmentItems"
            :key="`${connection.source}:${connection.id}`"
            class="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3"
            :class="activeBackendURL === connection.baseUrl ? 'border-primary/40 bg-accent/40' : ''"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Server class="size-4" />
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
              v-if="canManageEnvironment"
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground hover:text-destructive"
              :disabled="deletingKey === `environment:${connection.id}`"
              :title="$t('backendConnections.deleteEnvironment')"
              @click="removeEnvironmentConnection(connection.id, connection.name)"
            >
              <Loader2 v-if="deletingKey === `environment:${connection.id}`" class="size-4 animate-spin" />
              <Trash2 v-else class="size-4" />
            </Button>
          </div>
          <div v-if="state.status === 'loading'" class="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> {{ $t('uiText.loadingDirectory276d1f8c') }}
          </div>
          <p v-else-if="!activeBackendURL" class="rounded-lg border border-dashed px-3.5 py-4 text-xs text-muted-foreground">
            {{ $t('backendConnections.selectEnvironmentFirst') }}
          </p>
          <p v-else-if="catalog.environmentItems.length === 0" class="rounded-lg border border-dashed px-3.5 py-4 text-xs text-muted-foreground">
            {{ $t('backendConnections.emptyEnvironment') }}
          </p>
        </section>

        <form class="space-y-3 border-t pt-5" @submit.prevent="addConnection">
          <div class="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] gap-2">
            <Input v-model="newName" :placeholder="$t('backendConnections.namePlaceholder')" autocomplete="off" maxlength="160" />
            <Input v-model="newURL" placeholder="https://backend.example.com" autocomplete="url" />
            <Button
              type="submit"
              :disabled="isSubmitting || !newName.trim() || !newURL.trim() || (!saveLocally && !canManageEnvironment)"
              class="shrink-0 gap-2"
            >
              <Loader2 v-if="isSubmitting" class="size-4 animate-spin" />
              <Plus v-else class="size-4" />
              {{ $t('uiText.add559a87f7') }}
            </Button>
          </div>
          <label class="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox
              :model-value="saveLocally"
              :disabled="!canManageEnvironment"
              class="mt-0.5"
              @update:model-value="value => saveLocally = value === true"
            />
            <span>
              <span class="block font-medium text-foreground">{{ $t('backendConnections.saveLocally') }}</span>
              <span>{{ canManageEnvironment ? $t('backendConnections.saveLocallyHint') : $t('backendConnections.environmentSaveUnavailable') }}</span>
            </span>
          </label>
        </form>
      </div>

      <DialogFooter class="border-t bg-muted/25 px-6 py-3">
        <Button variant="outline" @click="openState = false">
          {{ $t('grid.widget.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
