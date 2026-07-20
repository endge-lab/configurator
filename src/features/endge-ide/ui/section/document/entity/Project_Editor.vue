<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor'
import type { EndgeConfigurationContribution } from '@endge/core'

import { DomainSectionType, Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import {
  Loader2,
  Map,
  Play,
  Save,
  Settings2,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import OpenEntityButton from '@/features/endge-ide/ui/components/OpenEntityButton.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const props = defineProps<{
  tabContext?: { editor?: RProjectEditor }
}>()

const domainStore = useDomainStore()
const editor = computed<RProjectEditor | null>(
  () => props.tabContext?.editor ?? null,
)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'general',
  ['general', 'navigation', 'configuration'] as const,
)
const launchLoading = ref(false)
const tabButtons = [
  { value: 'general', icon: Settings2, label: 'Основное' },
  { value: 'navigation', icon: Map, label: 'Навигация' },
  { value: 'configuration', icon: SlidersHorizontal, label: 'Конфигурация' },
] as const
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: (value) => {
    if (editor.value) {
      editor.value.configuration = value
    }
  },
})
const upstreamConfiguration = computed(() =>
  Endge.configuration.resolveUpstream('project'),
)

const SELECT_NONE = '__none__'

function normalizeRelationId(value: unknown): number | null {
  if (value == null) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const text = String(value).trim()
  if (!text) {
    return null
  }
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

const navigationOptions = computed(() => {
  const list = domainStore.navigations ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list
      .map(
        (n: {
          id?: string | number
          identity?: string
          displayName?: string
          name?: string
        }) => ({
          value: n?.id != null ? String(n.id) : '',
          label:
            (
              n?.displayName
              ?? n?.name
              ?? n?.identity
              ?? String(n?.id ?? '')
            ).trim() || String(n?.id ?? ''),
        }),
      )
      .filter((o: { value: string }) => o.value.length > 0),
  ]
})

function navigationIdForSelect(): string {
  const v = editor.value?.navigationId
  return v != null ? String(v) : SELECT_NONE
}

function onNavigationSelect(value: string | string[] | null): void {
  if (!editor.value) {
    return
  }
  const selected = Array.isArray(value) ? value[0] : value
  editor.value.navigationId
    = selected === SELECT_NONE ? null : normalizeRelationId(selected)
}

function onNavigationDrop(id: string | number): void {
  if (!editor.value) {
    return
  }
  editor.value.navigationId = normalizeRelationId(id)
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

async function launchRuntimePreview(): Promise<void> {
  if (!editor.value) {
    return
  }
  launchLoading.value = true
  try {
    await EndgeIDE.runtimePreview.launchEditor(editor.value)
  }
  finally {
    launchLoading.value = false
  }
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
          <Tooltip v-for="item in tabButtons" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === item.value
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="item.label"
                @click="activeTab = item.value"
              >
                <component :is="item.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ item.label }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Запустить Runtime Preview"
                :disabled="!editor.identity || launchLoading"
                @click="launchRuntimePreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Запустить Runtime Preview проекта (⌘/Ctrl+Enter)
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <ScrollArea v-if="activeTab === 'general'" class="min-h-0 flex-1">
      <div class="mx-auto max-w-2xl space-y-4 p-6">
        <div class="space-y-2">
          <Label for="project-identity">Identity</Label>
          <Input
            id="project-identity"
            v-model="editor.identity"
            placeholder="my-project"
          />
        </div>
        <div class="space-y-2">
          <Label for="project-display-name">Display name</Label>
          <Input
            id="project-display-name"
            v-model="editor.displayName"
            placeholder="Мой проект"
          />
        </div>
        <div class="space-y-2">
          <Label>Slug (URL)</Label>
          <Input
            :model-value="editor?.slug ?? ''"
            placeholder="my-project"
            @update:model-value="
              (value) =>
                editor && (editor.slug = value == null ? null : String(value))
            "
          />
        </div>
        <div class="space-y-2">
          <Label>Описание</Label>
          <Textarea
            :model-value="editor.description ?? ''"
            :rows="4"
            placeholder="Краткое описание проекта"
            @update:model-value="
              (value) =>
                editor && (editor.description = String(value || '') || null)
            "
          />
        </div>
        <div class="space-y-2">
          <Label>Порядок сортировки</Label>
          <Input
            type="number"
            :model-value="editor?.order ?? ''"
            placeholder="0"
            @update:model-value="
              (v) =>
                editor
                && (editor.order = v === '' || v == null ? null : Number(v))
            "
          />
        </div>
      </div>
    </ScrollArea>

    <ScrollArea v-else-if="activeTab === 'navigation'" class="min-h-0 flex-1">
      <div class="mx-auto max-w-2xl space-y-4 p-6">
        <div class="space-y-2">
          <Label>Навигация проекта</Label>
          <DomainEntityDropTarget
            :accept-section-types="[DomainSectionType.Navigation]"
            @update:model-value="onNavigationDrop"
          >
            <div class="flex items-center gap-1">
              <SearchableSelect
                :model-value="navigationIdForSelect()"
                :options="navigationOptions"
                placeholder="Выберите навигацию"
                trigger-class="flex-1 min-w-0 h-9"
                @update:model-value="onNavigationSelect"
              />
              <OpenEntityButton
                :entity-id="editor?.navigationId ?? null"
                :section-type="DomainSectionType.Navigation"
              />
            </div>
          </DomainEntityDropTarget>
          <p class="text-xs text-muted-foreground">
            Главное меню / навигация приложения проекта.
          </p>
        </div>
      </div>
    </ScrollArea>

    <div v-else class="min-h-0 flex-1 overflow-auto p-6">
      <div class="mx-auto h-full max-w-3xl">
        <ConfigurationSettingsEditor
          v-model="configuration"
          variant="contribution"
          :upstream="upstreamConfiguration"
        />
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
