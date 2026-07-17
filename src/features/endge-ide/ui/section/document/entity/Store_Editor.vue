<script setup lang="ts">
import type { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor'
import type { StoreRuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import {
  Bug,
  Code2,
  FileJson,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { resolvePreviewRuntime } from '@/features/endge-ide/model/preview-runtime/preview-runtime'
import {
  launchStorePreview,
  storePreviewError,
  storePreviewRuntime,
} from '@/features/endge-ide/model/store-preview/store-preview-state'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import StoreSourceEditor from '@/features/endge-ide/ui/components/StoreSourceEditor.vue'
import { openEndgeDebugPreview } from '@/features/endge-preview/model/navigation/open-debug-preview'

const editor = computed(
  () => EndgeIDE.tabs.documentEditorModel.value as RStoreEditor | null,
)
const router = useRouter()
const activeTab = ref<'general' | 'source' | 'artifact' | 'diagnostics'>(
  'source',
)
const launchLoading = ref(false)
const compiled = computed(() =>
  editor.value ? Endge.source.compile('store', editor.value.source) : null,
)
const artifactJson = computed(() =>
  JSON.stringify(compiled.value?.artifact ?? null, null, 2),
)
const diagnosticsJson = computed(() =>
  JSON.stringify(compiled.value?.diagnostics ?? [], null, 2),
)
const currentStorePreviewRuntime = computed<StoreRuntimeHost | null>(() => {
  void storePreviewRuntime.value
  const identity = editor.value?.identity?.trim()
  return identity
    ? resolvePreviewRuntime<StoreRuntimeHost>('store', identity)
    : null
})
function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

function resetSource(): void {
  editor.value?.applySourceText(Endge.source.createDefault('store'))
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  current.identity = current.identity.trim()
  current.name = current.name.trim()
  if (!current.identity) {
    toast.error('Identity хранилища не может быть пустым')
    activeTab.value = 'general'
    return
  }
  if (!current.name) {
    current.name = current.identity
  }

  await EndgeIDE.tabs.save()
}

async function launchPreview(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  launchLoading.value = true
  try {
    current.refreshDiagnostics()
    const runtime = await launchStorePreview({
      id: current.id,
      identity: current.identity,
      name: current.name,
      displayName: current.name,
      source: current.source,
      sourceVersion: current.sourceVersion,
    })
    storePreviewError.value = null
    toast.success('Store preview запущен', { description: runtime.id })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    storePreviewError.value = message
    toast.error('Не удалось запустить preview хранилища', {
      description: message,
    })
  }
  finally {
    launchLoading.value = false
  }
}

function openDebugPreview(): void {
  openEndgeDebugPreview(router, 'store', editor.value?.identity)
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'general'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Основное"
                @click="activeTab = 'general'"
              >
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Основное</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'source'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Source"
                @click="activeTab = 'source'"
              >
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Source</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="launchLoading"
                aria-label="Запустить preview хранилища"
                @click="launchPreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Запустить preview хранилища</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Открыть Debug Preview хранилища"
                @click="openDebugPreview"
              >
                <Bug class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Открыть Debug Preview сохранённого хранилища</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'artifact'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Артифакт"
                @click="activeTab = 'artifact'"
              >
                <FileJson class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Артифакт</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'diagnostics'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Диагностика"
                @click="activeTab = 'diagnostics'"
              >
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Диагностика</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сбросить source"
                @click="resetSource"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить source</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-xl space-y-5">
          <div class="space-y-2">
            <Label for="store-display-name">Название</Label>
            <Input
              id="store-display-name"
              v-model="editor.name"
              placeholder="Название хранилища"
            />
          </div>
          <div class="space-y-2">
            <Label for="store-identity">Identity</Label>
            <Input
              id="store-identity"
              v-model="editor.identity"
              placeholder="Уникальный идентификатор"
              spellcheck="false"
            />
            <p class="text-xs text-muted-foreground">
              Identity используется для ссылок на документ хранилища и должен
              быть уникальным.
            </p>
          </div>
        </div>
      </div>
      <StoreSourceEditor
        v-else-if="activeTab === 'source'"
        :model-value="editor.source"
        :runtime="currentStorePreviewRuntime"
        @update:model-value="updateSource"
      />
      <pre
        v-else-if="activeTab === 'artifact'"
        class="h-full overflow-auto bg-muted/30 p-4 text-xs"
      >{{ artifactJson }}</pre>
      <pre v-else class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{
        diagnosticsJson
      }}</pre>
    </div>
  </SourceDocumentEditorShell>
</template>
