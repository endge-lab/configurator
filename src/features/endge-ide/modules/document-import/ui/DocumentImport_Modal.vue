<script setup lang="ts">
import type {
  DocumentImportApplyResult,
  DocumentImportCandidate,
  DocumentImportDiagnostic,
  DocumentImportSkippedItem,
} from '@endge/core'

import { Endge } from '@endge/core'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  FileCode2,
  FolderTree,
  Loader2,
  UploadCloud,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { buildDocumentImportFolderOptions } from '@/features/endge-ide/modules/document-import/tools/document-import-folders'

const ROOT_FOLDER_VALUE = '__root__'

const { t } = useI18n()
const state = EndgeIDE.documentImport.state
const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)

const openModel = computed({
  get: () => state.open,
  set: (open) => {
    if (!open) {
      EndgeIDE.documentImport.close()
    }
  },
})
const isBusy = computed(() => state.status === 'preparing' || state.status === 'applying')
const selectedIds = computed(() => new Set(state.selectedCandidateIds))
const readyCandidates = computed(() => state.plan?.candidates.filter(candidate => candidate.status === 'ready') ?? [])
const allReadySelected = computed(() => readyCandidates.value.length > 0
  && readyCandidates.value.every(candidate => selectedIds.value.has(candidate.id)))
const canApply = computed(() => state.status === 'ready'
  && state.selectedCandidateIds.length > 0
  && !state.plan?.diagnostics.some(diagnostic => diagnostic.severity === 'error'))
const formatLabel = computed(() => state.format === 'graphql' ? 'GraphQL' : 'OpenAPI')
const acceptedFiles = computed(() => state.format === 'graphql'
  ? '.graphql,.gql,.graphqls,text/plain'
  : '.yaml,.yml,.json,application/yaml,application/json,text/yaml')
const fileHint = computed(() => state.format === 'graphql'
  ? t('endgeIde.documentImport.fileHint.graphql')
  : t('endgeIde.documentImport.fileHint.openapi'))
const folderOptions = computed(() => {
  void state.open
  return buildDocumentImportFolderOptions(Endge.domain.getFolders())
})
const selectedFolder = computed({
  get: () => state.folderId == null ? ROOT_FOLDER_VALUE : String(state.folderId),
  set: value => EndgeIDE.documentImport.setDestinationFolder(value === ROOT_FOLDER_VALUE ? null : value),
})

function chooseFile(): void {
  if (!isBusy.value) {
    fileInput.value?.click()
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (file) {
    await prepareFile(file)
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
    await prepareFile(file)
  }
}

async function prepareFile(file: File): Promise<void> {
  EndgeIDE.documentImport.prepareSource({
    source: await file.text(),
    fileName: file.name,
    fileSize: file.size,
  })
}

function setCandidateSelected(candidate: DocumentImportCandidate, value: boolean | 'indeterminate'): void {
  EndgeIDE.documentImport.setCandidateSelected(candidate.id, value === true)
}

function toggleAllReady(): void {
  if (allReadySelected.value) {
    EndgeIDE.documentImport.clearSelection()
  }
  else {
    EndgeIDE.documentImport.selectAllReady()
  }
}

function statusLabel(candidate: DocumentImportCandidate): string {
  if (candidate.status === 'conflict') {
    return t('endgeIde.documentImport.status.conflict')
  }
  if (candidate.status === 'invalid') {
    return t('endgeIde.documentImport.status.invalid')
  }
  return t('endgeIde.documentImport.status.ready')
}

function statusVariant(candidate: DocumentImportCandidate): 'secondary' | 'destructive' | 'outline' {
  if (candidate.status === 'invalid') {
    return 'destructive'
  }
  return candidate.status === 'conflict' ? 'outline' : 'secondary'
}

function diagnosticText(diagnostic: DocumentImportDiagnostic): string {
  const location = diagnostic.line ? `${diagnostic.line}:${diagnostic.column ?? 1} · ` : ''
  return `${location}${diagnostic.message}`
}

function skippedItemText(item: DocumentImportSkippedItem): string {
  return item.identity ? `${item.identity}: ${item.reason}` : item.reason
}

function importResultParams(result: DocumentImportApplyResult): Record<string, unknown> {
  return {
    imported: result.imported,
    skipped: result.skipped,
    failed: result.failed,
  }
}

async function applyImport(): Promise<void> {
  try {
    const result = await EndgeIDE.documentImport.apply()
    if (result.failed > 0) {
      toast.warning(t('endgeIde.documentImport.toast.partialTitle'), {
        description: t('endgeIde.documentImport.toast.result', importResultParams(result)),
      })
      return
    }
    toast.success(t('endgeIde.documentImport.toast.successTitle'), {
      description: t('endgeIde.documentImport.toast.result', importResultParams(result)),
    })
  }
  catch {
    toast.error(t('endgeIde.documentImport.toast.failedTitle'))
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
      <DialogHeader class="border-b bg-primary/[0.035] px-6 py-5 pr-14">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <Braces v-if="state.format === 'graphql'" class="size-5" />
            <FileCode2 v-else class="size-5" />
          </div>
          <div class="space-y-1.5">
            <DialogTitle class="text-left text-lg">
              {{ t('endgeIde.documentImport.title', { format: formatLabel }) }}
            </DialogTitle>
            <DialogDescription class="text-left leading-5">
              {{ t('endgeIde.documentImport.description') }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
        <section class="space-y-2">
          <Label>{{ t('endgeIde.documentImport.sourceLabel') }}</Label>
          <input
            ref="fileInput"
            type="file"
            :accept="acceptedFiles"
            class="hidden"
            @change="onFileChange"
          >
          <div
            v-if="state.fileName"
            class="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2.5"
          >
            <Loader2 v-if="state.status === 'preparing'" class="size-5 shrink-0 animate-spin text-primary" />
            <FileCode2 v-else class="size-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1 truncate text-sm font-medium" :title="state.fileName">
              {{ state.fileName }}
            </div>
          </div>
          <button
            v-else
            type="button"
            class="group flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-5 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            :class="isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 hover:bg-muted/35'"
            :disabled="isBusy"
            @click="chooseFile"
            @dragenter="onDragEnter"
            @dragover.prevent="onDragEnter"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <UploadCloud class="size-7 text-muted-foreground transition-colors group-hover:text-foreground" />
            <div class="space-y-1">
              <div class="text-sm font-medium">
                {{ t('endgeIde.documentImport.dropzone') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ fileHint }}
              </div>
            </div>
          </button>
        </section>

        <section v-if="state.plan" class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">
                {{ t('endgeIde.documentImport.found', { count: state.plan.candidates.length }) }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('endgeIde.documentImport.selected', { count: state.selectedCandidateIds.length }) }}
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" :disabled="readyCandidates.length === 0" @click="toggleAllReady">
              {{ allReadySelected ? t('endgeIde.documentImport.clearSelection') : t('endgeIde.documentImport.selectAll') }}
            </Button>
          </div>

          <div v-if="state.plan.diagnostics.length" class="space-y-1 rounded-md border border-destructive/30 bg-destructive/[0.05] p-3 text-xs text-destructive">
            <div v-for="diagnostic in state.plan.diagnostics" :key="`${diagnostic.code}:${diagnostic.message}`">
              {{ diagnosticText(diagnostic) }}
            </div>
          </div>

          <div class="divide-y overflow-hidden rounded-md border">
            <label
              v-for="candidate in state.plan.candidates"
              :key="candidate.id"
              class="flex items-start gap-3 px-4 py-3"
              :class="candidate.status === 'ready' ? 'cursor-pointer hover:bg-muted/30' : 'bg-muted/20 opacity-75'"
            >
              <Checkbox
                class="mt-0.5"
                :model-value="selectedIds.has(candidate.id)"
                :disabled="candidate.status !== 'ready' || isBusy"
                @update:model-value="value => setCandidateSelected(candidate, value)"
              />
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-sm font-semibold">{{ candidate.identity }}</span>
                  <Badge :variant="statusVariant(candidate)" class="px-1.5 py-0 text-[10px]">
                    {{ statusLabel(candidate) }}
                  </Badge>
                </div>
                <p v-if="candidate.description" class="line-clamp-2 text-xs text-muted-foreground">
                  {{ candidate.description }}
                </p>
                <div class="text-xs text-muted-foreground">
                  {{ t('endgeIde.documentImport.fieldSummary', {
                    fields: candidate.summary.fields,
                    required: candidate.summary.requiredFields,
                  }) }}
                </div>
                <div v-if="candidate.diagnostics.length" class="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
                  <div v-for="diagnostic in candidate.diagnostics" :key="`${diagnostic.code}:${diagnostic.message}`">
                    {{ diagnostic.message }}
                  </div>
                </div>
                <details class="text-xs">
                  <summary class="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                    {{ t('endgeIde.documentImport.sourcePreview') }}
                  </summary>
                  <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono leading-5">{{ candidate.sourcePreview }}</pre>
                </details>
              </div>
            </label>
            <div v-if="state.plan.candidates.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
              {{ t('endgeIde.documentImport.empty') }}
            </div>
          </div>

          <div v-if="state.plan.skipped.length" class="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <div class="flex items-center gap-2 font-semibold">
              <AlertTriangle class="size-3.5" />
              {{ t('endgeIde.documentImport.skipped', { count: state.plan.skipped.length }) }}
            </div>
            <div v-for="item in state.plan.skipped" :key="`${item.kind}:${item.identity ?? item.reason}`" class="mt-1">
              {{ skippedItemText(item) }}
            </div>
          </div>

          <div class="space-y-2 rounded-md border bg-muted/20 p-4">
            <Label class="flex items-center gap-2">
              <FolderTree class="size-4 text-amber-500" />
              {{ t('endgeIde.documentImport.destination') }}
            </Label>
            <Select v-model="selectedFolder" :disabled="isBusy">
              <SelectTrigger><SelectValue :placeholder="t('endgeIde.documentImport.typeRoot')" /></SelectTrigger>
              <SelectContent>
                <SelectItem :value="ROOT_FOLDER_VALUE">
                  {{ t('endgeIde.documentImport.typeRoot') }}
                </SelectItem>
                <SelectItem v-for="option in folderOptions" :key="option.id" :value="option.id">
                  {{ option.path }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <div v-if="state.errorMessage" class="rounded-md border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {{ t('endgeIde.documentImport.error') }} {{ state.errorMessage }}
        </div>

        <div v-if="state.result" class="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-sm">
          <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div>
            <div class="font-semibold">
              {{ t('endgeIde.documentImport.completed') }}
            </div>
            <div class="text-muted-foreground">
              {{ t('endgeIde.documentImport.toast.result', importResultParams(state.result)) }}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="border-t bg-muted/15 px-6 py-4">
        <Button type="button" variant="outline" :disabled="state.status === 'applying'" @click="EndgeIDE.documentImport.close()">
          {{ state.status === 'completed' ? t('endgeIde.documentImport.close') : t('endgeIde.documentImport.cancel') }}
        </Button>
        <Button v-if="state.status !== 'completed'" type="button" :disabled="!canApply" @click="applyImport">
          <Loader2 v-if="state.status === 'applying'" class="size-4 animate-spin" />
          {{ state.status === 'applying'
            ? t('endgeIde.documentImport.applying')
            : t('endgeIde.documentImport.apply', { count: state.selectedCandidateIds.length }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
