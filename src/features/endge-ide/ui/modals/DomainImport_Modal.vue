<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ServiceBackendDomainImportPlan,
  ServiceBackendDomainImportResult,
} from '@/features/endge-ide/domain/types/domain-transfer.type'
import type { EndgeDomainBundle } from '@endge/core'

import { Endge } from '@endge/core'
import {
  ArchiveRestore,
  Check,
  Download,
  FileJson2,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { startConfiguratorLogin } from '@/features/configurator-session'
import {
  ServiceBackendDomainTransfer_Service,
  ServiceBackendDomainTransferError,
} from '@/features/endge-ide/model/backend/ServiceBackendDomainTransfer_Service'
import { Configurator } from '@/app'

type BackupState = 'idle' | 'complete' | 'error'
type ImportState = 'idle' | 'checking' | 'ready' | 'importing' | 'reloading'

const openModel = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const plan = ref<ServiceBackendDomainImportPlan | null>(null)
const confirmation = ref('')
const backupState = ref<BackupState>('idle')
const importState = ref<ImportState>('idle')
const errorMessage = ref('')
const isDragOver = ref(false)
let planController: AbortController | null = null

const backendConfig = Configurator.context.backendConfig
const transferService = backendConfig
  ? new ServiceBackendDomainTransfer_Service(backendConfig.serviceBackendURL)
  : null
const workspaceIdentity = computed(() => String(Endge.workspace.current.identity ?? '').trim())
const isBusy = computed(() => importState.value === 'checking'
  || importState.value === 'importing'
  || importState.value === 'reloading')
const canImport = computed(() => backupState.value === 'complete'
  && importState.value === 'ready'
  && plan.value?.valid === true
  && !!plan.value.planId
  && !!plan.value.targetETag
  && confirmation.value.trim() === workspaceIdentity.value)

async function open(): Promise<void> {
  reset()
  openModel.value = true
  await downloadSafetyCopy()
}

defineExpose({ open })

function reset(): void {
  planController?.abort()
  planController = null
  selectedFile.value = null
  plan.value = null
  confirmation.value = ''
  backupState.value = 'idle'
  importState.value = 'idle'
  errorMessage.value = ''
  isDragOver.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function setOpen(value: boolean): void {
  if (!value && (importState.value === 'importing' || importState.value === 'reloading')) {
    return
  }
  openModel.value = value
  if (!value) {
    planController?.abort()
  }
}

async function downloadSafetyCopy(): Promise<void> {
  backupState.value = 'idle'
  try {
    if (!transferService)
      throw new Error('Backend export service is unavailable')
    await transferService.downloadExport(workspaceIdentity.value)
    backupState.value = 'complete'
  }
  catch (error) {
    backupState.value = 'error'
    errorMessage.value = `Не удалось скачать страховочную копию: ${errorText(error)}`
  }
}

function chooseFile(): void {
  if (!isBusy.value) {
    fileInput.value?.click()
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (file) {
    await selectFile(file)
  }
  if (input) {
    input.value = ''
  }
}

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  if (!isBusy.value) {
    isDragOver.value = true
  }
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  if (event.currentTarget === event.target) {
    isDragOver.value = false
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragOver.value = false
  if (isBusy.value) {
    return
  }
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    await selectFile(file)
  }
}

async function selectFile(file: File): Promise<void> {
  planController?.abort()
  const controller = new AbortController()
  planController = controller
  selectedFile.value = file
  plan.value = null
  confirmation.value = ''
  errorMessage.value = ''
  importState.value = 'checking'

  try {
    if (!transferService) {
      throw new Error('Полный импорт доступен только в режиме service-backend')
    }
    const snapshot = parseSnapshot(await file.text())
    const nextPlan = await transferService.planImport({
      workspaceIdentity: workspaceIdentity.value,
      snapshot,
      signal: controller.signal,
    })
    if (controller.signal.aborted) {
      return
    }
    plan.value = nextPlan
    importState.value = 'ready'
    if (!nextPlan.valid) {
      errorMessage.value = 'Backend отклонил файл. Исправьте ошибки или выберите другой snapshot.'
    }
  }
  catch (error) {
    if (controller.signal.aborted) {
      return
    }
    importState.value = 'idle'
    handleTransferError(error, 'Не удалось проверить файл импорта')
  }
  finally {
    if (planController === controller) {
      planController = null
    }
  }
}

async function applyImport(): Promise<void> {
  const currentPlan = plan.value
  if (!transferService || !canImport.value || !currentPlan?.planId) {
    return
  }

  errorMessage.value = ''
  importState.value = 'importing'
  let result: ServiceBackendDomainImportResult
  try {
    result = await transferService.import({
      workspaceIdentity: workspaceIdentity.value,
      planId: currentPlan.planId,
      confirmation: confirmation.value.trim(),
      targetETag: currentPlan.targetETag,
    })
  }
  catch (error) {
    importState.value = 'ready'
    handleTransferError(error, 'Не удалось импортировать домен')
    return
  }

  importState.value = 'reloading'
  try {
    await Configurator.context.reloadCurrentContext()
  }
  catch {
    toast.warning('Импорт завершён, интерфейс будет перезагружен', {
      description: 'Backend уже заменил домен, поэтому повторный импорт не запускается.',
    })
    window.location.reload()
    return
  }

  toast.success('Домен импортирован', {
    description: `${result.imported.documents} документов. Страховочная backend-копия создана автоматически.`,
  })
  openModel.value = false
  reset()
}

function handleTransferError(error: unknown, fallback: string): void {
  if (error instanceof ServiceBackendDomainTransferError
    && error.code === 'service_backend_unauthorized'
    && error.loginUrl) {
    const redirect = startConfiguratorLogin(error.loginUrl)
    errorMessage.value = redirect.redirected
      ? 'Сессия истекла. Переходим к авторизации…'
      : redirect.message ?? 'Не удалось запустить повторную авторизацию'
    return
  }
  errorMessage.value = `${fallback}: ${errorText(error)}`
}

function parseSnapshot(text: string): EndgeDomainBundle {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  }
  catch {
    throw new Error('файл не является корректным JSON')
  }
  if (!isRecord(raw)
    || raw.kind !== 'workspace-snapshot'
    || typeof raw.schemaVersion !== 'number'
    || !isRecord(raw.workspace)
    || !isRecord(raw.documents)
    || !Array.isArray(raw.installedIntegrations)) {
    throw new Error('ожидается полный workspace-snapshot, скачанный через экспорт домена')
  }
  return raw as unknown as EndgeDomainBundle
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
</script>

<template>
  <Dialog :open="openModel" @update:open="setOpen">
    <DialogContent class="max-h-[92vh] overflow-hidden p-0 sm:max-w-[760px]">
      <DialogHeader class="border-b bg-destructive/[0.045] px-6 py-5 pr-14">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <ShieldAlert class="size-5" />
          </div>
          <div class="space-y-1.5">
            <DialogTitle class="text-left text-lg">
              Полный импорт домена
            </DialogTitle>
            <DialogDescription class="text-left leading-5">
              Все документы и история workspace <span class="font-mono font-semibold text-foreground">{{ workspaceIdentity }}</span>
              будут полностью заменены содержимым выбранного файла.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
        <section
          class="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
          :class="backupState === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-emerald-500/25 bg-emerald-500/[0.06]'"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
              <Check v-if="backupState === 'complete'" class="size-4 text-emerald-600" />
              <X v-else-if="backupState === 'error'" class="size-4 text-destructive" />
              <Download v-else class="size-4 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-medium">
                {{ backupState === 'complete' ? 'Скачивание страховочной копии запущено' : backupState === 'error' ? 'Копия не скачана' : 'Подготовка копии' }}
              </div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                Импорт заблокирован, пока локальная копия текущего домена не будет сохранена.
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" :disabled="isBusy" @click="downloadSafetyCopy">
            <RefreshCcw class="size-3.5" />
            Скачать ещё раз
          </Button>
        </section>

        <section class="space-y-2">
          <Label>Snapshot для импорта</Label>
          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="onFileChange"
          >
          <button
            type="button"
            class="group flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-5 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            :class="isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 hover:bg-muted/35'"
            :disabled="isBusy"
            @click="chooseFile"
            @dragenter="onDragEnter"
            @dragover.prevent="onDragEnter"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <Loader2 v-if="importState === 'checking'" class="size-7 animate-spin text-primary" />
            <FileJson2 v-else-if="selectedFile" class="size-7 text-primary" />
            <UploadCloud v-else class="size-7 text-muted-foreground transition-colors group-hover:text-foreground" />
            <div class="space-y-1">
              <div class="text-sm font-medium">
                {{ selectedFile ? selectedFile.name : 'Перетащите JSON сюда или выберите файл' }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ importState === 'checking' ? 'Backend проверяет snapshot и строит план…' : selectedFile ? `${Math.max(1, Math.ceil(selectedFile.size / 1024))} КБ` : 'Принимается полный workspace-snapshot' }}
              </div>
            </div>
          </button>
        </section>

        <section v-if="plan" class="overflow-hidden rounded-md border">
          <div class="grid grid-cols-2 divide-x border-b bg-muted/25 sm:grid-cols-4">
            <div class="px-3 py-2.5">
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
                В файле
              </div>
              <div class="mt-1 text-sm font-semibold">
                {{ plan.incoming.documents }} документов
              </div>
            </div>
            <div class="px-3 py-2.5">
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
                Будет удалено
              </div>
              <div class="mt-1 text-sm font-semibold text-destructive">
                {{ plan.willRemove.documents }} документов
              </div>
            </div>
            <div class="border-t px-3 py-2.5 sm:border-t-0">
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ревизии
              </div>
              <div class="mt-1 text-sm font-semibold">
                {{ plan.willRemove.revisions }}
              </div>
            </div>
            <div class="border-t px-3 py-2.5 sm:border-t-0">
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
                История
              </div>
              <div class="mt-1 text-sm font-semibold">
                {{ plan.willRemove.commits + plan.willRemove.releases }}
              </div>
            </div>
          </div>

          <div v-if="plan.validationErrors.length" class="space-y-1.5 bg-destructive/[0.04] px-4 py-3 text-xs text-destructive">
            <div class="font-semibold">
              Файл не прошёл проверку:
            </div>
            <div v-for="item in plan.validationErrors" :key="item">
              • {{ item }}
            </div>
          </div>
          <div v-else-if="plan.warnings.length" class="space-y-1.5 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <div v-for="item in plan.warnings" :key="item">
              • {{ item }}
            </div>
          </div>
        </section>

        <section v-if="plan?.valid" class="space-y-2 rounded-md border border-destructive/25 bg-destructive/[0.035] p-4">
          <Label for="domain-import-confirmation" class="text-sm">
            Для подтверждения введите identity workspace:
            <span class="font-mono font-semibold">{{ workspaceIdentity }}</span>
          </Label>
          <Input
            id="domain-import-confirmation"
            v-model="confirmation"
            autocomplete="off"
            :placeholder="workspaceIdentity"
            :disabled="isBusy"
          />
        </section>

        <div v-if="errorMessage" class="rounded-md border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {{ errorMessage }}
        </div>
      </div>

      <DialogFooter class="border-t bg-muted/15 px-6 py-4 sm:justify-between">
        <div class="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <ArchiveRestore class="size-3.5" />
          Backend также создаст pre-import backup
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="outline" :disabled="importState === 'importing' || importState === 'reloading'" @click="setOpen(false)">
            Отмена
          </Button>
          <Button variant="destructive" :disabled="!canImport" @click="applyImport">
            <Loader2 v-if="importState === 'importing' || importState === 'reloading'" class="size-4 animate-spin" />
            <span v-if="importState === 'importing'">Импортируем…</span>
            <span v-else-if="importState === 'reloading'">Обновляем домен…</span>
            <span v-else>Полностью заменить домен</span>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
